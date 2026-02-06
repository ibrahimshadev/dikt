import { Show, For } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { TranscriptionHistoryItem } from '../../types';

type HistoryTabProps = {
  history: Accessor<TranscriptionHistoryItem[]>;
  message: Accessor<string>;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
};

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatExactTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

export default function HistoryTab(props: HistoryTabProps) {
  const handleClearAll = () => {
    if (window.confirm('Clear all transcription history?')) {
      props.onClearAll();
    }
  };

  return (
    <div class="settings-content history-content">
      <Show when={props.message()}>
        <div class="muted">{props.message()}</div>
      </Show>

      <Show
        when={props.history().length > 0}
        fallback={<div class="muted">No transcriptions yet. History will appear here after dictating.</div>}
      >
        <div class="history-header-row">
          <span class="muted">{props.history().length} {props.history().length !== 1 ? 'entries' : 'entry'}</span>
          <button class="mini-button danger" onClick={handleClearAll} type="button">
            Clear all
          </button>
        </div>

        <div class="history-list">
          <For each={props.history()}>
            {(item) => (
              <div class="history-entry">
                <div class="history-entry-main">
                  <div class="history-text">{item.text}</div>
                  <div class="history-meta" title={formatExactTime(item.created_at_ms)}>
                    {timeAgo(item.created_at_ms)}
                  </div>
                </div>
                <div class="history-entry-actions">
                  <button
                    class="mini-button"
                    onClick={() => props.onCopy(item.text)}
                    title="Copy"
                    type="button"
                  >
                    Copy
                  </button>
                  <button
                    class="mini-button danger"
                    onClick={() => props.onDelete(item.id)}
                    title="Delete"
                    type="button"
                  >
                    Del
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
