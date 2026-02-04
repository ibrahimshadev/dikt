import type { VocabularyEntry as VocabularyEntryType } from '../../types';

type VocabularyEntryProps = {
  entry: VocabularyEntryType;
  onToggleEnabled: (id: string) => void;
  onEdit: (entry: VocabularyEntryType) => void;
  onDelete: (id: string) => void;
};

export default function VocabularyEntry(props: VocabularyEntryProps) {
  return (
    <div class="vocabulary-entry" classList={{ disabled: !props.entry.enabled }}>
      <div class="vocabulary-entry-main">
        <span class="vocabulary-word">{props.entry.word}</span>
        <span class="vocabulary-meta">{props.entry.replacements.length} replacement(s)</span>
      </div>
      <div class="vocabulary-entry-actions">
        <button
          class="mini-button"
          onClick={() => props.onToggleEnabled(props.entry.id)}
          type="button"
        >
          {props.entry.enabled ? 'On' : 'Off'}
        </button>
        <button class="mini-button" onClick={() => props.onEdit(props.entry)} type="button">
          Edit
        </button>
        <button
          class="mini-button danger"
          onClick={() => props.onDelete(props.entry.id)}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
