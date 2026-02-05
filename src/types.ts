export type Status = 'idle' | 'recording' | 'transcribing' | 'pasting' | 'done' | 'error';
export type Tab = 'settings' | 'vocabulary';
export type Provider = 'groq' | 'openai' | 'custom';
export type HotkeyMode = 'hold' | 'lock';

export type VocabularyEntry = {
  id: string;
  word: string;
  replacements: string[];
  enabled: boolean;
};

export type Settings = {
  provider: Provider;
  base_url: string;
  model: string;
  hotkey: string;
  hotkey_mode: HotkeyMode;
  copy_to_clipboard_on_success: boolean;
  api_key: string;
  vocabulary: VocabularyEntry[];
};

export type DictationUpdate = {
  state: 'idle' | 'recording' | 'transcribing' | 'pasting' | 'done' | 'error';
  message?: string;
  text?: string;
};
