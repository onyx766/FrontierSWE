'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { heroReferenceCamera } from '../heroCamera';
import { getComposition, heroRay } from './composition';
import { NOISE_GLSL } from './noiseField';

/**
 * The second planet, off the right of frame. Same trick as the Earth: a sphere
 * intersected per pixel. It is so far away that its face hardly changes as the
 * visitor moves, so its map is simply a picture of the disc, drawn head-on.
 */

const SHELL_MARGIN = 90;
const MAP_SIZE = 1024;

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/* r: banded albedo  g: mottling  b: pale cloud */
const MAP_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform highp sampler3D uNoise;
  uniform vec3 uAxisX;
  uniform vec3 uAxisY;
  uniform vec3 uAxisZ;
  uniform vec3 uPole;
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float z = sqrt(max(1.0 - dot(p, p), 0.0));
    vec3 n = uAxisX * p.x + uAxisY * p.y + uAxisZ * z;

    float warp = fbm(n * 4.0 + vec3(3.0, 7.0, 1.0), 5);
    float latitude = dot(n, uPole) + warp * 0.22;
    float bands = 0.5 + 0.5 * sin(latitude * 21.0 + sin(latitude * 7.0) * 2.0);

    float mottle = 0.5 + fbm(n * 11.0 + warp * 4.0 + vec3(11.0, 2.0, 5.0), 8, 0.62) * 3.1;
    float cloud = smoothstep(0.1, 0.17, fbm(n * 6.0 + warp * 5.0 + vec3(1.0, 30.0, 9.0), 8, 0.62));

    gl_FragColor = vec4(bands, mottle, cloud, 1.0);
  }
`;

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform vec3 uAxisX;
  uniform vec3 uAxisY;
  uniform vec3 uLight;
  uniform vec3 uHotspot;

  varying vec3 vWorld;

  void main() {
    vec3 ray = normalize(vWorld - cameraPosition);
    vec3 toCenter = uCenter - cameraPosition;
    float along = dot(toCenter, ray);
    float missSquared = dot(toCenter, toCenter) - along * along;
    float altitude = sqrt(max(missSquared, 0.0)) - uRadius;

    float chord = sqrt(max(uRadius * uRadius - missSquared, 0.0));
    vec3 normal = normalize(cameraPosition + ray * (along - chord) - uCenter);
    vec4 map = texture2D(uMap, 0.5 + 0.5 * vec2(dot(normal, uAxisX), dot(normal, uAxisY)));

    float mu = clamp(-dot(normal, ray), 0.0, 1.0);
    float lightAngle = dot(normal, uLight);
    float lit = smoothstep(0.42, 0.95, lightAngle);

    float ground = clamp(map.r * 0.3 + map.g * 0.8, 0.0, 1.0);
    vec3 surface = mix(vec3(0.0140, 0.0220, 0.0440), vec3(0.1250, 0.1500, 0.2300), ground);
    surface = mix(surface, vec3(0.4000, 0.4400, 0.6200), map.b * 0.8);
    vec3 color = surface * lit * (0.25 + 0.75 * lit);

    /* The lit crescent: a white-hot point on the limb, violet either side of it. */
    float hot = pow(max(dot(normal, uHotspot), 0.0), 60.0);
    float crescent = smoothstep(0.45, 0.8, lightAngle);
    float rim = pow(1.0 - mu, 6.0) * crescent;
    color += rim * vec3(0.2000, 0.1800, 0.7400);
    color += pow(1.0 - mu, 14.0) * vec3(1.2000, 1.1000, 3.4000) * (hot * 2.6 + crescent * 0.5);

    float height = max(altitude, 0.0);
    vec3 glow = vec3(0.5000, 0.3400, 1.9000) * exp(-height / 2.6) * (crescent * 0.7 + hot * 3.0);
    glow += vec3(0.0420, 0.0320, 0.1700) * exp(-height / 24.0) * crescent;

    float width = fwidth(altitude);
    float disc = 1.0 - smoothstep(-width, width, altitude);

    /* The unlit side melts into the sky rather than cutting a black hole in it. */
    float body = disc * smoothstep(-0.1, 0.42, lightAngle);
    color += vec3(0.0100, 0.0190, 0.0360) * body;

    gl_FragColor = vec4(color * disc + glow * (1.0 - disc), body);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface PlanetFrame {
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
}

/** Axes of the head-on map: `z` looks at the world, `y` is the sky's up. */
function planetFrame(): PlanetFrame {
  const { planet } = getComposition();
  const z = planet.center.clone().negate().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return { x, y, z };
}

export function bakePlanet(
  renderer: THREE.WebGLRenderer,
  noise: THREE.Data3DTexture,
): THREE.WebGLRenderTarget {
  const frame = planetFrame();
  const target = new THREE.WebGLRenderTarget(MAP_SIZE, MAP_SIZE, {
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    anisotropy: 4,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noise },
      uAxisX: { value: frame.x },
      uAxisY: { value: frame.y },
      uAxisZ: { value: frame.z },
      uPole: { value: new THREE.Vector3(0.32, 0.86, 0.4).normalize() },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: MAP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const quad = new FullScreenQuad(material);
  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  quad.render(renderer);
  renderer.setRenderTarget(previousTarget);

  quad.dispose();
  material.dispose();
  return target;
}

export function Planet({ map }: { map: THREE.Texture }) {
  const mesh = useMemo(() => {
    const { planet } = getComposition();
    const frame = planetFrame();

    /* The surface normal where a ray from the opening camera grazes the limb. */
    const camera = heroReferenceCamera().position;
    const toCenter = planet.center.clone().sub(camera);
    const rimNormal = (ray: THREE.Vector3) =>
      camera.clone().addScaledVector(ray, toCenter.dot(ray)).sub(planet.center).normalize();

    const hotspot = rimNormal(heroRay(0.8983, 0.2263));

    /* The light sits past the crescent's middle, slightly behind the planet. */
    const light = rimNormal(heroRay(0.925, 0.195))
      .multiplyScalar(0.85)
      .addScaledVector(frame.z, -0.2)
      .normalize();

    const geometry = new THREE.IcosahedronGeometry(1, 8);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uCenter: { value: planet.center },
        uRadius: { value: planet.radius },
        uAxisX: { value: frame.x },
        uAxisY: { value: frame.y },
        uLight: { value: light },
        uHotspot: { value: hotspot },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
    });

    const object = new THREE.Mesh(geometry, material);
    object.position.copy(planet.center);
    object.scale.setScalar(planet.radius + SHELL_MARGIN);
    object.renderOrder = 1000;
    return object;
  }, [map]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
}
