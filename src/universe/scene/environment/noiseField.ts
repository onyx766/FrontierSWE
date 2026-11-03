import * as THREE from 'three';
import { createRng } from '@/lib/rng';

/**
 * One small tiling 3D noise volume behind every bake in the sky.
 *
 * Bake shaders are one-shot, but they still have to compile: ANGLE turns GLSL
 * into HLSL, and analytic gradient noise repeated through several fbm calls
 * inlines into a shader that takes FXC seconds to chew through, blocking the
 * page. A hardware-filtered texture fetch per octave compiles instantly and also
 * runs faster. Four decorrelated channels mean one fetch can drive a domain warp.
 */

const SIZE = 64;
const SHIFTS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [13, 29, 47],
  [37, 5, 21],
  [51, 43, 9],
];

/** Gaussian blur of a wrapping cube along one axis, in place through a scratch copy. */
function blurAxis(field: Float32Array, step: number, kernel: readonly number[]) {
  const scratch = field.slice();
  const reach = (kernel.length - 1) / 2;
  for (let i = 0; i < field.length; i += 1) {
    const position = Math.floor(i / step) % SIZE;
    const base = i - position * step;
    let sum = 0;
    for (let k = -reach; k <= reach; k += 1) {
      const wrapped = (position + k + SIZE) % SIZE;
      sum += (kernel[k + reach] ?? 0) * (scratch[base + wrapped * step] ?? 0);
    }
    field[i] = sum;
  }
}

/**
 * Blurred white noise, normalised to fill the byte range. Unlike lattice value
 * noise it has no grid in it, so thresholding gives organic shapes rather than
 * blocks, and it is already smooth enough for plain trilinear filtering.
 */
function createField(): Float32Array {
  const random = createRng(0x51a7c0de);
  const field = new Float32Array(SIZE * SIZE * SIZE);
  for (let i = 0; i < field.length; i += 1) field[i] = random();

  const kernel = [0.054, 0.242, 0.399, 0.242, 0.054];
  blurAxis(field, 1, kernel);
  blurAxis(field, SIZE, kernel);
  blurAxis(field, SIZE * SIZE, kernel);

  let mean = 0;
  for (const value of field) mean += value;
  mean /= field.length;

  let variance = 0;
  for (const value of field) variance += (value - mean) ** 2;
  const deviation = Math.sqrt(variance / field.length);

  for (let i = 0; i < field.length; i += 1) {
    field[i] = 0.5 + (((field[i] ?? 0) - mean) / deviation) * 0.19;
  }
  return field;
}

export function createNoiseVolume(): THREE.Data3DTexture {
  const field = createField();
  const data = new Uint8Array(SIZE * SIZE * SIZE * 4);

  /* The channels are one field read at different offsets: decorrelated, and cheap. */
  for (let z = 0; z < SIZE; z += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        SHIFTS.forEach(([dx, dy, dz], channel) => {
          const index =
            ((x + dx) % SIZE) + ((y + dy) % SIZE) * SIZE + ((z + dz) % SIZE) * SIZE * SIZE;
          const value = THREE.MathUtils.clamp(field[index] ?? 0, 0, 1);
          data[(x + y * SIZE + z * SIZE * SIZE) * 4 + channel] = value * 255;
        });
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, SIZE, SIZE, SIZE);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/** Noise lookups for bake shaders. Needs `uniform highp sampler3D uNoise`. */
export const NOISE_GLSL = /* glsl */ `
  const mat3 OCTAVE_TURN = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );

  /*
   * Band-limited noise in 0..1: one unit of p is about one feature, repeating every
   * 20. Cubic lookup, because a threshold applied to trilinear noise shows the voxels
   * as stair-steps once the result is magnified.
   */
  vec4 voxels(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = p - cell;
    f = f * f * (3.0 - 2.0 * f);
    return textureLod(uNoise, (cell + f + 0.5) / 64.0, 0.0);
  }

  vec4 noise4(vec3 p) {
    return voxels(p * 3.2);
  }

  /* Fractal sum, roughly -0.5..0.5. Each octave turns, which hides the grid. */
  float fbm(vec3 p, int octaves, float roughness) {
    float sum = 0.0;
    float amplitude = 0.5;
    float scale = 0.0;
    for (int i = 0; i < octaves; i++) {
      sum += amplitude * (noise4(p).r - 0.5);
      scale += amplitude;
      p = OCTAVE_TURN * p * 2.03 + 17.31;
      amplitude *= roughness;
    }
    return sum / scale;
  }

  float fbm(vec3 p, int octaves) {
    return fbm(p, octaves, 0.5);
  }

  /* Rounded, puffy structure: the creases of the noise, inverted. */
  float billowy(vec3 p, int octaves, float roughness) {
    float sum = 0.0;
    float amplitude = 0.5;
    float scale = 0.0;
    for (int i = 0; i < octaves; i++) {
      sum += amplitude * abs(noise4(p).b * 2.0 - 1.0);
      scale += amplitude;
      p = OCTAVE_TURN * p * 2.11 + 3.77;
      amplitude *= roughness;
    }
    return sum / scale;
  }

  /* Sharp creases, 0..1, for wisps and filaments. */
  float ridged(vec3 p, int octaves) {
    float sum = 0.0;
    float amplitude = 0.5;
    float scale = 0.0;
    for (int i = 0; i < octaves; i++) {
      float n = 1.0 - abs(noise4(p).g * 2.0 - 1.0);
      sum += amplitude * n * n;
      scale += amplitude;
      p = OCTAVE_TURN * p * 2.07 + 5.13;
      amplitude *= 0.5;
    }
    return sum / scale;
  }
`;
