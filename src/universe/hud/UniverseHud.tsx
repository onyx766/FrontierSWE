'use client';

import { useState, type MouseEvent } from 'react';
import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';
import { ActionDock } from './ActionDock';
import { ArrivalBanner } from './ArrivalBanner';
import { BriefingPanel } from './BriefingPanel';
import { ControlsStrip } from './ControlsStrip';
import { ExploreHint } from './ExploreHint';
import { logHeadingId } from './focus';
import { HeroCopy } from './HeroCopy';
import { Joystick } from './Joystick';
import { LoadingVeil } from './LoadingVeil';
import { Minimap } from './Minimap';
import { MissionLog } from './MissionLog';
import { SceneFailure } from './SceneFailure';
import { StatusCard } from './StatusCard';
import { TopBar } from './TopBar';
import { TravelStatus } from './TravelStatus';
import { useVoice } from './useVoice';

/** Reveals the mission log for a keyboard visitor still on the opening view. */
function skipToLog(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  useUniverse.getState().explore();
  requestAnimationFrame(() => document.getElementById(logHeadingId())?.focus());
}

/**
 * A click leaves focus on the button it pressed, where Space would press it again
 * instead of jumping. Mouse and touch visitors have no use for that focus;
 * keyboard activation reports `detail` 0 and keeps it.
 */
function releasePointerFocus(event: MouseEvent<HTMLDivElement>) {
  if (event.detail === 0) return;
  const focused = document.activeElement;
  if (focused instanceof HTMLButtonElement || focused instanceof HTMLAnchorElement) focused.blur();
}

/** Everything that only exists on foot. Mounted on first use, so the opening view stays light. */
function ExploreLayer() {
  const exploring = useUniverse((state) => state.phase === 'explore');
  const [started, setStarted] = useState(exploring);
  if (exploring && !started) setStarted(true);
  if (!started) return null;

  return (
    <div className="uh-explore">
      <div className="uh-notices">
        <TravelStatus />
        <ArrivalBanner />
      </div>
      <ControlsStrip />
      <div className="uh-mapdock">
        <ActionDock />
        <Minimap live={exploring} />
      </div>
      <Joystick />
    </div>
  );
}

/**
 * The DOM overlay. It is server-rendered, so the <h1>, the navigation and the
 * links are in the first HTML, and nothing here imports three.js or the scene:
 * it reaches the world only through `state/` and `world/`, which are plain data.
 *
 * Which view shows is decided by `data-view` on the root, in CSS, so the hero and
 * the explore layer can cross-fade without either unmounting.
 */
export function UniverseHud() {
  const exploring = useUniverse((state) => state.phase === 'explore');
  const ready = useUniverse((state) => state.ready);
  const failed = useUniverse((state) => state.webgl === 'failed');
  const briefing = useUniverse((state) => state.active !== null);
  const touch = useUniverse((state) => state.touch);

  useVoice();

  return (
    <div
      className="uh-root"
      data-view={failed ? 'failed' : exploring ? 'explore' : 'opening'}
      data-ready={ready}
      data-briefing={briefing}
      data-touch={touch}
      onClick={releasePointerFocus}
    >
      <LoadingVeil />
      <a href="#mission-log" className="uh-skip" onClick={skipToLog}>
        {hudCopy.skipToLog}
      </a>
      <TopBar />
      <main id="main">
        <HeroCopy />
        <StatusCard />
        <ExploreHint />
        <SceneFailure />
        <noscript>
          <p className="uh-noscript">{hudCopy.noScript}</p>
        </noscript>
        <MissionLog />
        <BriefingPanel />
      </main>
      <ExploreLayer />
    </div>
  );
}
