'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse } from '@/universe/state/store';
import { world } from '@/universe/world/world';
import { PATH_SAMPLES, planTraffic, type TrafficPlan } from './trafficPlan';

/**
 * The data packets. One instanced mesh: a bright capsule with a fading trail. The
 * vertex shader finds each vertex's place along its road from a baked path
 * texture, so a trail bends with the road and no packet costs anything on the CPU.
 */

const vertexShader = /* glsl */ `
uniform highp sampler2D uPaths;
uniform float uTime;

attribute vec4 aRoute;     // path row, start phase, speed, lane
attribute vec4 aTint;      // rgb, trail length
attribute vec2 aPathInfo;  // length, closed
attribute float aFade;     // per vertex: 1 at the head, 0 at the tail's end

varying vec3 vColor;

const float HOVER = 0.17;

vec3 pathAt(float row, float dist, float length_, float closed) {
  float last = float(textureSize(uPaths, 0).x - 1);
  float t = dist / length_;
  t = closed > 0.5 ? fract(t) : clamp(t, 0.0, 1.0);
  float position_ = t * last;
  float index = floor(position_);
  ivec2 a = ivec2(int(index), int(row));
  ivec2 b = ivec2(int(min(index + 1.0, last)), int(row));
  return mix(texelFetch(uPaths, a, 0).xyz, texelFetch(uPaths, b, 0).xyz, position_ - index);
}

void main() {
  float row = aRoute.x;
  float lengthOfPath = aPathInfo.x;
  float closed = aPathInfo.y;
  float direction = sign(aRoute.z);

  float travelled = mod(aRoute.y * lengthOfPath + uTime * abs(aRoute.z), lengthOfPath);
  float head = direction > 0.0 ? travelled : lengthOfPath - travelled;

  /* Local z runs forwards from the head and backwards along the trail. */
  float local = position.z < 0.0 ? position.z * aTint.a : position.z;
  float along = head + direction * local;

  vec3 here = pathAt(row, along, lengthOfPath, closed);
  vec3 ahead = pathAt(row, along + direction * 0.5, lengthOfPath, closed);
  vec3 tangent = normalize(ahead - here);
  vec3 right = normalize(vec3(-tangent.z, 0.0, tangent.x));
  vec3 up = cross(right, tangent);

  vec3 world = here + right * (aRoute.w + position.x) + up * (HOVER + position.y);

  float ends = 1.0;
  if (closed < 0.5) {
    float fromStart = min(along, travelled);
    ends = smoothstep(0.0, 3.0, travelled) * smoothstep(0.0, 3.0, lengthOfPath - travelled);
    ends *= smoothstep(0.0, 1.0, fromStart);
  }

  vColor = aTint.rgb * aFade * ends;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;

void main() {
  /* A trail fades to zero at its edges, and MSAA can extrapolate past that: see materials.ts. */
  gl_FragColor = vec4(max(vColor, vec3(0.0)), 1.0);
  #include <colorspace_fragment>
}
`;

/** Half-height and half-width of the capsule, and where along it the trail begins. */
const BODY_RADIUS = 0.055;
const BODY_LENGTH = 0.42;

/**
 * Local packet shape: a small faceted capsule ahead of z = 0, with two crossed
 * ribbons behind it. Trail vertices sit at z −1 to 0, scaled per packet.
 */
function packetGeometry(): THREE.BufferGeometry {
  const rings = [
    { z: BODY_LENGTH, r: 0.001, fade: 1 },
    { z: BODY_LENGTH * 0.72, r: BODY_RADIUS * 0.8, fade: 1 },
    { z: BODY_LENGTH * 0.3, r: BODY_RADIUS, fade: 1 },
    { z: 0, r: BODY_RADIUS * 0.8, fade: 0.8 },
  ];
  const sides = 6;
  const positions: number[] = [];
  const fades: number[] = [];
  const indices: number[] = [];

  rings.forEach((ring) => {
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      positions.push(Math.cos(angle) * ring.r, Math.sin(angle) * ring.r, ring.z);
      fades.push(ring.fade);
    }
  });

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const a = ring * sides + side;
      const b = ring * sides + ((side + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  }

  /* The trail is bright down its middle and fades to nothing at its edges and its end. */
  const trail = (axisX: number, axisY: number) => {
    const steps = 6;
    const base = positions.length / 3;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const width = BODY_RADIUS * 1.5 * (1 - t) ** 0.5;
      const fade = 0.34 * (1 - t) ** 1.8;
      const z = -t - 1e-3;
      positions.push(axisX * width, axisY * width, z);
      positions.push(0, 0, z);
      positions.push(-axisX * width, -axisY * width, z);
      fades.push(0, fade, 0);
    }
    for (let step = 0; step < steps; step += 1) {
      const a = base + step * 3;
      indices.push(a, a + 1, a + 4, a, a + 4, a + 3);
      indices.push(a + 1, a + 2, a + 5, a + 1, a + 5, a + 4);
    }
  };
  trail(1, 0);
  trail(0, 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(fades, 1));
  geometry.setIndex(indices);
  return geometry;
}

function pathTexture(plan: TrafficPlan): THREE.DataTexture {
  const rows = plan.paths.length;
  const data = new Float32Array(PATH_SAMPLES * rows * 4);

  plan.paths.forEach((path, row) => {
    path.points.forEach((point, column) => {
      const p = (row * PATH_SAMPLES + column) * 4;
      data[p] = point.x;
      data[p + 1] = point.y;
      data[p + 2] = point.z;
      data[p + 3] = 1;
    });
  });

  const texture = new THREE.DataTexture(data, PATH_SAMPLES, rows, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function instancedGeometry(plan: TrafficPlan): THREE.InstancedBufferGeometry {
  const base = packetGeometry();
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('aFade', base.getAttribute('aFade'));

  const route = new Float32Array(plan.packets.length * 4);
  const tint = new Float32Array(plan.packets.length * 4);
  const info = new Float32Array(plan.packets.length * 2);

  plan.packets.forEach((packet, index) => {
    const path = plan.paths[packet.path];
    if (!path) throw new Error('Packet on a missing path');
    route.set([packet.path, packet.phase, packet.speed, packet.lane], index * 4);
    tint.set([...packet.color, packet.tail], index * 4);
    info.set([path.length, path.closed ? 1 : 0], index * 2);
  });

  geometry.setAttribute('aRoute', new THREE.InstancedBufferAttribute(route, 4));
  geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 4));
  geometry.setAttribute('aPathInfo', new THREE.InstancedBufferAttribute(info, 2));
  geometry.instanceCount = plan.packets.length;
  return geometry;
}

interface TrafficResources {
  geometry: THREE.InstancedBufferGeometry;
  material: THREE.ShaderMaterial;
  count: number;
}

let resources: TrafficResources | null = null;

function getTraffic(): TrafficResources {
  if (resources) return resources;
  const plan = planTraffic(world.network);
  resources = {
    geometry: instancedGeometry(plan),
    material: new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uPaths: { value: pathTexture(plan) }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    count: plan.packets.length,
  };
  return resources;
}

export function Traffic() {
  const { geometry, material, count } = useMemo(getTraffic, []);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);
  const time = useRef(0);

  useLayoutEffect(() => {
    geometry.instanceCount = quality === 'low' ? Math.floor(count / 2) : count;
  }, [geometry, quality, count]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    time.current += Math.min(delta, 0.1);
    (material.uniforms.uTime as THREE.IUniform<number>).value = time.current;
  });

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
  );
}


