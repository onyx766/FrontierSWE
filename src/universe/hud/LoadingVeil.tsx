'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';

/** After this long the visitor is offered the plain pages, without leaving the wait. */
const SLOW_AFTER_MS = 14000;

/**
 * The poster behind the HUD until the first real frames arrive. It is pure CSS,
 * so it is in the first paint, and it stays in place as the backdrop if the world
 * cannot start at all.
 *
 * Once it has lifted it stays lifted. `ready` can drop again if the canvas is
 * remounted under a live HUD, and a poster over a running world would be far
 * worse than a blank frame or two.
 */
export function LoadingVeil() {
  const ready = useUniverse((state) => state.ready);
  const progress = useUniverse((state) => state.progress);
  const failed = useUniverse((state) => state.webgl === 'failed');
  const [slow, setSlow] = useState(false);
  const [lifted, setLifted] = useState(ready);
  if (ready && !lifted) setLifted(true);

  useEffect(() => {
    if (lifted) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [lifted]);

  const loading = !lifted && !failed;
  const percent = Math.round(progress * 100);

  return (
    <div className="uh-veil" data-ready={lifted && !failed}>
      <div className="uh-veil-stars" />
      <div className="uh-veil-planet" />
      <div className="uh-veil-ring" />

      <div className="uh-loader" hidden={!loading} role="status">
        <p className="uh-loader-label">
          {hudCopy.loading.label}
          {percent > 0 ? <span className="ml-2 tabular-nums">{percent}%</span> : null}
        </p>
        <div className="uh-loader-track" aria-hidden>
          {percent > 0 ? (
            <div className="uh-loader-fill" style={{ transform: `scaleX(${progress})` }} />
          ) : (
            <div className="uh-loader-sweep" />
          )}
        </div>
        {slow ? (
          <p className="uh-loader-slow">
            {hudCopy.loading.slow}{' '}
            <Link href="/system">{hudCopy.failure.system}</Link>
            {' · '}
            <Link href="/projects">{hudCopy.failure.projects}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
