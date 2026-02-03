import { createSignal, onCleanup, onMount } from 'solid-js';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';

const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space';

type Status = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export default function App() {
  const [status, setStatus] = createSignal<Status>('idle');
  const [text, setText] = createSignal('');
  const [error, setError] = createSignal('');

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

  onMount(async () => {
    await register(DEFAULT_HOTKEY, (event) => {
      if (event.state === 'Pressed') {
        void handlePressed();
      } else if (event.state === 'Released') {
        void handleReleased();
      }
    });
  });

  onCleanup(() => {
    void unregister(DEFAULT_HOTKEY);
  });

  return (
    <div class="overlay">
      <div class="card">
        {status() === 'idle' && <div class="muted">Hold {DEFAULT_HOTKEY} to talk</div>}
        {status() === 'recording' && (
          <div class="row">
            <span class="dot" />
            <span>Recording...</span>
          </div>
        )}
        {status() === 'transcribing' && <div class="row">Transcribing...</div>}
        {status() === 'done' && <div class="row">{text() || 'Done'}</div>}
        {status() === 'error' && <div class="error">{error() || 'Error'}</div>}
      </div>
    </div>
  );
}
