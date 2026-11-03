import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { heroReferenceCamera } from '../heroCamera';
import { getComposition } from './composition';
import { NOISE_GLSL } from './noiseField';

/**
 * The Earth's surface, baked once.
 *
 * Nobody ever leaves low orbit, so nobody sees more than a cap of the globe. All
 * of the map's texels are spent on that cap rather than wrapped around a sphere,
 * where a 2048 map would leave ten screen pixels per texel at the opening shot.
 *
 * The map holds fields rather than colours, because the runtime shader sharpens
 * them with a tiling detail texture: thresholding a smooth field against fine
 * noise gives crisp cloud edges and city grain at any distance.
 *
 *   r  cloud density, 0.5 at the edge of a cloud
 *   g  land height, 0.5 at the coast
 *   b  city light density
 *   a  thin high cirrus
 */

export const EARTH_CAP_DEGREES = 37;

export interface EarthFrame {
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
  capSin: number;
}

export interface EarthBake {
  map: THREE.Texture;
  detail: THREE.Texture;
  dispose(): void;
}

/** Orthonormal axes of the map, with `z` from the Earth's centre towards the world. */
export function earthFrame(): EarthFrame {
  const { earth } = getComposition();
  const z = earth.center.clone().negate().normalize();
  const x = new THREE.Vector3(1, 0, 0).sub(z.clone().multiplyScalar(z.x)).normalize();
  const y = z.clone().cross(x);
  return { x, y, z, capSin: Math.sin(THREE.MathUtils.degToRad(EARTH_CAP_DEGREES)) };
}

/*
 * Hand placement. Each row is (u, v, radius, weight) in the opening frame, so the
 * noise that fills the sphere can be steered to put weather and cities where the
 * composition wants them. Anywhere the opening camera cannot see is left to noise.
 */
const CLOUD_SPOTS: readonly (readonly [number, number, number, number])[] = [
  [0.69, 0.95, 0.07, 0.62],
  [0.62, 0.9, 0.06, 0.5],
  [0.74, 1.0, 0.06, 0.55],
  [0.56, 0.86, 0.045, 0.36],
  [0.11, 0.67, 0.05, 0.4],
  [0.15, 0.685, 0.035, 0.46],
  [0.06, 0.72, 0.045, 0.3],
  [0.21, 0.73, 0.04, 0.38],
  [0.375, 0.965, 0.05, 0.36],
  [0.28, 0.895, 0.016, 0.3],
];

const CITY_SPOTS: readonly (readonly [number, number, number, number])[] = [
  [0.39, 0.872, 0.04, 1.2],
  [0.295, 0.87, 0.024, 0.95],
  [0.335, 0.81, 0.032, 0.8],
  [0.43, 0.775, 0.036, 0.72],
  [0.46, 0.905, 0.036, 0.66],
  [0.5, 0.84, 0.04, 0.5],
  [0.08, 0.68, 0.025, 0.22],
  [0.15, 0.74, 0.03, 0.18],
  [0.44, 0.84, 0.095, 0.34],
  [0.56, 0.93, 0.07, 0.34],
];

/* Weather pushed away from the city lights so they stay readable. */
const CLEAR_SPOTS: readonly (readonly [number, number, number, number])[] = [
  [0.38, 0.84, 0.085, 0.42],
  [0.12, 0.88, 0.12, 0.5],
  [0.48, 0.73, 0.05, 0.22],
];

function spotUniform(spots: readonly (readonly [number, number, number, number])[]) {
  return spots.map(([u, v, radius, weight]) => new THREE.Vector4(u, v, radius, weight));
}

