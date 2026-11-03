import * as THREE from 'three';
import { COLORS } from '../palette';
import { getPadTextures } from './padTextures';

/**
 * The GPU side of the station pads: every pad in the world is two instanced draw
 * calls. One is the lit machined disc, which takes reflections from the
 * environment. The other is a single additive shader holding the turning marks,
 * the pulse and the beam, all driven by per-instance attributes so that nothing
 * is touched per frame except a clock and the few pads that are changing state.
 */

/** Height of the pad's top face above the surface it sits on. */
export const PAD_LIFT = 0.035;

const BEAM_HEIGHT = 15;
const BEAM_HALF_WIDTH = 1.05;

/** A machined disc: a chamfered top sitting just proud of the deck or road plate below. */
export function createPadGeometry(): THREE.BufferGeometry {
  /*
   * Bottom to top: a lathe's faces point outwards only when its profile rises. Lathe
   * normals are smooth, so each crease has a point close to it on either side;
   * without them the shading would bend across the whole top face.
   */
  const profile: [number, number][] = [
    [1, -0.12],
    [1, -0.035],
    [0.985, -0.012],
    [0.975, 0],
    [0.965, 0],
    [0, 0],
  ];
  const lathe = new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    56,
  );

  /* A lathe unwraps around the axis; the pad texture is a plan view, so project from above. */
  const position = lathe.getAttribute('position') as THREE.BufferAttribute;
  const uv = lathe.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, position.getX(i) * 0.5 + 0.5, 0.5 - position.getZ(i) * 0.5);
  }
  return lathe;
}

export function createPadMaterial(): THREE.MeshStandardMaterial {
  const textures = getPadTextures();
  return new THREE.MeshStandardMaterial({
    map: textures.color,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: textures.roughness,
    roughness: 1,
    metalness: 0.92,
    envMapIntensity: 1.25,
    /* Pads sit on road inlays that are almost at the same height. */
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * One flat quad for the marks and one upright quad for the beam. `aPart` tells
 * the shader which it is positioning: the beam's quad turns about its own axis to
 * face the camera, which gives a soft column from every angle for two triangles.
 */
export function createPadGlowGeometry(): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  const positions = new Float32Array([
    -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, -1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0,
  ]);
  const parts = new Float32Array([0, 0, 0, 0, 1, 1, 1, 1]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPart', new THREE.BufferAttribute(parts, 1));
  geometry.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

const glowVertex = /* glsl */ `
  attribute float aPart;
  attribute vec3 aTint;
  attribute float aSeed;
  /* x: 0 unvisited to 1 visited. y: hover and standing-on focus. */
  attribute vec2 aState;

  uniform float uTime;
  uniform float uBeamHeight;
  uniform float uBeamHalfWidth;

  varying float vPart;
  varying vec3 vTint;
  varying float vSeed;
  varying vec2 vState;
  varying vec2 vPlan;
  varying vec2 vTicks;
  varying vec2 vSegments;
  varying vec2 vBeam;
  varying float vDistanceFade;

  vec2 turned(vec2 point, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * point.x - s * point.y, s * point.x + c * point.y) * 0.5 + 0.5;
  }

  void main() {
    vec3 origin = instanceMatrix[3].xyz;
    float radius = length(instanceMatrix[0].xyz);
    vec3 world;

    if (aPart < 0.5) {
      world = origin + vec3(position.x * radius, 0.0, position.z * radius);
      vPlan = position.xz;
      float turn = uTime * (0.14 + aState.y * 0.3) + aSeed * 6.283;
      vTicks = turned(position.xz, turn);
      vSegments = turned(position.xz, -turn * 1.7);
      /* From afar the fine marks merge into a solid ring, so they are eased back. */
      vDistanceFade = mix(1.0, 0.62, smoothstep(50.0, 190.0, length(cameraPosition - origin)));
    } else {
      vec3 toCamera = cameraPosition - origin;
      vec3 side = normalize(vec3(toCamera.z, 0.0, -toCamera.x));
      float standing = 1.0 - aState.x;
      float height = uBeamHeight * standing * standing;
      world = origin + side * position.x * uBeamHalfWidth * (radius / 2.6);
      world.y += position.y * height;
      vBeam = position.xy;
      /* A pin of light from afar; close to it, the same beam would be a solid bar. */
      vDistanceFade = mix(0.3, 1.0, smoothstep(12.0, 70.0, length(toCamera)));
    }

    vPart = aPart;
    vTint = aTint;
    vSeed = aSeed;
    vState = aState;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform sampler2D uMarks;
  uniform vec3 uVisited;
  uniform float uTime;

  varying float vPart;
  varying vec3 vTint;
  varying float vSeed;
  varying vec2 vState;
  varying vec2 vPlan;
  varying vec2 vTicks;
  varying vec2 vSegments;
  varying vec2 vBeam;
  varying float vDistanceFade;

  void main() {
    float visited = vState.x;
    float focus = vState.y;
    /* A flash as the colour changes, so that arriving feels like a reward. */
    float flash = sin(visited * 3.14159) * 2.2;
    vec3 tint = mix(vTint, uVisited, visited);
    float strength;

    if (vPart < 0.5) {
      float radius = length(vPlan);
      if (radius > 1.0) discard;

      float ticks = texture2D(uMarks, vTicks).r;
      float segments = texture2D(uMarks, vSegments).g;
      float fine = texture2D(uMarks, vPlan * 0.5 + 0.5).b;

      float wave = fract(uTime * 0.21 + vSeed);
      float offset = (radius - wave) * 13.0;
      float pulse = exp(-offset * offset) * (1.0 - wave) * smoothstep(0.0, 0.12, wave);

      strength = ticks * 3.4 + segments * 3.0 + fine * 1.5 + pulse * 0.85;
      strength += exp(-radius * radius * 2.6) * 0.09;
      strength *= vDistanceFade * (1.0 + focus * 0.9) + flash;
    } else {
      float across = vBeam.x;
      float along = vBeam.y;
      float core = exp(-across * across * 110.0);
      float halo = exp(-across * across * 7.0);
      float rise = 1.0 - along;
      strength = (core * 1.5 + halo * 0.13) * rise * rise;
      strength *= smoothstep(0.0, 0.02, along);
      strength *= 0.92 + 0.08 * sin(uTime * 1.3 + vSeed * 6.283);
      strength *= vDistanceFade * (1.0 + focus * 0.8 + flash);
    }

    gl_FragColor = vec4(tint * strength, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createPadGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMarks: { value: getPadTextures().marks },
      uVisited: { value: new THREE.Color(COLORS.green) },
      uTime: { value: 0 },
      uBeamHeight: { value: BEAM_HEIGHT },
      uBeamHalfWidth: { value: BEAM_HALF_WIDTH },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
}
