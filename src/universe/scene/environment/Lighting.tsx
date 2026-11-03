'use client';

import { useMemo } from 'react';
import { getComposition } from './composition';

/**
 * Every dynamic light in the scene, and there are exactly four. Other layers fake
 * local light with emissive surfaces and additive sprites. Dark metal is lit far
 * more by reflections than by these; the key and rim exist to shape it.
 */

const KEY_COLOR = '#ffe2c4';
const RIM_COLOR = '#6f9dff';
const CORE_COLOR = '#7f6bff';

/** How far the key is lifted above the true sun. See `Lighting`. */
const KEY_ELEVATION = 0.22;

export function Lighting() {
  const keyPosition = useMemo(() => {
    /* The true sun sits below the deck, and a light from under the floor would never touch one. */
    const { sunDirection } = getComposition();
    return sunDirection.clone().setY(KEY_ELEVATION).normalize().multiplyScalar(400);
  }, []);

  return (
    <>
      <hemisphereLight args={['#33487a', '#0b1a38', 0.3]} />
      <directionalLight color={KEY_COLOR} intensity={3.2} position={keyPosition} />
      <directionalLight color={RIM_COLOR} intensity={3} position={[320, 150, -360]} />
      <pointLight color={CORE_COLOR} intensity={900} position={[0, 14, 0]} decay={1.6} />
    </>
  );
}
