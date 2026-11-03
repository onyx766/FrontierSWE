'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { WORLD_AT_PARAM } from '@/data/universe';
import { UniverseHud } from './hud/UniverseHud';
import { useContextLossWatch, useEnvironmentSync, useWebglGate } from './hud/useLifecycle';
import { knownStation, placeRobotAtStation } from './state/arrival';
import { useUniverse } from './state/store';

/**
 * The 3D world at `/world`: the scene behind the DOM HUD.
 *
 * The scene is code-split with `ssr: false` and nothing else here depends on
 * it, so the HUD, including the page's <h1> and its links, is in the first HTML
 * response and works before, or without, WebGL. three.js and the world only
 * load behind that first paint.
 */
const UniverseScene = dynamic(() => import('./scene/UniverseScene'), { ssr: false });

/**
 * Catches what the per-layer boundaries inside the scene cannot: a canvas that
 * will not start, or a chunk that fails to download.
 */
class SceneBoundary extends Component<
  { onFailure: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('Universe scene failed', error);
    this.props.onFailure();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * `?at=<station>` from a "View in 3D" link. Read through `useSearchParams`,
 * because on client navigation `window.location` still holds the previous URL
 * while the new page renders. Rendered before the scene, so the robot is on the
 * pad before the actor layer places it; the briefing opens once the scene
 * reports ready. The query is then dropped, so a reload or a later Back does not
 * yank the robot again.
 */
function RequestedArrival() {
  const at = useSearchParams().get(WORLD_AT_PARAM);
  const [requested] = useState(() => {
    const id = knownStation(at);
    if (id && typeof window !== 'undefined') placeRobotAtStation(id);
    return id;
  });
  const ready = useUniverse((state) => state.ready);
  const handled = useRef(false);

  useEffect(() => {
    if (!requested || !ready || handled.current) return;
    handled.current = true;
    useUniverse.getState().arriveAt(requested);
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [requested, ready]);

  return null;
}

export function UniverseStage() {
  useEnvironmentSync();
  const webglAvailable = useWebglGate();
  const webgl = useUniverse((state) => state.webgl);
  const [crashed, setCrashed] = useState(false);
  const giveUp = useCallback(() => setCrashed(true), []);
  useContextLossWatch(giveUp);

  /* Unmounting a broken canvas reports 'pending', which must not hide the failure. */
  useEffect(() => {
    if (crashed && webgl !== 'failed') useUniverse.getState().setWebgl('failed');
  }, [crashed, webgl]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02040b]">
      {/* The query only exists in the browser; the static HTML renders without it. */}
      <Suspense fallback={null}>
        <RequestedArrival />
      </Suspense>
      {/* `isolate` keeps DOM that drei projects from the scene beneath the HUD. */}
      <div className="absolute inset-0 isolate">
        {webglAvailable && !crashed ? (
          <SceneBoundary onFailure={giveUp}>
            <UniverseScene />
          </SceneBoundary>
        ) : null}
      </div>
      <UniverseHud />
    </div>
  );
}
