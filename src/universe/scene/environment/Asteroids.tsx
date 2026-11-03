'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../state/store';
import { heroPoint, heroReferenceCamera } from '../heroCamera';
import { worldSizeAt, type FramePoint } from './composition';
import { createRockGeometry, type RockOptions } from './rockGeometry';
import { skyClock } from './skyClock';

/**
 * Hero rocks placed by hand in the opening frame, plus a distant belt. Tumbling
 * happens in the vertex shader from per-instance axes, so hundreds of rocks cost
 * one uniform per frame and no matrix updates.
 */

interface HeroRock {
  frame: FramePoint;
  /** Distance from the opening camera. Each one sits well outside the world. */
  distance: number;
  /** Size across, in pixels of the reference frame. */
  pixels: number;
  shape: 'boulder' | 'chunk';
  tumble: number;
}

const HERO_ROCKS: readonly HeroRock[] = [
  { frame: [0.14, 0.495], distance: 400, pixels: 74, shape: 'chunk', tumble: 0.05 },
  { frame: [0.905, 0.405], distance: 400, pixels: 40, shape: 'chunk', tumble: 0.09 },
  { frame: [0.977, 0.445], distance: 470, pixels: 165, shape: 'boulder', tumble: 0.02 },
  { frame: [0.135, 0.985], distance: 380, pixels: 92, shape: 'boulder', tumble: 0.03 },
  { frame: [0.23, 1.005], distance: 430, pixels: 100, shape: 'chunk', tumble: 0.04 },
  { frame: [0.04, 0.975], distance: 360, pixels: 62, shape: 'chunk', tumble: 0.04 },
];

const BOULDER: RockOptions = {
  seed: 0x0b01,
  detail: 15,
  cuts: 44,
  craters: 30,
  roughness: 1,
  stretch: [1, 0.92, 0.86],
};

const CHUNK: RockOptions = {
  seed: 0x0c44,
  detail: 11,
  cuts: 34,
  craters: 18,
  roughness: 1,
  stretch: [1.08, 0.84, 0.96],
};

const PEBBLE: RockOptions = {
  seed: 0x0a17,
  detail: 2,
  cuts: 14,
  craters: 0,
  roughness: 0.9,
  stretch: [1.15, 0.8, 0.92],
};

const BELT_COUNT = 180;
const BELT_INNER = 250;
const BELT_OUTER = 620;
const BELT_TILT = THREE.MathUtils.degToRad(11);
/** Rocks closer than this to the opening camera would loom in the composition. */
const CAMERA_CLEARANCE = 210;

const SPIN_VERTEX = /* glsl */ `
  attribute vec4 aSpin;
  uniform float uTime;

  vec3 tumble(vec3 v, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }
`;

interface Placement {
  matrix: THREE.Matrix4;
  spin: readonly [number, number, number, number];
}

function randomAxis(random: () => number): [number, number, number] {
  const axis = new THREE.Vector3(
    rngBetween(random, -1, 1),
    rngBetween(random, -1, 1),
    rngBetween(random, -1, 1),
  ).normalize();
  return [axis.x, axis.y, axis.z];
}

function placeHeroRock(rock: HeroRock, random: () => number): Placement {
  const position = heroPoint(rock.frame[0], rock.frame[1], rock.distance);
  const scale = worldSizeAt(rock.pixels, rock.distance) / 2;
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      rngBetween(random, 0, Math.PI * 2),
      rngBetween(random, 0, Math.PI * 2),
      rngBetween(random, 0, Math.PI * 2),
    ),
  );
  return {
    matrix: new THREE.Matrix4().compose(
      position,
      quaternion,
      new THREE.Vector3(scale, scale, scale),
    ),
    spin: [...randomAxis(random), rock.tumble],
  };
}