const MAP_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform highp sampler3D uNoise;
  uniform vec3 uAxisX;
  uniform vec3 uAxisY;
  uniform vec3 uAxisZ;
  uniform float uCapSin;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform mat4 uHeroViewProjection;
  uniform vec4 uCloudSpots[${CLOUD_SPOTS.length}];
  uniform vec4 uCitySpots[${CITY_SPOTS.length}];
  uniform vec4 uClearSpots[${CLEAR_SPOTS.length}];

  varying vec2 vUv;

  ${NOISE_GLSL}

  float spot(vec2 frame, vec4 s) {
    vec2 offset = (frame - s.xy) * vec2(16.0 / 9.0, 1.0) / s.z;
    return s.w * exp(-dot(offset, offset));
  }

  /* Rotate n about axis, more strongly near the axis: a cyclone. */
  vec3 swirl(vec3 n, vec3 axis, float reach, float strength) {
    float falloff = exp(-(1.0 - dot(n, axis)) / reach);
    float angle = strength * falloff;
    float c = cos(angle);
    float s = sin(angle);
    return n * c + cross(axis, n) * s + axis * dot(axis, n) * (1.0 - c);
  }

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uCapSin;
    float z = sqrt(max(1.0 - dot(p, p), 0.0));
    vec3 n = uAxisX * p.x + uAxisY * p.y + uAxisZ * z;

    vec4 clip = uHeroViewProjection * vec4(uCenter + n * uRadius, 1.0);
    vec2 frame = clip.xy / clip.w * vec2(0.5, -0.5) + 0.5;
    float visible = step(0.0, clip.w);

    /* Land. A coarse warp keeps coastlines from looking like blobs of noise. */
    vec3 q = n * 7.0;
    vec4 warpLand = noise4(q * 0.6 + vec3(3.0, 41.0, 17.0));
    float continents = fbm(q + (warpLand.xyz - 0.5) * 4.0 + vec3(12.0, 5.0, 29.0), 7);
    float height = 0.5 + (continents - 0.03) * 2.1;

    /* Weather: cyclones first, so everything after them spirals. */
    vec3 c = swirl(n, normalize(uAxisZ + uAxisX * 0.31 + uAxisY * 0.22), 0.012, 3.4);
    c = swirl(c, normalize(uAxisZ - uAxisX * 0.26 + uAxisY * 0.36), 0.009, -3.0) * 27.0;

    vec3 warp = vec3(
      fbm(c * 0.17 + vec3(7.0, 3.0, 1.0), 4),
      fbm(c * 0.17 + vec3(1.0, 9.0, 5.0), 4),
      fbm(c * 0.17 + vec3(4.0, 2.0, 8.0), 4)
    );
    float systems = fbm(c * 0.22 + warp * 1.5 + vec3(2.0, 8.0, 3.0), 3);
    float body = fbm(c + warp * 4.5 + vec3(9.0, 1.0, 6.0), 7, 0.62);
    float puffs = billowy(c * 2.3 + warp * 7.0 + vec3(5.0, 5.0, 2.0), 5, 0.6);

    float cloud = 0.36 + body * 2.2 + systems * 1.15 + (puffs - 0.3) * 0.5;

    for (int i = 0; i < ${CLOUD_SPOTS.length}; i++) cloud += visible * spot(frame, uCloudSpots[i]);
    for (int i = 0; i < ${CLEAR_SPOTS.length}; i++) cloud -= visible * spot(frame, uClearSpots[i]);

    /* Long stretched cirrus, thin enough to see through. */
    float cirrus = fbm(c * vec3(0.6, 2.2, 1.1) + warp * 9.0 + vec3(13.0, 7.0, 4.0), 6);
    cirrus = smoothstep(-0.12, 0.3, cirrus);

    /* Cities follow land, and cluster. Hand-placed spots lift the opening shot. */
    float urban = fbm(n * 34.0 + warpLand.xyz * 3.0 + vec3(3.0, 19.0, 6.0), 7, 0.6);
    float grain = fbm(n * 190.0 + vec3(6.0, 2.0, 11.0), 5, 0.6);
    float city = smoothstep(0.03, 0.26, urban) * smoothstep(0.47, 0.54, height);
    float placed = 0.0;
    for (int i = 0; i < ${CITY_SPOTS.length}; i++) placed += visible * spot(frame, uCitySpots[i]);
    float placedGrain = smoothstep(-0.14, 0.1, urban + grain * 1.2);
    placed *= 0.42 + 0.58 * smoothstep(-0.07, 0.1, fbm(n * 13.0 + vec3(31.0, 4.0, 12.0), 4));
    city = max(city * 0.5, min(placed, 1.15) * (0.3 + 0.7 * placedGrain));

    /* Hand-placed cities need land under them even where the noise made sea. */
    height = max(height, 0.5 + placed * placedGrain * 0.2);

    gl_FragColor = vec4(
      clamp(cloud, 0.0, 1.0),
      clamp(height, 0.0, 1.0),
      clamp(city * 0.87, 0.0, 1.0),
      cirrus
    );
  }
