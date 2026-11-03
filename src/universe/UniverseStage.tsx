'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { UniverseHud } from './hud/UniverseHud';
import { useContextLossWatch, useEnvironmentSync, useWebglGate } from './hud/useLifecycle';
import { useUniverse } from './state/store';

/**
 * The homepage experience: the 3D scene behind the DOM HUD.
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
