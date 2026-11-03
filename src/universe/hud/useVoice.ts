'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useUniverse } from '../state/store';
import { world } from '../world/world';

const noSubscription = () => () => {};

/** False on the server and until hydration, so the toggle never flashes. */
export function useVoiceAvailable(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => 'speechSynthesis' in window,
    () => false,
  );
}

/**
 * Reads the current beat aloud while the voice is on. It listens to the store
 * directly, because nothing here needs to render: a change of station, of beat
 * or of the toggle simply cancels what was being said and starts the new line.
 */
export function useVoice(): void {
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synthesis = window.speechSynthesis;

    const stop = useUniverse.subscribe(
      (state) => `${state.voice}|${state.active}|${state.beat}`,
      () => {
        synthesis.cancel();
        const { voice, active, beat } = useUniverse.getState();
        if (!voice || !active) return;
        const line = world.briefing(active).beats[beat]?.speech;
        if (line) synthesis.speak(new SpeechSynthesisUtterance(line));
      },
    );

    return () => {
      stop();
      synthesis.cancel();
    };
  }, []);
}
