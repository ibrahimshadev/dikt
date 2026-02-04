import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Status, Settings } from '../../types';
import IdleDots from './IdleDots';
import SineWaves from './SineWaves';
import LoadingDots from './LoadingDots';
import GearButton from './GearButton';

type PillProps = {
  status: Accessor<Status>;
  isHovered: Accessor<boolean>;
  showSettings: Accessor<boolean>;
  settings: Accessor<Settings>;
  error: Accessor<string>;
  onMouseDown: (e: MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSettingsClick: () => void;
};

export function formatHotkey(hotkey: string): string {
  return hotkey
    .replace('Control+Super', 'Ctrl + Win')
    .replace('CommandOrControl', 'Ctrl')
    .replace('Control', 'Ctrl')
    .replace('Super', 'Win')
    .replace(/\+/g, ' + ');
}

export default function Pill(props: PillProps) {
  const isActive = () =>
    props.status() === 'recording' || props.status() === 'transcribing' || props.status() === 'pasting';

  return (
    <div
      class="pill"
      classList={{
        expanded: (props.isHovered() || isActive()) && !props.showSettings(),
        recording: props.status() === 'recording',
        transcribing: props.status() === 'transcribing' || props.status() === 'pasting'
      }}
      onMouseDown={props.onMouseDown}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      <Show when={props.status() === 'idle' && (!props.isHovered() || props.showSettings())}>
        <IdleDots />
      </Show>

      <Show when={props.status() === 'idle' && props.isHovered() && !props.showSettings()}>
        <span class="hotkey-text">{formatHotkey(props.settings().hotkey)}</span>
        <GearButton onClick={props.onSettingsClick} />
      </Show>

      <Show when={props.status() === 'recording'}>
        <SineWaves />
      </Show>

      <Show when={props.status() === 'transcribing' || props.status() === 'pasting'}>
        <LoadingDots />
      </Show>

      <Show when={props.status() === 'done'}>
        <svg class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </Show>

      <Show when={props.status() === 'error'}>
        <span class="error-icon" title={props.error()}>!</span>
        <Show when={props.isHovered()}>
          <GearButton onClick={props.onSettingsClick} />
        </Show>
      </Show>
    </div>
  );
}