`;

/*
 * One tile of fine detail. Sampling the volume in whole multiples of its own
 * period makes the tile repeat seamlessly, which no rotated fbm could do.
 *
 *   r  soft billow, eats cloud edges
 *   g  terrain texture
 *   b  city grain
 *   a  wisps
 */
const DETAIL_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform highp sampler3D uNoise;
  varying vec2 vUv;

  ${NOISE_GLSL}

  float tile(vec2 uv, float frequency, float slice, int channel) {
    return voxels(vec3(uv * frequency * 64.0, slice))[channel];
  }

  void main() {
    vec2 warp = vec2(tile(vUv, 1.0, 3.0, 2), tile(vUv, 1.0, 9.0, 3)) - 0.5;
    vec2 uv = vUv + warp * 0.03;

    float billow = tile(uv, 1.0, 1.0, 0) * 0.5
      + tile(uv, 2.0, 2.0, 1) * 0.27
      + tile(uv, 4.0, 3.0, 2) * 0.15
      + tile(uv, 8.0, 4.0, 3) * 0.08;

    float terrain = tile(uv, 2.0, 5.0, 0) * 0.45
      + tile(uv, 4.0, 6.0, 1) * 0.35
      + tile(uv, 8.0, 7.0, 2) * 0.2;

    float dots = tile(uv, 2.0, 8.0, 1) * 0.35
      + tile(uv, 4.0, 9.0, 2) * 0.4
      + tile(uv, 8.0, 10.0, 3) * 0.25;
    float grain = clamp((dots - 0.5) * 2.6 + 0.5, 0.0, 1.0);

    float wisps = tile(uv, 4.0, 11.0, 3) * 0.6 + tile(uv, 8.0, 12.0, 0) * 0.4;

    gl_FragColor = vec4(billow, terrain, grain, wisps);
  }
`;

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function createTarget(size: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.NoColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 8,
  });
}

/**
 * Render in tiles. A single draw over sixteen million pixels on integrated
 * graphics runs long enough to trip the driver's GPU watchdog; separate draws let
 * it breathe. Mipmaps are only built after the last tile.
 */
function renderTiled(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  material: THREE.ShaderMaterial,
  tilesPerSide: number,
): void {
  const quad = new FullScreenQuad(material);
  const texture = target.texture;
  const size = target.width;
  const tile = size / tilesPerSide;

  renderer.initRenderTarget(target);
  texture.generateMipmaps = false;
  target.scissorTest = true;

  const previousTarget = renderer.getRenderTarget();
  const previousAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);

  for (let y = 0; y < tilesPerSide; y += 1) {
    for (let x = 0; x < tilesPerSide; x += 1) {
      target.scissor.set(x * tile, y * tile, tile, tile);
      renderer.setRenderTarget(target);
      if (x === tilesPerSide - 1 && y === tilesPerSide - 1) texture.generateMipmaps = true;
      quad.render(renderer);
    }
  }

  target.scissorTest = false;
  renderer.setRenderTarget(previousTarget);
  renderer.autoClear = previousAutoClear;
  quad.dispose();
}

export function bakeEarth(
  renderer: THREE.WebGLRenderer,
  noise: THREE.Data3DTexture,
  mapSize: number,
): EarthBake {
  const { earth } = getComposition();
  const frame = earthFrame();
  const hero = heroReferenceCamera();
  const heroViewProjection = new THREE.Matrix4().multiplyMatrices(
    hero.projectionMatrix,
    hero.matrixWorldInverse,
  );

  const mapMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noise },
      uAxisX: { value: frame.x },
      uAxisY: { value: frame.y },
      uAxisZ: { value: frame.z },
      uCapSin: { value: frame.capSin },
      uCenter: { value: earth.center },
      uRadius: { value: earth.radius },
      uHeroViewProjection: { value: heroViewProjection },
      uCloudSpots: { value: spotUniform(CLOUD_SPOTS) },
      uCitySpots: { value: spotUniform(CITY_SPOTS) },
      uClearSpots: { value: spotUniform(CLEAR_SPOTS) },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: MAP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const detailMaterial = new THREE.ShaderMaterial({
    uniforms: { uNoise: { value: noise } },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: DETAIL_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const mapTarget = createTarget(mapSize);
  const detailTarget = createTarget(1024);

  renderTiled(renderer, mapTarget, mapMaterial, mapSize > 2048 ? 4 : 2);
  renderTiled(renderer, detailTarget, detailMaterial, 1);

  mapMaterial.dispose();
  detailMaterial.dispose();

  return {
    map: mapTarget.texture,
    detail: detailTarget.texture,
    dispose() {
      mapTarget.dispose();
      detailTarget.dispose();
    },
  };
}
