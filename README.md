# Dikt

A minimalist voice-to-text application. Hold a hotkey, speak, and your words are transcribed and pasted into any app.

## Quick Start

1. Download the latest release for your platform
2. Run the app
3. Configure your API key in Settings:
   - **Groq** (free): Get a key at [console.groq.com](https://console.groq.com)
   - **OpenAI** (paid): Get a key at [platform.openai.com](https://platform.openai.com)
4. Hold your hotkey (default: `Ctrl+Space`) and speak
5. Release to transcribe and auto-paste

## Features

### Voice Transcription

Hold your hotkey, speak, release. Dikt records audio from your microphone, sends it to an OpenAI-compatible transcription API, and pastes the result into whatever app has focus. The entire flow happens in a few seconds.

Two hotkey modes are available:
- **Hold to talk** (default) — hold the hotkey while speaking, release to transcribe
- **Press to toggle** — press once to start recording, press again to stop and transcribe

Output can be configured to either paste directly (preserving your existing clipboard) or paste and copy the transcription to the clipboard.

### Modes

Modes let you run a second LLM call on the transcribed text before it gets pasted. Each mode has a name, a system prompt, and a chat model. The transcription is sent as the user message, and the LLM's response replaces the raw transcription.

Two starter modes are included:
- **Grammar & Punctuation** — fixes grammar, spelling, and punctuation while preserving meaning
- **Email Draft** — rewrites dictation as a professional email body

You can create custom modes with any system prompt. Activate a mode to use it, or deactivate all modes to paste raw transcriptions. The model list is fetched live from your provider's `/models` endpoint.

### Vocabulary

Define custom word replacements for terms the transcription model frequently gets wrong. Each vocabulary entry maps a word to one or more replacement patterns. When any replacement appears in the transcribed text, it gets corrected to the target word.

Useful for names, technical jargon, or domain-specific terms that speech-to-text models struggle with. Entries can be individually enabled or disabled without deleting them.

### History

Every transcription is saved locally with a timestamp. The History tab shows recent transcriptions with relative timestamps (e.g. "5m ago") and exact times on hover. You can copy any past transcription to the clipboard or delete individual entries. A "Clear all" option removes the entire history.

### Floating Overlay

A minimal glassmorphism pill sits at the bottom of your screen showing the current state: recording, transcribing, formatting (when a mode is active), or done. It stays on top of all windows and passes through mouse clicks when not hovered.

### System Tray

Dikt minimizes to the system tray. Right-click for quick access to Settings, Reset Position, or Quit. Left-click toggles the overlay visibility.

## Supported Providers

| Provider | API URL | Pricing |
|----------|---------|---------|
| Groq | `https://api.groq.com/openai/v1` | Free tier available |
| OpenAI | `https://api.openai.com/v1` | Pay per use |
| Custom | Any OpenAI-compatible endpoint | Varies |

Dikt uses the OpenAI-compatible API format. Any provider that supports `/audio/transcriptions` (for speech-to-text) and `/chat/completions` (for modes) will work with the Custom provider option.

## Security & Data Storage

- **Audio** is recorded locally and sent to your configured API endpoint for transcription. No audio is stored on disk.
- **Transcription history** is stored in a local JSON file alongside settings.
- **Paste behavior**: Dikt writes the transcript to the system clipboard and triggers paste (`Ctrl+V` on Windows/Linux, `Cmd+V` on macOS). Clipboard managers may record these changes.
- **Settings** (provider, base URL, model, hotkey, vocabulary, modes) are stored in a local JSON file:
  - Windows: `%APPDATA%\dikt\settings.json`
  - Linux/macOS: `$XDG_CONFIG_HOME/dikt/settings.json` (or `~/.config/dikt/settings.json`)
- **API key** is stored using the OS credential manager via `keyring` when available. If unavailable, Dikt falls back to an obfuscated value in `settings.json`. This is not strong encryption.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- Platform-specific dependencies:

**Windows:**
- Visual Studio Build Tools with C++ workload

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux (Ubuntu/Debian):**
```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libasound2-dev \
  libssl-dev \
  libxdo-dev
```

### Run in Development

```bash
npm install
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

### Tech Stack

- **Framework**: [Tauri 2.x](https://tauri.app/)
- **Frontend**: [SolidJS](https://solidjs.com/) + CSS
- **Backend**: Rust
- **Audio**: [cpal](https://github.com/RustAudio/cpal)
- **Transcription**: OpenAI Whisper API (cloud)
- **Formatting**: OpenAI-compatible Chat Completions API (cloud)

## License

MIT
