'use client';

import { useEffect, useState } from 'react';
import type { IslandContent } from '@/data/universe';
import { runtime } from '../state/runtime';
import { useUniverse } from '../state/store';
import { ACCENT_HEX } from './colors';
import { islandAt } from './stations';

const POLL_MS = 250;
const SHOW_MS = 4200;

/**
 * Names the island as the robot steps onto it. It polls `runtime` on a slow timer
 * instead of subscribing, because the robot's position changes every frame and
 * this only cares when it crosses a deck edge.
 */
export function ArrivalBanner() {
  const exploring = useUniverse((state) => state.phase === 'explore');
  const [arrival, setArrival] = useState<IslandContent | null>(null);

  useEffect(() => {
    if (!exploring) return;
    let current = islandAt(runtime.robot);
    let hideTimer = 0;

    const poll = window.setInterval(() => {
      const island = islandAt(runtime.robot);
      if (island === current) return;
      current = island;
      window.clearTimeout(hideTimer);
      setArrival(island);
      if (island) hideTimer = window.setTimeout(() => setArrival(null), SHOW_MS);
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(hideTimer);
    };
  }, [exploring]);

  if (!exploring || !arrival) return null;

  return (
    <p key={arrival.id} className="uh-arrival uh-glass">
      <span className="uh-arrival-name" style={{ color: ACCENT_HEX[arrival.accent] }}>
        {arrival.label.replace('\n', ' ')}
      </span>
      {arrival.arrival}
    </p>
  );
}
