'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createRng, rngBetween, rngPick } from '@/lib/rng';
import { useUniverse } from '../../state/store';
import { heroPoint, heroReferenceCamera } from '../heroCamera';
import type { FramePoint } from './composition';
import { skyClock } from './skyClock';

/**
 * Points in the sky. The baked background holds the faint star dust; these are the
 * stars crisp enough to matter, the cross-shaped sparkles, and motes near the
 * world that give walking some depth. Each set is one draw call, animated entirely
 * in its vertex shader.
 *
 * Stars and sparkles draw in the opaque pass, after the world and before the
 * planets. That way the planets cover them with no depth trickery at all.
 */

const STAR_SHELL = 8300;
const STAR_COUNT = 11000;
const MOTE_COUNT = 340;
const STARS_RENDER_ORDER = 999;

const STAR_TINTS: readonly (readonly [number, number, number])[] = [
  [1.0, 0.6, 0.32],
  [1.0, 0.66, 0.38],
  [1.0, 0.74, 0.48],
  [1.0, 0.86, 0.72],
  [0.78, 0.86, 1.0],
  [0.56, 0.72, 1.0],
];

/* Where the reference shows stars gathering. (u, v, spread, count) */
const STAR_CLUSTERS: readonly (readonly [number, number, number, number])[] = [
  [0.1, 0.5, 0.075, 170],
  [0.19, 0.57, 0.05, 70],
  [0.84, 0.79, 0.075, 90],
  [0.8, 0.885, 0.018, 60],
  [0.95, 0.525, 0.02, 44],
  [0.74, 0.1, 0.09, 80],
  [0.42, 0.6, 0.05, 50],
];

/* The bright knots of the small nebula low on the right. (u, v, size, r, g, b) */
const NEBULA_KNOTS: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.7905, 0.8905, 5.5, 2.1, 1.3, 2.6],
  [0.7945, 0.8815, 6.5, 2.4, 1.5, 2.8],
  [0.7885, 0.8775, 3.5, 1.5, 0.9, 1.9],
  [0.8005, 0.8725, 4, 1.7, 1.2, 1.6],
  [0.7975, 0.8945, 3, 1.5, 1.0, 1.0],
  [0.8125, 0.8695, 4, 1.4, 1.1, 1.4],
  [0.8235, 0.8785, 3.5, 1.5, 1.0, 0.8],
  [0.8305, 0.8645, 3, 1.1, 0.9, 1.5],
  [0.8085, 0.8895, 2.5, 1.5, 0.9, 0.6],
];

interface Sparkle {
  frame: FramePoint;
  size: number;
  color: string;
  intensity: number;
}

