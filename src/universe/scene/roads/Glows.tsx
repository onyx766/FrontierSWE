'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { getKit } from '../kit';
import type { GlowPlacement } from './roadTypes';

/**
 * Soft additive haloes where the roads are hottest. One instanced quad that
 * billboards in its vertex shader, so dozens of glows are a single draw call
 * where the same number of `THREE.Sprite`s would be dozens.
 *
 * They ignore depth, as the bloom they stand in for does: a camera-facing quad
 * resting on a deck would otherwise cut through it in a hard line.
 */

const vertexShader = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
attribute vec3 aColor;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  vUv = uv;
  vec4 view = viewMatrix * vec4(aCenter, 1.0);

  /* A glow the camera has come right up to fades away rather than swallowing the view. */
  vColor = aColor * smoothstep(aSize * 0.5, aSize * 1.8, length(view.xyz));

  view.xy += position.xy * aSize;
  gl_Position = projectionMatrix * view;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uGlow;
varying vec2 vUv;
varying vec3 vColor;

void main() {
  float falloff = texture2D(uGlow, vUv).a;
  gl_FragColor = vec4(vColor * falloff, 1.0);
  #include <colorspace_fragment>
}
`;

function glowGeometry(glows: readonly GlowPlacement[]): THREE.InstancedBufferGeometry {
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('uv', plane.getAttribute('uv'));

  const centers = new Float32Array(glows.length * 3);
  const sizes = new Float32Array(glows.length);
  const colors = new Float32Array(glows.length * 3);
  glows.forEach((glow, index) => {
    centers.set([glow.x, glow.y, glow.z], index * 3);
    sizes[index] = glow.size;
    colors.set(glow.color, index * 3);
  });

  geometry.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3));
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.instanceCount = glows.length;
  return geometry;
}

export function Glows({ glows }: { glows: readonly GlowPlacement[] }) {
  const { geometry, material } = useMemo(
    () => ({
      geometry: glowGeometry(glows),
      material: new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uGlow: { value: getKit().glowTexture } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    }),
    [glows],
  );

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}
