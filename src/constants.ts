import type { Provider, Settings } from './types';

export const PROVIDERS: Record<Provider, { label: string; base_url: string; models: string[] }> = {
  groq: {
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    models: ['whisper-large-v3-turbo', 'whisper-large-v3', 'distil-whisper-large-v3-en']
  },
  openai: {
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1']
  },
  custom: {
    label: 'Custom',
    base_url: '',
    models: []
  }
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'groq',
  base_url: PROVIDERS.groq.base_url,
  model: PROVIDERS.groq.models[0],
  hotkey: 'CommandOrControl+Space',
  hotkey_mode: 'hold',
  api_key: '',
  vocabulary: []
};

export const COLLAPSED_HEIGHT = 100;
export const PANEL_WIDTH = 320;
export const SETTINGS_PANEL_BOTTOM_OFFSET = 48;
export const MAX_VOCABULARY_ENTRIES = 100;
export const MAX_REPLACEMENTS_PER_ENTRY = 10;
