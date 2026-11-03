'use client';

import { hudCopy, tourOrder } from '@/data/universe';
import { useUniverse } from '../state/store';
import { world } from '../world/world';

/**
 * Top-centre line for what the robot is doing on its own. The live region is
 * always mounted, because screen readers only announce changes to one that
 * already exists.
 */
export function TravelStatus() {
  const travel = useUniverse((state) => state.travel);
  const near = useUniverse((state) => state.near);
  const hasBriefing = useUniverse((state) => state.active !== null);
  const touring = useUniverse((state) => state.touring);
  const tourIndex = useUniverse((state) => state.tourIndex);

  const reopenable = travel === null && near !== null && !hasBriefing;

  return (
    <>
      <div role="status" className="contents">
        {travel ? (
          <p className="uh-travel-line uh-glass">
            <span className="uh-travel-pulse" aria-hidden />
            {touring ? (
              <span className="font-mono text-[11px] tracking-[0.12em] text-[#a9c4f5] uppercase">
                {hudCopy.travel.tourStop} {tourIndex + 1}/{tourOrder.length}
              </span>
            ) : null}
            <span className="min-w-0 truncate">
              {hudCopy.travel.walking}{' '}
              <span className="text-white">{world.station(travel).title}</span>
            </span>
            <button
              type="button"
              className="uh-text-button"
              onClick={() => useUniverse.getState().cancelTravel()}
            >
              {hudCopy.travel.cancel}
            </button>
          </p>
        ) : null}
      </div>

      {reopenable ? (
        <button
          type="button"
          className="uh-travel-line uh-glass uh-reopen"
          onClick={() => useUniverse.getState().reopenBriefing()}
        >
          <kbd className="uh-key">E</kbd>
          <span className="min-w-0 truncate">
            {hudCopy.briefing.open}
            <span className="text-white"> · {world.station(near).title}</span>
          </span>
        </button>
      ) : null}
    </>
  );
}
