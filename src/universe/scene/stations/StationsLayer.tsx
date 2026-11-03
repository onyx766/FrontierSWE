'use client';

import { useFrame } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { world } from '../../world/world';
import { beaconStation, shownStation } from './stationFocus';
import { StationPads } from './StationPads';

/**
 * The stops where projects get explained: every pad, the one open hologram, and
 * the name floating over the pad closest to the robot. Both of the last two are
 * separate chunks, mounted when first wanted, so that a visitor who never reaches
 * a pad never loads their code.
 */

const Hologram = lazy(() => import('./Hologram'));
const PadBeacon = lazy(() => import('./PadBeacon'));

/** The beacon follows the robot, but walking pace does not need sixty checks a second. */
const BEACON_CHECK_SECONDS = 0.15;

function HologramSlot() {
  const shown = useUniverse(shownStation);
  const [mounted, setMounted] = useState<string | null>(null);

  useEffect(() => {
    if (shown && mounted === null) setMounted(shown);
  }, [shown, mounted]);

  /* One scans out completely before the next begins. */
  const onClosed = useCallback(() => setMounted(shownStation(useUniverse.getState())), []);

  if (mounted === null) return null;

  return (
    <Suspense fallback={null}>
      <Hologram key={mounted} stationId={mounted} open={mounted === shown} onClosed={onClosed} />
    </Suspense>
  );
}

function BeaconSlot({ hovered }: { hovered: RefObject<string | null> }) {
  const [wanted, setWanted] = useState<string | null>(null);
  const [mounted, setMounted] = useState<string | null>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    if (clock.current < BEACON_CHECK_SECONDS) return;
    clock.current = 0;
    setWanted(
      beaconStation(
        world.stations,
        runtime.robot,
        runtime.view,
        hovered.current,
        useUniverse.getState(),
      ),
    );
  });

  useEffect(() => {
    if (wanted && mounted === null) setMounted(wanted);
  }, [wanted, mounted]);

  if (mounted === null) return null;

  return (
    <Suspense fallback={null}>
      <PadBeacon
        key={mounted}
        stationId={mounted}
        open={mounted === wanted}
        onClosed={() => setMounted(wanted)}
      />
    </Suspense>
  );
}

export default function StationsLayer() {
  const hovered = useRef<string | null>(null);

  return (
    <>
      <StationPads hovered={hovered} />
      <HologramSlot />
      <BeaconSlot hovered={hovered} />
    </>
  );
}
