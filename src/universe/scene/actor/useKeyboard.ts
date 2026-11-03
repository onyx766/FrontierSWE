'use client';

import { useEffect } from 'react';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import {
  axesFromKeys,
  commandFor,
  heldKeyFor,
  isActivatable,
  isActivationKey,
  isArrowKey,
  isBrowserChord,
  isRunHeld,
  isTextEntry,
  type KeyCommand,
  type KeyTarget,
} from './keys';
import type { ActorLink } from './link';

function perform(command: KeyCommand, link: ActorLink): void {
  const store = useUniverse.getState();

  switch (command) {
    case 'jump':
      runtime.input.jump = true;
      break;
    case 'advance':
      if (store.active) store.nextBeat();
      else store.reopenBriefing();
      break;
    case 'previous':
      store.previousBeat();
      break;
    case 'escape':
      if (store.active) {
        store.closeBriefing();
      } else {
        link.recenter = true;
        store.overview();
      }
      break;
    case 'tour':
      if (store.touring) store.stopTour();
      else store.startTour();
      break;
    case 'overview':
      link.recenter = true;
      store.overview();
      break;
    case 'help':
      store.toggleHelp();
      break;
  }
}

/** Routes the keyboard into the world, on `window`, so it works with nothing focused. */
export function useKeyboard(link: ActorLink): void {
  useEffect(() => {
    const held = new Set<string>();

    const publish = () => {
      const axes = axesFromKeys(held);
      runtime.input.moveX = axes.x;
      runtime.input.moveY = axes.y;
      runtime.input.run = isRunHeld(held);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isBrowserChord(event)) return;
      const target = event.target as KeyTarget | null;
      if (isTextEntry(target)) return;

      if (heldKeyFor(event.code)) {
        held.add(event.code);
        publish();
        if (isArrowKey(event.code)) event.preventDefault();
        return;
      }

      const command = commandFor(event.code, event.key);
      if (!command) return;
      if (isActivationKey(event.code) && isActivatable(target)) return;

      /* Held Space must not scroll the page, and must not repeat the command. */
      if (command === 'jump') event.preventDefault();
      if (!event.repeat) perform(command, link);
    };

    /* Always honoured: a key that went down must come up, wherever focus has gone. */
    const onKeyUp = (event: KeyboardEvent) => {
      if (held.delete(event.code)) publish();
    };

    const onBlur = () => {
      held.clear();
      publish();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [link]);
}