function placeBelt(): Placement[] {
  const random = createRng(0xbe17);
  const camera = heroReferenceCamera().position;
  const tilt = new THREE.Euler(BELT_TILT, 0, BELT_TILT * 0.6);
  const placements: Placement[] = [];
  const position = new THREE.Vector3();

  while (placements.length < BELT_COUNT) {
    const angle = rngBetween(random, 0, Math.PI * 2);
    const radius = BELT_INNER + (BELT_OUTER - BELT_INNER) * random() ** 1.5;
    position
      .set(Math.cos(angle) * radius, rngBetween(random, -38, 38), Math.sin(angle) * radius)
      .applyEuler(tilt);

    if (position.distanceTo(camera) < CAMERA_CLEARANCE) continue;

    const size = 0.7 + 7 * random() ** 3.2;
    placements.push({
      matrix: new THREE.Matrix4().compose(
        position,
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(random() * 6.28, random() * 6.28, random() * 6.28),
        ),
        new THREE.Vector3(size, size * rngBetween(random, 0.7, 1), size),
      ),
      spin: [...randomAxis(random), rngBetween(random, 0.03, 0.2)],
    });
  }
  return placements;
}

function createRockMaterial(shade: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(shade, shade, shade),
    vertexColors: true,
    flatShading: true,
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.06,
  });

  /* The rocks face the crystal in the reference: a warm term from the world's centre,
     strong enough to reach them, without a real light that would have to. */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = skyClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SPIN_VERTEX}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed = tumble(transformed, aSpin.xyz, aSpin.w * uTime);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      vec3 worldCentre = (viewMatrix * vec4(0.0, 6.0, 0.0, 1.0)).xyz;
      float towardCentre = max(dot(normal, normalize(worldCentre + vViewPosition)), 0.0);
      reflectedLight.directDiffuse += diffuseColor.rgb * towardCentre * towardCentre * vec3(0.92, 0.72, 0.56);`,
    );
  };
  return material;
}

/** Geometry for one set of instances, carrying each instance's tumble. */
function spinningRock(options: RockOptions, placements: readonly Placement[]): THREE.BufferGeometry {
  const spins = new Float32Array(placements.length * 4);
  placements.forEach((placement, index) => spins.set(placement.spin, index * 4));

  const geometry = createRockGeometry(options);
  geometry.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spins, 4));
  return geometry;
}

function RockInstances({
  geometry,
  placements,
  material,
}: {
  geometry: THREE.BufferGeometry;
  placements: readonly Placement[];
  material: THREE.Material;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    placements.forEach((placement, index) => instanced.setMatrixAt(index, placement.matrix));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [placements]);

  return <instancedMesh ref={mesh} args={[geometry, material, placements.length]} />;
}

function createRocks() {
  const random = createRng(0x0ca1);
  const placeShape = (shape: HeroRock['shape']) =>
    HERO_ROCKS.filter((rock) => rock.shape === shape).map((rock) => placeHeroRock(rock, random));

  const boulders = placeShape('boulder');
  const chunks = placeShape('chunk');
  const belt = placeBelt();

  return {
    boulders,
    chunks,
    belt,
    boulderGeometry: spinningRock(BOULDER, boulders),
    chunkGeometry: spinningRock(CHUNK, chunks),
    pebbleGeometry: spinningRock(PEBBLE, belt),
    heroMaterial: createRockMaterial(1),
    beltMaterial: createRockMaterial(0.4),
  };
}

export function Asteroids() {
  const quality = useUniverse((state) => state.quality);
  const rocks = useMemo(createRocks, []);

  useEffect(
    () => () => {
      rocks.boulderGeometry.dispose();
      rocks.chunkGeometry.dispose();
      rocks.pebbleGeometry.dispose();
      rocks.heroMaterial.dispose();
      rocks.beltMaterial.dispose();
    },
    [rocks],
  );

  return (
    <>
      <RockInstances
        geometry={rocks.boulderGeometry}
        placements={rocks.boulders}
        material={rocks.heroMaterial}
      />
      <RockInstances
        geometry={rocks.chunkGeometry}
        placements={rocks.chunks}
        material={rocks.heroMaterial}
      />
      {quality === 'low' ? null : (
        <RockInstances
          geometry={rocks.pebbleGeometry}
          placements={rocks.belt}
          material={rocks.beltMaterial}
        />
      )}
    </>
  );
}
