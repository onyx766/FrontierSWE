import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';
import { COLORS } from '../palette';
import { rgb, type Rgb } from './ribbons';

/**
 * Every soft point of light on the crystal: glows, lens sparkles and the motes
 * rising around it. One instanced quad, faced to the camera and animated entirely
 * in the vertex shader, so they cost one draw call and no per-frame work.
 */

export interface Glint {
  position: readonly [number, number, number];
  size: number;
  color: Rgb;
  /** 0 is the soft round glow, 1 the four-pointed sparkle. */
  sparkle: number;
  /** Speed of the slow twinkle. Zero holds it steady. */
  twinkle?: number;
}

interface MoteOptions {
  count: number;
  seed: number;
  innerRadius: number;
  outerRadius: number;
  bottom: number;
}

export function createMotes({ count, seed, innerRadius, outerRadius, bottom }: MoteOptions) {
  const random = createRng(seed);
  const tints = [COLORS.cyan, COLORS.blue, COLORS.violet, COLORS.magenta, COLORS.orange];

  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const radius = rngBetween(random, innerRadius, outerRadius);
    return {
      position: [
        Math.cos(angle) * radius,
        rngBetween(random, bottom, bottom + 6),
        Math.sin(angle) * radius,
      ] as const,
      size: rngBetween(random, 0.14, 0.34),
      color: rgb(tints[Math.floor(random() * tints.length)] as string, rngBetween(random, 2, 5)),
      phase: random(),
      rise: rngBetween(random, 0.012, 0.03),
    };
  });
}

export type Mote = ReturnType<typeof createMotes>[number];

export function buildGlintGeometry(glints: Glint[], motes: Mote[]): THREE.InstancedBufferGeometry {
  const total = glints.length + motes.length;
  const centers = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const shapes = new Float32Array(total * 4);

  glints.forEach((glint, index) => {
    centers.set(glint.position, index * 3);
    colors.set(glint.color, index * 3);
    shapes.set([glint.size, glint.sparkle, glint.twinkle ?? 0, index * 0.37], index * 4);
  });

  motes.forEach((mote, offset) => {
    const index = glints.length + offset;
    centers.set(mote.position, index * 3);
    colors.set(mote.color, index * 3);
    /* A negative twinkle marks a mote, whose magnitude is its rate of climb. */
    shapes.set([mote.size, 0, -mote.rise, mote.phase], index * 4);
  });

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(shapes, 4));
  geometry.instanceCount = total;
  return geometry;
}

export function createGlintMaterial(texture: THREE.Texture, riseHeight: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: texture },
      uTime: { value: 0 },
      uRiseHeight: { value: riseHeight },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      attribute vec3 aColor;
      attribute vec4 aShape;

      uniform float uTime;
      uniform float uRiseHeight;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vSparkle;

      void main() {
        vec3 center = aCenter;
        float strength = 1.0;
        float size = aShape.x;

        if (aShape.z < 0.0) {
          float climb = fract(uTime * -aShape.z + aShape.w);
          center.y += climb * uRiseHeight;
          center.x += sin(uTime * 0.21 + aShape.w * 40.0) * 0.5;
          center.z += cos(uTime * 0.17 + aShape.w * 60.0) * 0.5;
          strength = smoothstep(0.0, 0.12, climb) * smoothstep(1.0, 0.7, climb);
        } else if (aShape.z > 0.0) {
          float wave = sin(uTime * aShape.z + aShape.w * 6.283);
          strength = 0.72 + 0.28 * wave;
          size *= 0.9 + 0.1 * wave;
        }

        vec4 view = modelViewMatrix * vec4(center, 1.0);
        view.xy += position.xy * size;

        vUv = uv;
        vColor = aColor * strength;
        vSparkle = aShape.y;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vSparkle;

      void main() {
        vec2 masks = texture2D(uAtlas, vUv).rg;
        float light = mix(masks.r, masks.g, vSparkle);
        gl_FragColor = vec4(vColor * light, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
