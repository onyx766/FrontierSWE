'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState } from 'react';
import type * as THREE from 'three';
import { useUniverse } from '../../state/store';
import { Asteroids } from './Asteroids';
import { Earth } from './Earth';
import { bakeEarth, type EarthBake } from './earthBake';
import { Lighting } from './Lighting';
import { createNoiseVolume } from './noiseField';
import { bakePlanet, Planet } from './Planet';
import { PostEffects } from './PostEffects';
import { QualityGovernor } from './QualityGovernor';
import { skyClock } from './skyClock';
import { bakeSky, type SkyBake } from './skyBake';
import { DustMotes, Starfield } from './Starfield';
import { SunFlare } from './SunFlare';

/**
 * The world's surroundings: everything that is not the world.
 *
 * All of it is painted once at startup and then costs a handful of texture reads,
 * because nothing noisy may run per frame on integrated graphics. See `skyBake.ts`,
 * `earthBake.ts` and `composition.ts`.
 */

const SKY_FACE_SIZE = 1024;
const EARTH_MAP_SIZE = 4096;
const EARTH_MAP_SIZE_SMALL = 2048;

interface Bakes {
  sky: SkyBake;
  earth: EarthBake;
  planet: THREE.WebGLRenderTarget;
}

/** Baked targets live only on the GPU, so a lost context means painting them again. */
function useContextGeneration(): number {
  const canvas = useThree((state) => state.gl.domElement);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const restored = () => setGeneration((value) => value + 1);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => canvas.removeEventListener('webglcontextrestored', restored);
  }, [canvas]);

  return generation;
}

/** Everything that is painted once. A remount brings a new GL context, so it paints again. */
function useBakes(): Bakes | null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const generation = useContextGeneration();
  const [bakes, setBakes] = useState<Bakes | null>(null);

  useLayoutEffect(() => {
    const { touch } = useUniverse.getState();
    const mapSize =
      touch || gl.capabilities.maxTextureSize < EARTH_MAP_SIZE
        ? EARTH_MAP_SIZE_SMALL
        : EARTH_MAP_SIZE;

    const noise = createNoiseVolume();
    const sky = bakeSky(gl, noise, SKY_FACE_SIZE);
    const earth = bakeEarth(gl, noise, mapSize);
    const planet = bakePlanet(gl, noise);
    noise.dispose();

    scene.background = sky.background;
    scene.environment = sky.environment;
    setBakes({ sky, earth, planet });

    return () => {
      scene.background = null;
      scene.environment = null;
      sky.dispose();
      earth.dispose();
      planet.dispose();
      setBakes(null);
    };
  }, [gl, scene, generation]);

  return bakes;
}

function SkyClock() {
  useFrame((_, delta) => {
    if (!useUniverse.getState().reducedMotion) skyClock.value += Math.min(delta, 0.1);
  });
  return null;
}

export default function EnvironmentLayer() {
  const bakes = useBakes();

  return (
    <>
      <SkyClock />
      <QualityGovernor />
      <Lighting />
      <Starfield />
      <DustMotes />
      <SunFlare />
      <Asteroids />
      {bakes ? (
        <>
          <Planet map={bakes.planet.texture} />
          <Earth bake={bakes.earth} />
        </>
      ) : null}
      <PostEffects />
    </>
  );
}
