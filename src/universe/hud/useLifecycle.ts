'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useUniverse } from '../state/store';

const noSubscription = () => () => {};

/** How long a lost context gets to come back before the scene is given up on. */
const CONTEXT_RESTORE_MS = 5000;

let webgl2: boolean | undefined;

/**
 * Asks for a real WebGL2 context, without loading three.js, and gives it straight
 * back: browsers allow only a handful of live contexts, and the canvas needs one.
 */
function hasWebgl2(): boolean {
  if (webgl2 === undefined) {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      webgl2 = context !== null;
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

/**
 * Whether the scene may mount. False on the server and through hydration, so the
 * HUD paints first, and false for good on a browser without WebGL2, which is
 * then told so through the store.
 */
export function useWebglGate(): boolean {
  const supported = useSyncExternalStore(noSubscription, hasWebgl2, () => false);

  useEffect(() => {
    if (!hasWebgl2()) useUniverse.getState().setWebgl('failed');
  }, []);

  return supported;
}

/**
 * three.js picks itself up when the browser restores a lost context. When the
 * browser does not, the canvas would just sit there frozen, so this reports it.
 * Neither event bubbles, which is why these listen in the capture phase.
 */
export function useContextLossWatch(onLost: () => void): void {
  useEffect(() => {
    let timer = 0;
    const lost = () => {
      timer = window.setTimeout(onLost, CONTEXT_RESTORE_MS);
    };
    const restored = () => window.clearTimeout(timer);

    document.addEventListener('webglcontextlost', lost, true);
    document.addEventListener('webglcontextrestored', restored, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('webglcontextlost', lost, true);
      document.removeEventListener('webglcontextrestored', restored, true);
    };
  }, [onLost]);
}

/** Mirrors the visitor's device into the store and restores saved progress. */
export function useEnvironmentSync(): void {
  useEffect(() => {
    const { setEnvironment, hydrateVisited } = useUniverse.getState();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const sync = () =>
      setEnvironment({ reducedMotion: motion.matches, touch: coarse.matches });

    sync();
    hydrateVisited();
    motion.addEventListener('change', sync);
    coarse.addEventListener('change', sync);

    return () => {
      motion.removeEventListener('change', sync);
      coarse.removeEventListener('change', sync);
    };
  }, []);
}
