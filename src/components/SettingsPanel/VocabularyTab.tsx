import { Show, For } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { VocabularyEntry as VocabularyEntryType } from '../../types';
import { MAX_VOCABULARY_ENTRIES } from '../../constants';
import VocabularyEntry from './VocabularyEntry';
import VocabularyEditor from './VocabularyEditor';

type VocabularyTabProps = {
  vocabulary: VocabularyEntryType[];
  message: Accessor<string>;
  isEditorOpen: Accessor<boolean>;
  editorWord: Accessor<string>;
  setEditorWord: Setter<string>;
  editorReplacements: Accessor<string>;
  setEditorReplacements: Setter<string>;
  onOpenCreate: () => void;
  onEdit: (entry: VocabularyEntryType) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleEnabled: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function VocabularyTab(props: VocabularyTabProps) {
  return (
    <div class="settings-content vocabulary-content">
      <Show when={props.message()}>
        <div class="muted">{props.message()}</div>
      </Show>

      <Show
        when={props.isEditorOpen()}
        fallback={
          <>
            <Show
              when={props.vocabulary.length > 0}
              fallback={<div class="muted">No vocabulary yet. Add terms you frequently dictate.</div>}
            >
              <div class="vocabulary-list">
                <For each={props.vocabulary}>
                  {(entry) => (
                    <VocabularyEntry
                      entry={entry}
                      onToggleEnabled={props.onToggleEnabled}
                      onEdit={props.onEdit}
                      onDelete={props.onDelete}
                    />
                  )}
                </For>
              </div>
            </Show>

            <button
              class="button ghost wide"
              onClick={props.onOpenCreate}
              disabled={props.vocabulary.length >= MAX_VOCABULARY_ENTRIES}
              type="button"
            >
              + Add word
            </button>
          </>
        }
      >
        <VocabularyEditor
          word={props.editorWord}
          setWord={props.setEditorWord}
          replacements={props.editorReplacements}
          setReplacements={props.setEditorReplacements}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      </Show>
    </div>
  );
}
