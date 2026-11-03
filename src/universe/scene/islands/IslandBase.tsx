'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useUniverse } from '../../state/store';
import { getIslandAssets } from './islandAssets';

/** Rock, platforms and rim light for all six islands, as one merged mesh per material. */
export function IslandBase() {
  const gl = useThree((state) => state.gl);
  const assets = useMemo(() => getIslandAssets(gl), [gl]);

  useFrame((_, delta) => {
    if (!useUniverse.getState().reducedMotion) assets.shimmerTime.value += delta;
  });

  return (
    <>
      {assets.parts.map(({ name, geometry, material }) => (
        <mesh key={name} geometry={geometry} material={material} />
      ))}
    </>
  );
}
