'use client';

import { useEffect, useState } from 'react';
import { controlsHelp, hudCopy } from '@/data/universe';
import { runtime } from '../state/runtime';
import { useUniverse } from '../state/store';

/** How many of `controlsHelp` the strip shows before the visitor has moved. */
const STARTER_CONTROLS = 4;
const POLL_MS = 200;

/** True from the first moment the visitor drives the robot themselves. */
function useVisitorMoved(exploring: boolean): boolean {
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    if (!exploring || moved) return;
    const timer = window.setInterval(() => {
      const { moveX, moveY, touchX, touchY } = runtime.input;
      if (moveX !== 0 || moveY !== 0 || touchX !== 0 || touchY !== 0) setMoved(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [exploring, moved]);

  return moved;
}

function Control({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="flex items-center gap-0.5">
        {keys.map((key) => (
          <kbd key={key} className="uh-key">
            {key}
          </kbd>
        ))}
      </span>
      <span className="text-[12px] text-[#b9bfcc]">{label}</span>
    </span>
  );
}

export function ControlsStrip() {
  const exploring = useUniverse((state) => state.phase === 'explore');
  const helpOpen = useUniverse((state) => state.helpOpen);
  const reading = useUniverse((state) => state.active !== null);
  const moved = useVisitorMoved(exploring);
  const shrunk = moved || reading;

  return (
    <div className="uh-controls">
      {helpOpen ? (
        <div id="uh-help" className="uh-help uh-glass">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {[...controlsHelp, ...hudCopy.controls.pointer].map((control) => (
              <li key={control.label}>
                <Control keys={control.keys} label={control.label} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="uh-controls-bar uh-glass" data-shrunk={shrunk}>
        <div className="uh-controls-keys" aria-hidden={shrunk}>
          <div>
            <div className="flex items-center gap-4 pr-4">
              {controlsHelp.slice(0, STARTER_CONTROLS).map((control) => (
                <Control key={control.label} keys={control.keys} label={control.label} />
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="uh-controls-help"
          aria-expanded={helpOpen}
          aria-controls="uh-help"
          aria-label={helpOpen ? hudCopy.controls.hideHelp : hudCopy.controls.help}
          onClick={() => useUniverse.getState().toggleHelp()}
        >
          <kbd className="uh-key">?</kbd>
          <span className="text-[12px] text-[#b9bfcc]">{hudCopy.controls.label}</span>
        </button>
      </div>
    </div>
  );
}
