'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useUniverse, type Quality } from '../../state/store';

/**
 * Steps quality to fit the machine. The lower bound sits just under the 30 fps
 * floor; the upper bound is high enough that a machine only earns quality back when
 * it clearly has room, so the two cannot chase each other forever.
 */

const LADDER: readonly Quality[] = ['low', 'medium', 'high'];

const FPS_BOUNDS: [lower: number, upper: number] = [26, 52];

/** Pixel ratio ceiling per level. Fill rate is what integrated graphics runs out of. */
const MAX_PIXEL_RATIO: Record<Quality, number> = { high: 1.75, medium: 1.25, low: 1 };

function stepQuality(direction: 1 | -1) {
  const { quality, setQuality } = useUniverse.getState();
  const next = LADDER[LADDER.indexOf(quality) + direction];
  if (next) setQuality(next);
}

export function QualityGovernor() {
  const quality = useUniverse((state) => state.quality);
  const setDpr = useThree((state) => state.setDpr);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO[quality]));
  }, [quality, setDpr]);

  return (
    <PerformanceMonitor
      ms={500}
      iterations={10}
      threshold={0.8}
      flipflops={4}
      bounds={() => FPS_BOUNDS}
      onDecline={() => stepQuality(-1)}
      onIncline={() => stepQuality(1)}
    />
  );
}
