import { createSignal, onCleanup, onMount } from 'solid-js';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { Status, Tab, Settings, VocabularyEntry, DictationUpdate } from './types';
import {
  DEFAULT_SETTINGS,
  COLLAPSED_HEIGHT,
  PANEL_WIDTH,
  SETTINGS_PANEL_BOTTOM_OFFSET,
  MAX_VOCABULARY_ENTRIES,
  MAX_REPLACEMENTS_PER_ENTRY
} from './constants';
import { Pill, Tooltip, SettingsPanel } from './components';

const createVocabularyId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeVocabularyEntry = (entry: Partial<VocabularyEntry>): VocabularyEntry => {
  const replacements = Array.from(
    new Set(
      (entry.replacements ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  ).slice(0, MAX_REPLACEMENTS_PER_ENTRY);

  return {
    id: (entry.id ?? '').trim() || createVocabularyId(),
    word: (entry.word ?? '').trim(),
    replacements,
    enabled: entry.enabled ?? true
  };
};

const sanitizeVocabulary = (vocabulary: VocabularyEntry[]): VocabularyEntry[] => {
  return vocabulary
    .map((entry) => sanitizeVocabularyEntry(entry))
    .filter((entry) => entry.word.length > 0)
    .slice(0, MAX_VOCABULARY_ENTRIES);
};

export default function App() {
  // Core state
  const [status, setStatus] = createSignal<Status>('idle');
  const [text, setText] = createSignal('');
  const [error, setError] = createSignal('');
  const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS);

  // UI state
  const [showSettings, setShowSettings] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<Tab>('settings');
  const [isHovered, setIsHovered] = createSignal(false);
  const [testMessage, setTestMessage] = createSignal('');
  const [vocabularyMessage, setVocabularyMessage] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Vocabulary editor state
  const [isVocabularyEditorOpen, setIsVocabularyEditorOpen] = createSignal(false);
  const [editingVocabularyId, setEditingVocabularyId] = createSignal<string | null>(null);
  const [editorWord, setEditorWord] = createSignal('');
  const [editorReplacements, setEditorReplacements] = createSignal('');

  // Refs and flags
  let isHolding = false;
  let registeredHotkey = DEFAULT_SETTINGS.hotkey;
  let settingsPanelRef: HTMLDivElement | undefined;

  // Hotkey management
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
    if (settings().hotkey_mode === 'hold') {
      if (isHolding || status() === 'recording') return;
      isHolding = true;
      setError('');
      setStatus('recording');
      try {
        await invoke('start_recording');
      } catch (err) {
        isHolding = false;
        setStatus('error');
        setError(String(err));
      }
    } else {
      if (status() === 'recording') {
        setStatus('transcribing');
        try {
          const result = (await invoke<string>('stop_and_transcribe')) ?? '';
          if (result) setText(result);
          if (status() !== 'error') {
            setStatus('done');
            setTimeout(() => {
              if (status() === 'done') setStatus('idle');
            }, 1500);
          }
        } catch (err) {
          setStatus('error');
          setError(String(err));
        }
      } else if (status() === 'idle' || status() === 'done' || status() === 'error') {
        setError('');
        setStatus('recording');
        try {
          await invoke('start_recording');
        } catch (err) {
          setStatus('error');
          setError(String(err));
        }
      }
    }
  };

  const handleReleased = async () => {
    if (settings().hotkey_mode !== 'hold') return;
    if (!isHolding) return;
    isHolding = false;
    setStatus('transcribing');
    try {
      const result = (await invoke<string>('stop_and_transcribe')) ?? '';
      if (result) setText(result);
      if (status() !== 'error') {
        setStatus('done');
        setTimeout(() => {
          if (status() === 'done') setStatus('idle');
        }, 1500);
      }
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  };

  // Settings management
  const loadSettings = async () => {
    try {
      const result = await invoke<Settings>('get_settings');
      const merged = { ...DEFAULT_SETTINGS, ...result };
      const vocabulary = sanitizeVocabulary(Array.isArray(merged.vocabulary) ? merged.vocabulary : []);
      setSettings({ ...merged, vocabulary });
      await registerHotkey(merged.hotkey);
    } catch (err) {
      setError(String(err));
      await registerHotkey(DEFAULT_SETTINGS.hotkey);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setTestMessage('');
    setVocabularyMessage('');
    try {
      const sanitizedSettings = {
        ...settings(),
        vocabulary: sanitizeVocabulary(settings().vocabulary)
      };
      await invoke('save_settings', { settings: sanitizedSettings });
      setSettings(sanitizedSettings);
      await registerHotkey(sanitizedSettings.hotkey);
      setTestMessage('Settings saved.');
      await toggleSettings();
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
    if (showSettings()) {
      await resizeWindowToFitSettings();
    }
  };

  // Window resize
  const resizeWindowToFitSettings = async () => {
    if (!settingsPanelRef) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const panelHeight = settingsPanelRef.offsetHeight;
    const windowHeight = panelHeight + SETTINGS_PANEL_BOTTOM_OFFSET;
    try {
      await invoke('resize_window', { width: PANEL_WIDTH, height: windowHeight });
    } catch (err) {
      console.error('Failed to resize window:', err);
    }
  };

  const toggleSettings = async () => {
    const expanded = !showSettings();
    setShowSettings(expanded);
    setIsHovered(false);
    if (expanded) {
      await resizeWindowToFitSettings();
    } else {
      setActiveTab('settings');
      setVocabularyMessage('');
      setIsVocabularyEditorOpen(false);
      setEditingVocabularyId(null);
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        await invoke('resize_window', { width: PANEL_WIDTH, height: COLLAPSED_HEIGHT });
      } catch (err) {
        console.error('Failed to resize window:', err);
      }
    }
  };

  const switchToTab = (tab: Tab) => {
    setActiveTab(tab);
    setTestMessage('');
    setVocabularyMessage('');
  };

  // Vocabulary management
  const persistVocabulary = async (nextVocabulary: VocabularyEntry[], message?: string) => {
    const sanitizedVocabulary = sanitizeVocabulary(nextVocabulary);
    try {
      await invoke('save_vocabulary', { vocabulary: sanitizedVocabulary });
      setSettings((current) => ({ ...current, vocabulary: sanitizedVocabulary }));
      if (message) setVocabularyMessage(message);
      return true;
    } catch (err) {
      setVocabularyMessage(String(err));
      return false;
    }
  };

  const openCreateVocabularyEditor = () => {
    if (settings().vocabulary.length >= MAX_VOCABULARY_ENTRIES) {
      setVocabularyMessage(`Maximum ${MAX_VOCABULARY_ENTRIES} entries reached.`);
      return;
    }
    setEditingVocabularyId(null);
    setEditorWord('');
    setEditorReplacements('');
    setVocabularyMessage('');
    setIsVocabularyEditorOpen(true);
  };

  const openEditVocabularyEditor = (entry: VocabularyEntry) => {
    setEditingVocabularyId(entry.id);
    setEditorWord(entry.word);
    setEditorReplacements(entry.replacements.join('\n'));
    setVocabularyMessage('');
    setIsVocabularyEditorOpen(true);
  };

  const cancelVocabularyEditor = () => {
    setEditingVocabularyId(null);
    setEditorWord('');
    setEditorReplacements('');
    setVocabularyMessage('');
    setIsVocabularyEditorOpen(false);
  };

  const saveVocabularyEntry = async () => {
    const word = editorWord().trim();
    if (!word) {
      setVocabularyMessage('Word is required.');
      return;
    }

    const replacements = Array.from(
      new Set(
        editorReplacements()
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      )
    ).slice(0, MAX_REPLACEMENTS_PER_ENTRY);

    const editingId = editingVocabularyId();
    const existingEntry = settings().vocabulary.find((entry) => entry.id === editingId);

    const nextEntry = sanitizeVocabularyEntry({
      id: editingId ?? createVocabularyId(),
      word,
      replacements,
      enabled: existingEntry?.enabled ?? true
    });

    const nextVocabulary = editingId
      ? settings().vocabulary.map((entry) => (entry.id === editingId ? nextEntry : entry))
      : [...settings().vocabulary, nextEntry];
    const saved = await persistVocabulary(nextVocabulary, 'Vocabulary entry saved.');
    if (!saved) return;

    setIsVocabularyEditorOpen(false);
    setEditingVocabularyId(null);
    setEditorWord('');
    setEditorReplacements('');
  };

  const deleteVocabularyEntry = async (id: string) => {
    const nextVocabulary = settings().vocabulary.filter((entry) => entry.id !== id);
    const saved = await persistVocabulary(nextVocabulary, 'Vocabulary entry deleted.');
    if (!saved) return;
    if (editingVocabularyId() === id) cancelVocabularyEditor();
  };

  const toggleVocabularyEntryEnabled = async (id: string) => {
    const nextVocabulary = settings().vocabulary.map((entry) =>
      entry.id === id ? { ...entry, enabled: !entry.enabled } : entry
    );
    const saved = await persistVocabulary(nextVocabulary);
    if (!saved) return;
    setVocabularyMessage('');
  };

  // Drag handler
  const startDrag = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea')) return;
    e.preventDefault();
    await getCurrentWindow().startDragging();
  };

  // Computed
  const isActive = () =>
    status() === 'recording' || status() === 'transcribing' || status() === 'pasting';

  // Lifecycle
  onMount(async () => {
    await loadSettings();

    let resizeObserver: ResizeObserver | undefined;
    if (settingsPanelRef) {
      resizeObserver = new ResizeObserver(() => {
        if (showSettings()) {
          void resizeWindowToFitSettings();
        }
      });
      resizeObserver.observe(settingsPanelRef);
    }

    const unlistenSettings = await listen('show-settings', async () => {
      if (!showSettings()) {
        await toggleSettings();
      }
      setActiveTab('settings');
    });

    const unlistenDictation = await listen<DictationUpdate>('dictation:update', (event) => {
      const payload = event.payload;
      switch (payload.state) {
        case 'recording': {
          if (!isHolding) break;
          setError('');
          setStatus('recording');
          break;
        }
        case 'transcribing': {
          setError('');
          setStatus('transcribing');
          break;
        }
        case 'pasting': {
          setError('');
          setStatus('pasting');
          break;
        }
        case 'done': {
          isHolding = false;
          if (payload.text != null) setText(payload.text);
          setStatus('done');
          setTimeout(() => {
            if (status() === 'done') setStatus('idle');
          }, 1500);
          break;
        }
        case 'error': {
          isHolding = false;
          setStatus('error');
          setError(payload.message ?? 'Error');
          break;
        }
        case 'idle':
        default: {
          isHolding = false;
          setStatus('idle');
          break;
        }
      }
    });

    onCleanup(() => {
      void unlistenSettings();
      void unlistenDictation();
      resizeObserver?.disconnect();
    });
  });

  onCleanup(() => {
    void unregister(registeredHotkey);
  });

  return (
    <div class="app-container">
      <SettingsPanel
        visible={showSettings}
        activeTab={activeTab}
        settings={settings}
        setSettings={setSettings}
        testMessage={testMessage}
        vocabularyMessage={vocabularyMessage}
        saving={saving}
        isVocabularyEditorOpen={isVocabularyEditorOpen}
        editorWord={editorWord}
        setEditorWord={setEditorWord}
        editorReplacements={editorReplacements}
        setEditorReplacements={setEditorReplacements}
        onCollapse={toggleSettings}
        onTabChange={switchToTab}
        onTest={testConnection}
        onSave={saveSettings}
        onVocabularyOpenCreate={openCreateVocabularyEditor}
        onVocabularyEdit={openEditVocabularyEditor}
        onVocabularySave={saveVocabularyEntry}
        onVocabularyCancel={cancelVocabularyEditor}
        onVocabularyToggleEnabled={toggleVocabularyEntryEnabled}
        onVocabularyDelete={deleteVocabularyEntry}
        ref={(el) => {
          settingsPanelRef = el;
        }}
      />

      <Tooltip
        visible={isHovered() && !isActive() && !showSettings()}
        hotkey={settings().hotkey}
        hotkeyMode={settings().hotkey_mode}
      />

      <Pill
        status={status}
        isHovered={isHovered}
        showSettings={showSettings}
        settings={settings}
        error={error}
        onMouseDown={startDrag}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onSettingsClick={toggleSettings}
      />
    </div>
  );
}