const HERO_SPARKLES: readonly Sparkle[] = [
  { frame: [0.06, 0.513], size: 64, color: '#ffb46e', intensity: 3 },
  { frame: [0.775, 0.127], size: 62, color: '#ffffff', intensity: 2.4 },
  { frame: [0.972, 0.912], size: 34, color: '#cfe0ff', intensity: 2.8 },
  { frame: [0.88, 0.944], size: 28, color: '#ffb873', intensity: 2.6 },
  { frame: [0.33, 0.032], size: 26, color: '#ffc58a', intensity: 2.2 },
  { frame: [0.883, 0.207], size: 30, color: '#ffffff', intensity: 2 },
  { frame: [0.737, 0.818], size: 24, color: '#ffc58a', intensity: 2.2 },
  { frame: [0.93, 0.896], size: 16, color: '#ffffff', intensity: 1.6 },
];

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute vec3 aStar;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;

  void main() {
    float flicker = 1.0 + aStar.z * sin(uTime * (0.5 + aStar.y * 1.4) + aStar.y * 50.0);
    vColor = aColor * flicker;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aStar.x * uPixelRatio;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float distance = length(gl_PointCoord - 0.5) * 2.0;
    float shape = smoothstep(1.0, 0.0, distance);
    gl_FragColor = vec4(vColor * shape * shape, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SPARKLE_FRAGMENT = /* glsl */ `
  uniform sampler2D uShape;
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor * texture2D(uShape, gl_PointCoord).r, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const MOTE_VERTEX = /* glsl */ `
  attribute vec4 aMote;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    float t = uTime * 0.11 + aMote.w * 40.0;
    vec3 drift = vec3(sin(t * 1.1), sin(t * 0.7 + 1.0) * 0.6, cos(t * 0.9)) * 1.6;
    vec4 view = modelViewMatrix * vec4(position + drift, 1.0);
    gl_Position = projectionMatrix * view;

    float depth = max(-view.z, 0.5);
    gl_PointSize = clamp(aMote.x * uScale / depth, 1.0, 9.0);

    /* Motes matter close to the camera, and vanish before they would fill the lens. */
    vAlpha = smoothstep(1.5, 7.0, depth) * smoothstep(150.0, 40.0, depth) * aMote.y * 0.6;
  }
`;

const MOTE_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    float distance = length(gl_PointCoord - 0.5) * 2.0;
    float shape = smoothstep(1.0, 0.1, distance);
    gl_FragColor = vec4(vec3(0.62, 0.74, 1.0) * shape * vAlpha, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function randomOnSphere(random: () => number, out: THREE.Vector3): THREE.Vector3 {
  const z = rngBetween(random, -1, 1);
  const angle = rngBetween(random, 0, Math.PI * 2);
  const ring = Math.sqrt(1 - z * z);
  return out.set(ring * Math.cos(angle), ring * Math.sin(angle), z);
}

const projected = new THREE.Vector3();

function inOpeningFrame(point: THREE.Vector3): boolean {
  projected.copy(point).project(heroReferenceCamera());
  return Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15 && projected.z < 1;
}

function gaussian(random: () => number): number {
  return (random() + random() + random() + random() - 2) * 1.2;
}

function createStars(): THREE.BufferGeometry {
  const random = createRng(0x57a2);
  const clustered = STAR_CLUSTERS.reduce((sum, cluster) => sum + cluster[3], 0);
  const total = STAR_COUNT + clustered + NEBULA_KNOTS.length;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const stars = new Float32Array(total * 3);
  const point = new THREE.Vector3();

  const writeStar = (index: number, brightnessBias: number) => {
    point.toArray(positions, index * 3);

    /* A steep power law: thousands of specks, a handful that catch the eye. */
    const magnitude = random() ** 7;
    const tint = rngPick(random, STAR_TINTS);
    const brightness = (0.14 + random() * 0.2 + magnitude * 2.1) * brightnessBias;
    colors[index * 3] = tint[0] * brightness;
    colors[index * 3 + 1] = tint[1] * brightness;
    colors[index * 3 + 2] = tint[2] * brightness;

    stars[index * 3] = 1.5 + magnitude * 2.4 + random() * 0.6;
    stars[index * 3 + 1] = random();
    stars[index * 3 + 2] = random() < 0.28 ? rngBetween(random, 0.12, 0.4) : 0.04;
  };

  for (let i = 0; i < STAR_COUNT; i += 1) {
    randomOnSphere(random, point).multiplyScalar(STAR_SHELL);
    writeStar(i, 1);
  }

  let index = STAR_COUNT;
  for (const [u, v, spread, count] of STAR_CLUSTERS) {
    for (let i = 0; i < count; i += 1) {
      point.copy(
        heroPoint(u + gaussian(random) * spread, v + gaussian(random) * spread * 1.6, STAR_SHELL),
      );
      writeStar(index, 1.15);
      index += 1;
    }
  }

  for (const [u, v, size, red, green, blue] of NEBULA_KNOTS) {
    heroPoint(u, v, STAR_SHELL).toArray(positions, index * 3);
    colors.set([red, green, blue], index * 3);
    stars.set([size, random(), 0.1], index * 3);
    index += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aStar', new THREE.BufferAttribute(stars, 3));
  return geometry;
}

function createSparkles(): THREE.BufferGeometry {
  const random = createRng(0x5bad);
  const scatterCount = 44;
  const total = HERO_SPARKLES.length + scatterCount;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const stars = new Float32Array(total * 3);
  const color = new THREE.Color();
  const point = new THREE.Vector3();

  HERO_SPARKLES.forEach((sparkle, index) => {
    heroPoint(sparkle.frame[0], sparkle.frame[1], STAR_SHELL).toArray(positions, index * 3);
    color.set(sparkle.color).multiplyScalar(sparkle.intensity).toArray(colors, index * 3);
    stars.set([sparkle.size, random(), 0.1], index * 3);
  });

  /* Lesser sparkles for the rest of the sky. The opening frame keeps exactly its hand-placed set. */
  for (let i = 0; i < scatterCount; i += 1) {
    const index = HERO_SPARKLES.length + i;
    do randomOnSphere(random, point).multiplyScalar(STAR_SHELL);
    while (inOpeningFrame(point));
    point.toArray(positions, index * 3);
    color
      .set(random() < 0.5 ? '#ffc58a' : '#dbe6ff')
      .multiplyScalar(rngBetween(random, 1.2, 2.2))
      .toArray(colors, index * 3);
    stars.set([rngBetween(random, 20, 58), random(), 0.14], index * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aStar', new THREE.BufferAttribute(stars, 3));
  return geometry;
}

function createMotes(): THREE.BufferGeometry {
  const random = createRng(0x307e);
  const positions = new Float32Array(MOTE_COUNT * 3);
  const motes = new Float32Array(MOTE_COUNT * 4);

  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const angle = rngBetween(random, 0, Math.PI * 2);
    const radius = Math.sqrt(random()) * 105;
    positions.set(
      [Math.cos(angle) * radius, rngBetween(random, -14, 24), Math.sin(angle) * radius],
      i * 3,
    );
    motes.set(
      [rngBetween(random, 0.12, 0.34), rngBetween(random, 0.25, 0.9), 0, random()],
      i * 4,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aMote', new THREE.BufferAttribute(motes, 4));
  return geometry;
}

/** A lens star: a soft core with long thin spikes, drawn once to a canvas. */
function createSparkleTexture(): THREE.CanvasTexture {
  const size = 256;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  context.fillStyle = '#000';
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'lighter';

  const glow = context.createRadialGradient(center, center, 0, center, center, center * 0.3);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.05, 'rgba(255,255,255,0.85)');
  glow.addColorStop(0.11, 'rgba(255,255,255,0.2)');
  glow.addColorStop(0.32, 'rgba(255,255,255,0.075)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  const drawSpike = (rotation: number, length: number, thickness: number, strength: number) => {
    context.save();
    context.translate(center, center);
    context.rotate(rotation);
    const gradient = context.createLinearGradient(-length, 0, length, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(-length, 0);
    context.quadraticCurveTo(0, thickness, length, 0);
    context.quadraticCurveTo(0, -thickness, -length, 0);
    context.fill();
    context.restore();
  };

  drawSpike(0, center * 0.98, 2.4, 0.85);
  drawSpike(Math.PI / 2, center * 0.98, 2.4, 0.85);
  drawSpike(Math.PI / 4, center * 0.3, 1.2, 0.14);
  drawSpike(-Math.PI / 4, center * 0.3, 1.2, 0.14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function pointsMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: skyClock, ...uniforms },
    vertexShader,
    fragmentShader,
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export function Starfield() {
  const quality = useUniverse((state) => state.quality);
  const pixelRatio = useThree((state) => state.viewport.dpr);

  const { stars, sparkles, sparkleTexture, starMaterial, sparkleMaterial } = useMemo(() => {
    const texture = createSparkleTexture();
    return {
      stars: createStars(),
      sparkles: createSparkles(),
      sparkleTexture: texture,
      starMaterial: pointsMaterial(STAR_VERTEX, STAR_FRAGMENT, { uPixelRatio: { value: 1 } }),
      sparkleMaterial: pointsMaterial(STAR_VERTEX, SPARKLE_FRAGMENT, {
        uPixelRatio: { value: 1 },
        uShape: { value: texture },
      }),
    };
  }, []);

  useEffect(() => {
    (starMaterial.uniforms.uPixelRatio as THREE.IUniform).value = pixelRatio;
    (sparkleMaterial.uniforms.uPixelRatio as THREE.IUniform).value = pixelRatio;
  }, [pixelRatio, starMaterial, sparkleMaterial]);

  useEffect(() => {
    stars.setDrawRange(0, quality === 'low' ? Math.floor(STAR_COUNT / 2) : Infinity);
  }, [quality, stars]);

  useEffect(
    () => () => {
      stars.dispose();
      sparkles.dispose();
      sparkleTexture.dispose();
      starMaterial.dispose();
      sparkleMaterial.dispose();
    },
    [stars, sparkles, sparkleTexture, starMaterial, sparkleMaterial],
  );

  return (
    <>
      <points
        geometry={stars}
        material={starMaterial}
        frustumCulled={false}
        renderOrder={STARS_RENDER_ORDER}
      />
      <points
        geometry={sparkles}
        material={sparkleMaterial}
        frustumCulled={false}
        renderOrder={STARS_RENDER_ORDER}
      />
    </>
  );
}

/** Dust near the world. Only the size scale follows the viewport. */
export function DustMotes() {
  const quality = useUniverse((state) => state.quality);
  const height = useThree((state) => state.size.height);
  const pixelRatio = useThree((state) => state.viewport.dpr);

  const { geometry, material } = useMemo(() => {
    const motesMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: skyClock, uScale: { value: 900 } },
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry: createMotes(), material: motesMaterial };
  }, []);

  useEffect(() => {
    (material.uniforms.uScale as THREE.IUniform).value = height * pixelRatio;
  }, [height, pixelRatio, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return quality === 'low' ? null : (
    <points geometry={geometry} material={material} frustumCulled={false} />
  );
}
