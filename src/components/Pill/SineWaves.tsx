import { onMount, onCleanup } from 'solid-js';
import SiriWave from 'siriwave';

export default function SineWaves() {
  let container: HTMLDivElement | undefined;
  let wave: SiriWave | undefined;

  onMount(() => {
    if (container) {
      wave = new SiriWave({
        container,
        width: 90,
        height: 35,
        style: 'ios9',
        speed: 0.06,
        amplitude: 4,
        autostart: true,
      });
    }
  });

  onCleanup(() => {
    wave?.dispose();
  });

  return <div ref={container} class="sine-waves-container" />;
}
