# Dikt Phase 1 Technical Research

This document contains detailed technical research for implementing Phase 1 (Windows MVP) of Dikt.

---

## Table of Contents

1. [Tauri 2.x Global Shortcuts](#1-tauri-2x-global-shortcuts)
2. [Hold-to-Talk Implementation (Windows)](#2-hold-to-talk-implementation-windows)
3. [Window Configuration & Focus](#3-window-configuration--focus)
4. [Audio Capture (cpal + hound)](#4-audio-capture-cpal--hound)
5. [OpenAI-Compatible Transcription API](#5-openai-compatible-transcription-api)
6. [Clipboard & Auto-Paste](#6-clipboard--auto-paste)
7. [Secure Credential Storage](#7-secure-credential-storage)
8. [Recommended Architecture](#8-recommended-architecture)
9. [Dependencies Summary](#9-dependencies-summary)

---

## 1. Tauri 2.x Global Shortcuts

### Key Finding: Supports Key DOWN and UP Events

The `tauri-plugin-global-shortcut` **DOES support separate key down/up events**:

```rust
// Rust
match event.state() {
    ShortcutState::Pressed => { /* key down */ }
    ShortcutState::Released => { /* key up */ }
}
```

```javascript
// JavaScript
await register('CommandOrControl+Shift+Space', (event) => {
    if (event.state === 'Pressed') {
        // Start recording
    } else if (event.state === 'Released') {
        // Stop recording, transcribe
    }
});
```

### API Methods

| Method | Description |
|--------|-------------|
| `register(shortcut, handler)` | Register shortcut with callback |
| `unregister(shortcut)` | Remove shortcut |
| `unregisterAll()` | Clear all shortcuts |
| `isRegistered(shortcut)` | Check registration status |

### Required Permissions (capabilities/main.json)

```json
{
    "permissions": [
        "global-shortcut:allow-register",
        "global-shortcut:allow-unregister",
        "global-shortcut:allow-is-registered"
    ]
}
```

### Limitations

1. **Shortcut conflicts**: If another app uses the same shortcut, handler won't trigger
2. **No pre-key-down events**: Only Pressed/Released states available
3. **Platform variations**: Behavior may differ slightly across OS

### Verdict: Use for Phase 1

The built-in plugin handles hold-to-talk natively. No need for `rdev` or raw Windows hooks unless we encounter issues.

---

## 2. Hold-to-Talk Implementation (Windows)

### Option A: Tauri Global Shortcut Plugin (RECOMMENDED)

```javascript
import { register } from '@tauri-apps/plugin-global-shortcut';

let isRecording = false;

await register('Control+Shift+Space', async (event) => {
    if (event.state === 'Pressed' && !isRecording) {
        isRecording = true;
        await invoke('start_recording');
    } else if (event.state === 'Released' && isRecording) {
        isRecording = false;
        await invoke('stop_and_transcribe');
    }
});
```

### Option B: rdev Crate (Fallback)

If Tauri's plugin doesn't work reliably, use `rdev`:

```rust
use rdev::{listen, EventType, Key};

fn callback(event: rdev::Event) {
    match event.event_type {
        EventType::KeyPress(Key::Space) => {
            println!("Key pressed - start recording");
        }
        EventType::KeyRelease(Key::Space) => {
            println!("Key released - stop recording");
        }
        _ => {}
    }
}

// Global listening (blocks thread)
listen(callback).unwrap();
```

**rdev Features:**
- `EventType::KeyPress` / `EventType::KeyRelease` for down/up
- Global listening without window focus
- `unstable_grab` feature to consume events

### Option C: SetWindowsHookEx (NOT RECOMMENDED)

Raw Windows API via `windows-rs`. More complex, and has known issues with Tauri windows.

### Recommendation

**Start with Tauri's global-shortcut plugin.** It supports Pressed/Released states natively. Only fall back to `rdev` if issues arise.

---

## 3. Window Configuration & Focus

### Floating Overlay Window (tauri.conf.json)

```json
{
    "windows": [
        {
            "label": "overlay",
            "title": "Dikt",
            "width": 400,
            "height": 100,
            "decorations": false,
            "transparent": true,
            "alwaysOnTop": true,
            "resizable": false,
            "skipTaskbar": true,
            "focused": false
        }
    ]
}
```

### Key Properties

| Property | Value | Effect |
|----------|-------|--------|
| `decorations` | `false` | Frameless window |
| `transparent` | `true` | Transparent background |
| `alwaysOnTop` | `true` | Float above other windows |
| `skipTaskbar` | `true` | Hide from taskbar |
| `focused` | `false` | Don't steal focus on creation |

### Focus Stealing Prevention

**Known Issue**: Tauri's `focused: false` doesn't reliably prevent focus stealing on Windows.

**Workarounds:**

1. **Track and restore focus** (recommended for Phase 1):
```rust
// Before showing overlay, save foreground window
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

let previous_window = unsafe { GetForegroundWindow() };

// After paste, restore focus
use windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
unsafe { SetForegroundWindow(previous_window) };
```

2. **Set WS_EX_NOACTIVATE** (advanced):
```rust
use windows::Win32::UI::WindowsAndMessaging::*;

unsafe {
    let style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
    SetWindowLongW(hwnd, GWL_EXSTYLE, (style | WS_EX_NOACTIVATE.0) as i32);
}
```

### Dragging Support

```html
<div data-tauri-drag-region class="titlebar">
    Drag me
</div>
```

---

## 4. Audio Capture (cpal + hound)

### Whisper API Audio Requirements

| Property | Requirement |
|----------|-------------|
| Sample rate | 16 kHz (API resamples anyway) |
| Channels | Mono (stereo downmixed) |
| Bit depth | 16-bit PCM |
| Format | WAV, MP3, FLAC, etc. |
| Max size | 25 MB (OpenAI), 100 MB (Groq) |

### cpal: Audio Capture

```rust
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};

// Get default input device
let host = cpal::default_host();
let device = host.default_input_device()
    .expect("No input device available");

// Configure for Whisper: 16kHz mono i16
let config = cpal::StreamConfig {
    channels: 1,
    sample_rate: cpal::SampleRate(16000),
    buffer_size: cpal::BufferSize::Default,
};

// Shared buffer for samples
let samples: Arc<Mutex<Vec<i16>>> = Arc::new(Mutex::new(Vec::new()));
let samples_clone = Arc::clone(&samples);

// Build input stream
let stream = device.build_input_stream(
    &config,
    move |data: &[i16], _: &cpal::InputCallbackInfo| {
        if let Ok(mut buf) = samples_clone.lock() {
            buf.extend_from_slice(data);
        }
    },
    |err| eprintln!("Stream error: {}", err),
    None,
).unwrap();

stream.play().unwrap();  // Start recording
// ... recording happens ...
stream.pause().unwrap(); // Stop recording
```

### hound: WAV Encoding to Memory

```rust
use hound::{WavSpec, WavWriter, SampleFormat};
use std::io::Cursor;

let spec = WavSpec {
    channels: 1,
    sample_rate: 16000,
    bits_per_sample: 16,
    sample_format: SampleFormat::Int,
};

// Write to in-memory buffer (not file)
let mut wav_buffer = Vec::new();
{
    let mut writer = WavWriter::new(Cursor::new(&mut wav_buffer), spec)?;
    for &sample in samples.lock().unwrap().iter() {
        writer.write_sample(sample)?;
    }
    writer.finalize()?;
}

// wav_buffer now contains complete WAV file for API upload
```

### Complete Recording Flow

```rust
pub struct AudioRecorder {
    samples: Arc<Mutex<Vec<i16>>>,
    stream: Option<cpal::Stream>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            samples: Arc::new(Mutex::new(Vec::new())),
            stream: None,
        }
    }

    pub fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.samples.lock().unwrap().clear();

        let host = cpal::default_host();
        let device = host.default_input_device().ok_or("No input device")?;

        let config = cpal::StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(16000),
            buffer_size: cpal::BufferSize::Default,
        };

        let samples = Arc::clone(&self.samples);
        let stream = device.build_input_stream(
            &config,
            move |data: &[i16], _| {
                samples.lock().unwrap().extend_from_slice(data);
            },
            |err| eprintln!("Error: {}", err),
            None,
        )?;

        stream.play()?;
        self.stream = Some(stream);
        Ok(())
    }

    pub fn stop(&mut self) -> Vec<u8> {
        self.stream = None; // Drops and stops the stream

        let samples = self.samples.lock().unwrap();
        let spec = WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut wav_buffer = Vec::new();
        let mut writer = WavWriter::new(Cursor::new(&mut wav_buffer), spec).unwrap();
        for &sample in samples.iter() {
            writer.write_sample(sample).unwrap();
        }
        writer.finalize().unwrap();

        wav_buffer
    }
}
```

---

## 5. OpenAI-Compatible Transcription API

### Endpoints

| Provider | Endpoint | Max Size | Pricing |
|----------|----------|----------|---------|
| **OpenAI** | `https://api.openai.com/v1/audio/transcriptions` | 25 MB | Paid |
| **Groq** | `https://api.groq.com/openai/v1/audio/transcriptions` | 100 MB | Free tier |

### Request Format

```http
POST /v1/audio/transcriptions
Authorization: Bearer {API_KEY}
Content-Type: multipart/form-data

file: audio.wav
model: whisper-large-v3
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Audio file (WAV, MP3, etc.) |
| `model` | string | Model ID |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `language` | string | ISO-639-1 code (e.g., "en") |
| `prompt` | string | Guide transcription style |
| `response_format` | string | `json`, `text`, `srt`, `verbose_json`, `vtt` |
| `temperature` | float | 0-1, randomness |

### Response

```json
{
    "text": "Transcribed text here"
}
```

### Available Models

| Provider | Models |
|----------|--------|
| **OpenAI** | `whisper-1` |
| **Groq** | `whisper-large-v3`, `whisper-large-v3-turbo` |

### Rust Implementation with reqwest

```rust
use reqwest::multipart;

pub async fn transcribe(
    api_url: &str,
    api_key: &str,
    model: &str,
    audio_data: Vec<u8>,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let form = multipart::Form::new()
        .part("file", multipart::Part::bytes(audio_data)
            .file_name("audio.wav")
            .mime_str("audio/wav")?)
        .text("model", model.to_string());

    let response = client
        .post(api_url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        Ok(json["text"].as_str().unwrap_or("").to_string())
    } else {
        let status = response.status();
        let body = response.text().await?;
        Err(format!("API error {}: {}", status, body).into())
    }
}
```

### Error Handling

```rust
match response.status() {
    reqwest::StatusCode::OK => { /* success */ }
    reqwest::StatusCode::UNAUTHORIZED => {
        return Err("Invalid API key".into());
    }
    reqwest::StatusCode::PAYLOAD_TOO_LARGE => {
        return Err("Audio file too large (max 25MB)".into());
    }
    reqwest::StatusCode::TOO_MANY_REQUESTS => {
        return Err("Rate limited. Try again later.".into());
    }
    status => {
        return Err(format!("API error: {}", status).into());
    }
}
```

---

## 6. Clipboard & Auto-Paste

### arboard: Clipboard Write

```rust
use arboard::Clipboard;

fn copy_to_clipboard(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut clipboard = Clipboard::new()?;
    clipboard.set_text(text)?;
    Ok(())
}
```

### enigo: Simulate Ctrl+V

```rust
use enigo::{Direction::{Press, Release, Click}, Enigo, Key, Keyboard, Settings};

fn paste() -> Result<(), Box<dyn std::error::Error>> {
    let mut enigo = Enigo::new(&Settings::default())?;

    enigo.key(Key::Control, Press)?;
    enigo.key(Key::Unicode('v'), Click)?;
    enigo.key(Key::Control, Release)?;

    Ok(())
}
```

### Critical: Timing Between Clipboard and Paste

```rust
use std::thread;
use std::time::Duration;

fn copy_and_paste(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Write to clipboard
    let mut clipboard = Clipboard::new()?;
    clipboard.set_text(text)?;

    // 2. CRITICAL: Wait for clipboard to stabilize
    thread::sleep(Duration::from_millis(50));

    // 3. Simulate Ctrl+V
    let mut enigo = Enigo::new(&Settings::default())?;
    enigo.key(Key::Control, Press)?;
    enigo.key(Key::Unicode('v'), Click)?;
    enigo.key(Key::Control, Release)?;

    Ok(())
}
```

### Timing Recommendations

| Step | Delay | Notes |
|------|-------|-------|
| Before clipboard write | 0-100ms | Only if switching windows |
| **After clipboard write** | **50-100ms** | **CRITICAL** |
| Between keystrokes | 10-50ms | Usually not needed |

### Thread Safety (Windows)

Windows clipboard is globally locked. Serialize access:

```rust
use std::sync::Mutex;
use once_cell::sync::Lazy;

static CLIPBOARD_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

fn safe_copy_paste(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    let _guard = CLIPBOARD_LOCK.lock().unwrap();
    copy_and_paste(text)
}
```

---

## 7. Secure Credential Storage

### keyring Crate

Stores credentials in OS credential manager (Windows Credential Manager on Windows).

```rust
use keyring::Entry;

const SERVICE: &str = "dikt";

// Store API key
pub fn store_api_key(api_key: &str) -> Result<(), Box<dyn std::error::Error>> {
    let entry = Entry::new(SERVICE, "api-key")?;
    entry.set_password(api_key)?;
    Ok(())
}

// Retrieve API key
pub fn get_api_key() -> Result<Option<String>, Box<dyn std::error::Error>> {
    let entry = Entry::new(SERVICE, "api-key")?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None), // First run
        Err(e) => Err(e.into()),
    }
}

// Delete API key
pub fn delete_api_key() -> Result<(), Box<dyn std::error::Error>> {
    let entry = Entry::new(SERVICE, "api-key")?;
    entry.delete_credential()?;
    Ok(())
}
```

### Error Handling for First-Run

```rust
match get_api_key() {
    Ok(Some(key)) => {
        // Use existing key
    }
    Ok(None) => {
        // First run: prompt user for API key
        show_settings_screen();
    }
    Err(e) => {
        // Keyring error
        eprintln!("Credential error: {}", e);
    }
}
```

### Storage Pattern

| Field | Service | Username |
|-------|---------|----------|
| API Key | `dikt` | `api-key` |
| API URL | `dikt` | `api-url` |
| Model | `dikt` | `model` |

**Note:** For non-secret config (URL, model), consider using Tauri's Store plugin or a simple JSON file instead of keyring.

---

## 8. Recommended Architecture

### Project Structure

```
src-tauri/
├── src/
│   ├── main.rs           # Tauri entry point
│   ├── lib.rs            # Module exports
│   ├── audio.rs          # cpal + hound recording
│   ├── transcribe.rs     # API client
│   ├── clipboard.rs      # arboard + enigo paste
│   ├── settings.rs       # keyring + config
│   └── commands.rs       # Tauri commands
├── Cargo.toml
└── tauri.conf.json
```

### Data Flow

```
[User holds hotkey]
        ↓
[Tauri: ShortcutState::Pressed]
        ↓
[Show overlay "Recording..."]
        ↓
[Start cpal audio capture]
        ↓
[User releases hotkey]
        ↓
[Tauri: ShortcutState::Released]
        ↓
[Stop capture, encode to WAV]
        ↓
[Show overlay "Transcribing..."]
        ↓
[POST to transcription API]
        ↓
[Receive text response]
        ↓
[Copy to clipboard + Ctrl+V]
        ↓
[Show overlay "Done" (2s)]
        ↓
[Hide overlay]
```

### Tauri Commands

```rust
#[tauri::command]
async fn start_recording(state: State<'_, AppState>) -> Result<(), String> {
    state.recorder.lock().unwrap().start()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_and_transcribe(state: State<'_, AppState>) -> Result<String, String> {
    let wav_data = state.recorder.lock().unwrap().stop();

    let settings = state.settings.lock().unwrap();
    let text = transcribe(&settings.api_url, &settings.api_key, &settings.model, wav_data)
        .await
        .map_err(|e| e.to_string())?;

    copy_and_paste(&text).map_err(|e| e.to_string())?;

    Ok(text)
}

#[tauri::command]
fn save_settings(api_url: String, api_key: String, model: String) -> Result<(), String> {
    store_api_key(&api_key).map_err(|e| e.to_string())?;
    // Store URL and model in config file or keyring
    Ok(())
}

#[tauri::command]
fn get_settings() -> Result<Settings, String> {
    let api_key = get_api_key().map_err(|e| e.to_string())?;
    // Load URL and model
    Ok(Settings { api_url, api_key, model })
}

#[tauri::command]
async fn test_connection(api_url: String, api_key: String, model: String) -> Result<String, String> {
    // Send a tiny test request
    // Return success or error message
}
```

---

## 9. Dependencies Summary

### Cargo.toml

```toml
[dependencies]
# Tauri
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2"

# Audio
cpal = "0.15"
hound = "3.5"

# HTTP
reqwest = { version = "0.12", features = ["json", "multipart"] }

# Clipboard & Keyboard
arboard = "3"
enigo = "0.2"

# Credentials
keyring = { version = "3", features = ["windows-native"] }

# Async
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Utilities
once_cell = "1"
```

### package.json

```json
{
    "dependencies": {
        "solid-js": "^1.8",
        "@tauri-apps/api": "^2",
        "@tauri-apps/plugin-global-shortcut": "^2"
    },
    "devDependencies": {
        "tailwindcss": "^3.4",
        "vite": "^5",
        "vite-plugin-solid": "^2",
        "@tauri-apps/cli": "^2"
    }
}
```

---

## Key Decisions Summary

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Hold-to-talk** | Tauri global-shortcut plugin | Native Pressed/Released support |
| **Audio capture** | cpal @ 16kHz mono | Matches Whisper requirements |
| **WAV encoding** | hound to memory buffer | No temp files needed |
| **Transcription** | reqwest multipart POST | Standard, well-supported |
| **Clipboard** | arboard | Cross-platform, simple API |
| **Paste simulation** | enigo | Cross-platform, simple API |
| **Credentials** | keyring | OS-native secure storage |
| **Focus preservation** | Track + restore foreground window | Tauri's focused:false unreliable |

---

## Open Questions for Implementation

1. **Focus restoration**: Test if Tauri's overlay steals focus on Windows. If yes, implement GetForegroundWindow/SetForegroundWindow pattern.

2. **Audio device selection**: Phase 1 uses default device. Phase 2 could add device picker in settings.

3. **Error recovery**: What happens if transcription fails mid-recording? Show error in overlay, keep audio in memory for retry?

4. **Hotkey conflicts**: What if user's chosen hotkey is already taken? Show warning in settings.
