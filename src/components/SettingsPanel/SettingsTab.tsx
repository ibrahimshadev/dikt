import { Show } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { Settings, Provider } from '../../types';
import { PROVIDERS } from '../../constants';

type SettingsTabProps = {
  settings: Accessor<Settings>;
  setSettings: Setter<Settings>;
  testMessage: Accessor<string>;
  saving: Accessor<boolean>;
  onTest: () => void;
  onSave: () => void;
};

export default function SettingsTab(props: SettingsTabProps) {
  const onField = (key: 'base_url' | 'model' | 'hotkey' | 'hotkey_mode' | 'api_key') => (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    props.setSettings((current) => ({ ...current, [key]: target.value }));
  };

  const onProviderChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    const provider = target.value as Provider;
    const config = PROVIDERS[provider];
    props.setSettings((current) => ({
      ...current,
      provider,
      base_url: config.base_url,
      model: config.models[0] ?? ''
    }));
  };

  return (
    <div class="settings-content">
      <label class="field">
        <span>Provider</span>
        <select value={props.settings().provider} onChange={onProviderChange}>
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label class="field">
        <span>Base URL</span>
        <input
          value={props.settings().base_url}
          onInput={onField('base_url')}
          placeholder="https://api.groq.com/openai/v1"
        />
      </label>
      <label class="field">
        <span>Model</span>
        <Show
          when={props.settings().provider !== 'custom'}
          fallback={<input value={props.settings().model} onInput={onField('model')} placeholder="model-name" />}
        >
          <select value={props.settings().model} onChange={onField('model')}>
            {PROVIDERS[props.settings().provider].models.map((model) => (
              <option value={model}>{model}</option>
            ))}
          </select>
        </Show>
      </label>
      <label class="field">
        <span>API Key</span>
        <input
          type="password"
          value={props.settings().api_key}
          onInput={onField('api_key')}
          placeholder="sk-..."
        />
      </label>
      <label class="field">
        <span>Hotkey</span>
        <input value={props.settings().hotkey} onInput={onField('hotkey')} />
      </label>
      <label class="field">
        <span>Mode</span>
        <select value={props.settings().hotkey_mode} onChange={onField('hotkey_mode')}>
          <option value="hold">Hold to talk</option>
          <option value="lock">Press to toggle</option>
        </select>
      </label>

      <Show when={!props.settings().api_key}>
        <div class="warning">Missing API key</div>
      </Show>

      <Show when={props.testMessage()}>
        <div class="muted">{props.testMessage()}</div>
      </Show>

      <div class="actions">
        <button class="button ghost" onClick={props.onTest} type="button">
          Test
        </button>
        <button class="button" disabled={props.saving()} onClick={props.onSave} type="button">
          Save
        </button>
      </div>
    </div>
  );
}
