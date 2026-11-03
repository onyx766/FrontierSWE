import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';

/**
 * Asteroid geometry. A displaced sphere reads as a lumpy potato no matter how much
 * noise it gets. What makes a rock look like a rock is broken planes: chunks that
 * sheared off, and impact craters with raised rims. Those come first; fine ripple
 * goes on top. Written as a pure function of a seed, so it is cheap to test and
 * every rock is stable between visits.
 */

interface Wave {
  direction: THREE.Vector3;
  phase: number;
  amplitude: number;
}

interface Cut {
  normal: THREE.Vector3;
  distance: number;
}

interface Crater {
  center: THREE.Vector3;
  radius: number;
  depth: number;
  /** Cosine of the angle beyond which the crater has no effect. */
  reach: number;
}

export interface RockOptions {
  seed: number;
  /** Icosphere subdivision. Triangles are 20 × (detail + 1)². */
  detail: number;
  /** Number of sheared-off planes. */
  cuts: number;
  /** Number of impact craters. */
  craters: number;
  /** Amount of medium and fine surface ripple. */
  roughness: number;
  /** Stretch along x, y and z. */
  stretch: readonly [number, number, number];
}

function randomDirection(random: () => number): THREE.Vector3 {
  const z = rngBetween(random, -1, 1);
  const angle = rngBetween(random, 0, Math.PI * 2);
  const ring = Math.sqrt(1 - z * z);
  return new THREE.Vector3(ring * Math.cos(angle), ring * Math.sin(angle), z);
}

/** Sum of random plane waves: smooth noise with no lattice, needing no tables. */
function createWaves(
  random: () => number,
  count: number,
  minFrequency: number,
  maxFrequency: number,
  amplitude: number,
): Wave[] {
  return Array.from({ length: count }, () => {
    const frequency = rngBetween(random, minFrequency, maxFrequency);
    return {
      direction: randomDirection(random).multiplyScalar(frequency),
      phase: rngBetween(random, 0, Math.PI * 2),
      amplitude: (amplitude / Math.sqrt(count)) * (minFrequency / frequency) ** 0.8,
    };
  });
}

function sumWaves(waves: readonly Wave[], direction: THREE.Vector3): number {
  let sum = 0;
  for (const wave of waves) {
    sum += wave.amplitude * Math.sin(wave.direction.dot(direction) + wave.phase);
  }
  return sum;
}

function craterOffset(direction: THREE.Vector3, craters: readonly Crater[]): number {
  let offset = 0;
  for (const crater of craters) {
    const facing = direction.dot(crater.center);
    if (facing < crater.reach) continue;
    const t = Math.acos(Math.min(facing, 1)) / crater.radius;
    /* A bowl, then a raised rim that fades into the surrounding rock. */
    if (t < 1) offset -= crater.depth * (1 - t * t);
    else offset += crater.depth * 0.32 * (1 - (t - 1) / 0.5) ** 2;
  }
  return offset;
}

/** The radius a sheared plane allows along `direction`, with a little softness at the edge. */
function cutRadius(direction: THREE.Vector3, cuts: readonly Cut[], radius: number): number {
  let limited = radius;
  for (const cut of cuts) {
    const facing = direction.dot(cut.normal);
    if (facing > 0.05) limited = Math.min(limited, cut.distance / facing);
  }
  return limited;
}

export function createRockGeometry(options: RockOptions): THREE.BufferGeometry {
  const { seed, detail, cuts, craters, roughness, stretch } = options;
  const random = createRng(seed);

  const broad = createWaves(random, 6, 1.2, 2.4, 0.24);
  const medium = createWaves(random, 14, 5, 13, 0.1 * roughness);
  const fine = createWaves(random, 30, 18, 46, 0.018 * roughness);
  const tone = createWaves(random, 26, 4, 30, 0.62);

  const planes: Cut[] = Array.from({ length: cuts }, () => ({
    normal: randomDirection(random),
    distance: rngBetween(random, 0.66, 0.96),
  }));
  const pits: Crater[] = Array.from({ length: craters }, () => {
    /* Mostly small pits, a few large impacts: the size distribution of real surfaces. */
    const radius = 0.05 + 0.3 * random() ** 3;
    return {
      center: randomDirection(random),
      radius,
      depth: radius * rngBetween(random, 0.2, 0.42),
      reach: Math.cos(radius * 1.5),
    };
  });

  const base = new THREE.IcosahedronGeometry(1, detail);
  const positions = base.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);

  const direction = new THREE.Vector3();
  const warm = new THREE.Color('#4f4a47');
  const cool = new THREE.Color('#0b0d12');
  const dark = new THREE.Color('#050507');
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    direction.fromBufferAttribute(positions, i).normalize();

    let radius = 1 + sumWaves(broad, direction);
    radius = cutRadius(direction, planes, radius);
    const crater = craterOffset(direction, pits);
    const ripple = sumWaves(medium, direction) + sumWaves(fine, direction);
    radius += crater + ripple;

    positions.setXYZ(
      i,
      direction.x * radius * stretch[0],
      direction.y * radius * stretch[1],
      direction.z * radius * stretch[2],
    );

    /* Crater floors are dusty and dark; everything else mottles between two tones. */
    const mottle = THREE.MathUtils.clamp(0.5 + sumWaves(tone, direction), 0, 1);
    color.copy(cool).lerp(warm, mottle * mottle * (3 - 2 * mottle));

    /* Hollows hold shadow that no light here will ever reach, so it is painted in. */
    const hollow = THREE.MathUtils.clamp(-crater * 16 - ripple * 9 + 0.1, 0, 0.9);
    color.lerp(dark, hollow);
    color.toArray(colors, i * 3);
  }

  base.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  base.computeVertexNormals();
  base.computeBoundingSphere();
  return base;
}
