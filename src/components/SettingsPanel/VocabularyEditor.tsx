import type { Accessor, Setter } from 'solid-js';
import { MAX_REPLACEMENTS_PER_ENTRY } from '../../constants';

type VocabularyEditorProps = {
  word: Accessor<string>;
  setWord: Setter<string>;
  replacements: Accessor<string>;
  setReplacements: Setter<string>;
  onSave: () => void;
  onCancel: () => void;
};

export default function VocabularyEditor(props: VocabularyEditorProps) {
  return (
    <div class="vocabulary-editor">
      <label class="field">
        <span>Word</span>
        <input
          value={props.word()}
          onInput={(event) => props.setWord((event.target as HTMLInputElement).value)}
          placeholder="Kubernetes"
        />
      </label>

      <label class="field">
        <span>Replacements (one per line)</span>
        <textarea
          value={props.replacements()}
          onInput={(event) => props.setReplacements((event.target as HTMLTextAreaElement).value)}
          rows={5}
          placeholder="cube and eighties\nkuber nettis"
        />
      </label>

      <div class="muted">
        Up to {MAX_REPLACEMENTS_PER_ENTRY} replacements. Matching is case-insensitive and word-boundary based.
      </div>

      <div class="actions">
        <button class="button ghost" onClick={props.onCancel} type="button">
          Cancel
        </button>
        <button class="button" onClick={props.onSave} type="button">
          Save Entry
        </button>
      </div>
    </div>
  );
}
