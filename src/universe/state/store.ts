import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { tourOrder } from '@/data/universe';
import { world } from '../world/world';

/**
 * Discrete state of the experience: what the HUD and the scene both react to.
 * Per-frame values live in `runtime.ts`.
 *
 *   loading    the bundle and the scene are still arriving
 *   overview   the opening shot; the visitor can orbit and click
 *   explore    the camera follows the robot
 *
 * A station's briefing opens by itself when the robot reaches its pad and
 * closes when it walks away, so reading never interrupts walking. `Esc`
 * dismisses it until the visitor leaves the pad or asks for it again.
 */

export type Phase = 'loading' | 'overview' | 'explore';
export type Quality = 'high' | 'medium' | 'low';
export type WebglStatus = 'pending' | 'ok' | 'failed';

const VISITED_KEY = 'universe:visited';

interface UniverseState {
  phase: Phase;
  /** 0–1 while assets load. */
  progress: number;
  ready: boolean;
  webgl: WebglStatus;

  /** Station whose pad the robot is standing on. */
  near: string | null;
  /** Station whose briefing is open. */
  active: string | null;
  /** Page of the open briefing. */
  beat: number;
  /** True after `Esc` until the robot leaves the pad. */
  dismissed: boolean;

  visited: string[];
  /** Station the robot is walking to on autopilot. */
  travel: string | null;
  touring: boolean;
  tourIndex: number;

  voice: boolean;
  reducedMotion: boolean;
  touch: boolean;
  quality: Quality;
  helpOpen: boolean;

  setProgress(progress: number): void;
  markReady(): void;
  /** The canvas went away, e.g. on navigation. Its next mount reports ready again. */
  markUnmounted(): void;
  setWebgl(status: WebglStatus): void;
  setQuality(quality: Quality): void;
  setEnvironment(flags: { reducedMotion: boolean; touch: boolean }): void;
  hydrateVisited(): void;

  /** Leave the opening shot and follow the robot. */
  explore(): void;
  /** Back to the opening shot. The robot stays where it is. */
  overview(): void;
  /** Walk to a station on autopilot. */
  travelTo(stationId: string): void;
  /** Stop the autopilot, e.g. because the visitor took the controls. */
  cancelTravel(): void;

  /** Called by the scene when the robot steps onto, or off, a pad. */
  setNear(stationId: string | null): void;
  nextBeat(): void;
  previousBeat(): void;
  goToBeat(beat: number): void;
  closeBriefing(): void;
  reopenBriefing(): void;

  startTour(): void;
  nextTourStop(): void;
  stopTour(): void;

  toggleVoice(): void;
  toggleHelp(): void;
}

function saveVisited(visited: string[]) {
  try {
    window.localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
  } catch {
    /* Private mode or a full quota: progress just will not persist. */
  }
}

export const useUniverse = create<UniverseState>()(
  subscribeWithSelector((set, get) => ({
    phase: 'loading',
    progress: 0,
    ready: false,
    webgl: 'pending',

    near: null,
    active: null,
    beat: 0,
    dismissed: false,

    visited: [],
    travel: null,
    touring: false,
    tourIndex: 0,

    voice: false,
    reducedMotion: false,
    touch: false,
    quality: 'high',
    helpOpen: false,

    setProgress: (progress) => set({ progress }),
    markReady: () =>
      set((state) => ({
        ready: true,
        progress: 1,
        phase: state.phase === 'loading' ? 'overview' : state.phase,
      })),
    markUnmounted: () => set({ ready: false, progress: 0, webgl: 'pending' }),
    setWebgl: (webgl) => set({ webgl }),
    setQuality: (quality) => set({ quality }),
    setEnvironment: ({ reducedMotion, touch }) => set({ reducedMotion, touch }),

    hydrateVisited: () => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(VISITED_KEY) ?? '[]') as unknown;
        if (Array.isArray(saved)) {
          const known = new Set(world.stations.map((station) => station.id));
          set({ visited: saved.filter((id): id is string => known.has(id as string)) });
        }
      } catch {
        /* A corrupt entry is treated as no progress. */
      }
    },

    explore: () => {
      if (get().phase === 'overview') set({ phase: 'explore' });
    },

    overview: () => {
      if (get().phase === 'loading') return;
      set({ phase: 'overview', travel: null, touring: false, active: null, beat: 0 });
    },

    travelTo: (stationId) => {
      if (get().phase === 'loading') return;
      if (get().near === stationId) {
        set({ phase: 'explore', travel: null, active: stationId, beat: 0, dismissed: false });
        return;
      }
      set({ phase: 'explore', travel: stationId, active: null, beat: 0 });
    },

    cancelTravel: () => {
      if (get().travel !== null || get().touring) set({ travel: null, touring: false });
    },

    setNear: (stationId) => {
      const state = get();
      if (state.near === stationId) return;

      if (stationId === null) {
        set({ near: null, active: null, beat: 0, dismissed: false });
        return;
      }

      /* Walking across a pad en route to somewhere else should not open it. */
      if (state.travel !== null && state.travel !== stationId) {
        set({ near: stationId });
        return;
      }

      const visited = state.visited.includes(stationId)
        ? state.visited
        : [...state.visited, stationId];
      if (visited !== state.visited) saveVisited(visited);

      set({
        near: stationId,
        active: stationId,
        beat: 0,
        dismissed: false,
        travel: null,
        visited,
      });
    },

    nextBeat: () => {
      const { active, beat, touring } = get();
      if (!active) return;
      const last = world.briefing(active).beats.length - 1;
      if (beat < last) set({ beat: beat + 1 });
      else if (touring) get().nextTourStop();
    },

    previousBeat: () => {
      const { active, beat } = get();
      if (active && beat > 0) set({ beat: beat - 1 });
    },

    goToBeat: (beat) => {
      const { active } = get();
      if (!active) return;
      const last = world.briefing(active).beats.length - 1;
      set({ beat: Math.max(0, Math.min(last, beat)) });
    },

    closeBriefing: () => {
      if (get().active) set({ active: null, beat: 0, dismissed: true, touring: false });
    },

    reopenBriefing: () => {
      const { near, active } = get();
      if (near && !active) set({ active: near, beat: 0, dismissed: false });
    },

    startTour: () => {
      const first = tourOrder[0];
      if (!first || get().phase === 'loading') return;
      set({ touring: true, tourIndex: 0 });
      get().travelTo(first);
    },

    nextTourStop: () => {
      const nextIndex = get().tourIndex + 1;
      const stop = tourOrder[nextIndex];
      if (!stop) {
        set({ touring: false, tourIndex: 0 });
        return;
      }
      set({ tourIndex: nextIndex });
      get().travelTo(stop);
    },

    stopTour: () => set({ touring: false, travel: null }),

    toggleVoice: () => set((state) => ({ voice: !state.voice })),
    toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),
  })),
);
