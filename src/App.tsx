import { createSignal, onCleanup, onMount } from 'solid-js';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';

type Status = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

type Settings = {
  base_url: string;
  model: string;
  hotkey: string;
  api_key: string;
};

const DEFAULT_SETTINGS: Settings = {
  base_url: 'https://api.openai.com/v1',
  model: 'whisper-1',
  hotkey: 'CommandOrControl+Shift+Space',
  api_key: ''
};

export default function App() {
  const [status, setStatus] = createSignal<Status>('idle');
  const [text, setText] = createSignal('');
  const [error, setError] = createSignal('');
  const [showSettings, setShowSettings] = createSignal(false);
  const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS);
  const [testMessage, setTestMessage] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  let registeredHotkey = DEFAULT_SETTINGS.hotkey;

  const registerHotkey = async (hotkey: string) => {
    if (registeredHotkey) {
      await unregister(registeredHotkey).catch(() => {});
    }
    await register(hotkey, (event) => {
      if (event.state === 'Pressed') {
        void handlePressed();
      } else if (event.state === 'Released') {
        void handleReleased();
      }
    });
    registeredHotkey = hotkey;
  };

  const handlePressed = async () => {
    if (status() === 'recording') return;
    setError('');
    setStatus('recording');
    try {
      await invoke('start_recording');
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  };

  const handleReleased = async () => {
    if (status() !== 'recording') return;
    setStatus('transcribing');
    try {
      const result = (await invoke<string>('stop_and_transcribe')) ?? '';
      setText(result);
      setStatus('done');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  };

  const loadSettings = async () => {
    try {
      const result = await invoke<Settings>('get_settings');
      const merged = { ...DEFAULT_SETTINGS, ...result };
      setSettings(merged);
      await registerHotkey(merged.hotkey);
    } catch (err) {
      setError(String(err));
      await registerHotkey(DEFAULT_SETTINGS.hotkey);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setTestMessage('');
    try {
      await invoke('save_settings', { settings: settings() });
      await registerHotkey(settings().hotkey);
      setTestMessage('Settings saved.');
      setShowSettings(false);
    } catch (err) {
      setTestMessage(String(err));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestMessage('');
    try {
      const message = await invoke<string>('test_connection', { settings: settings() });
      setTestMessage(message);
    } catch (err) {
      setTestMessage(String(err));
    }
  };

  onMount(() => {
    void loadSettings();
  });

  onCleanup(() => {
    void unregister(registeredHotkey);
  });

  const onField = (key: keyof Settings) => (event: Event) => {
    const target = event.target as HTMLInputElement;
    setSettings((current) => ({ ...current, [key]: target.value }));
  };

  return (
    <div class="overlay">
      <div class="card">
        {showSettings() ? (
          <div class="settings">
            <div class="title">Settings</div>
            <label class="field">
              <span>Base URL</span>
              <input
                value={settings().base_url}
                onInput={onField('base_url')}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label class="field">
              <span>Model</span>
              <input value={settings().model} onInput={onField('model')} placeholder="whisper-1" />
            </label>
            <label class="field">
              <span>API Key</span>
              <input
                type="password"
                value={settings().api_key}
                onInput={onField('api_key')}
                placeholder="sk-..."
              />
            </label>
            <label class="field">
              <span>Hotkey</span>
              <input value={settings().hotkey} onInput={onField('hotkey')} />
            </label>
            {testMessage() && <div class="muted">{testMessage()}</div>}
            <div class="actions">
              <button class="button ghost" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button class="button ghost" onClick={testConnection}>
                Test
              </button>
              <button class="button" disabled={saving()} onClick={saveSettings}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div class="status">
            {status() === 'idle' && (
              <div class="stack">
                <div class="muted">Hold {settings().hotkey} to talk</div>
                {!settings().api_key && (
                  <div class="warning">Missing API key. Open Settings.</div>
                )}
              </div>
            )}
            {status() === 'recording' && (
              <div class="row">
                <span class="dot" />
                <span>Recording...</span>
              </div>
            )}
            {status() === 'transcribing' && <div class="row">Transcribing...</div>}
            {status() === 'done' && <div class="row">{text() || 'Done'}</div>}
            {status() === 'error' && <div class="error">{error() || 'Error'}</div>}
            <button class="button ghost" onClick={() => setShowSettings(true)}>
              Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
