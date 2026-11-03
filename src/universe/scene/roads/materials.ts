import * as THREE from 'three';
import { DECK_FAMILIES, type DeckFamily } from './roadTypes';
import type { MeshBuffer } from './sweep';
import { bakeDecals, bakeDeck, bakeFlow, bakeHull, bakePlate, type SurfaceMaps } from './textures';

/**
 * The road layer's materials: one per surface family, so the whole network costs
 * a handful of draw calls however long it is.
 *
 * Lit surfaces are `MeshStandardMaterial`, so they reflect the environment like
 * everything else, with one addition. No layer may add a light, so what a real
 * neon strip would do to the metal beside it is baked into each vertex:
 *
 *   aLight.rgb   tints the emissive mask carried in the `orm` texture's red channel
 *   aLight.a     how much of that colour pools on the surface, scaled by its albedo
 *
 * The pool is what makes a stretch of Ring read as lit by the island beside it.
 */

export interface RoadMaterials {
  decks: Record<DeckFamily, THREE.MeshStandardMaterial>;
  hull: THREE.MeshStandardMaterial;
  plates: THREE.MeshStandardMaterial;
  lights: THREE.MeshBasicMaterial;
  decals: THREE.MeshBasicMaterial;
  /** Scrolled once a frame, which moves every pulse in every strip. */
  flow: THREE.Texture;
  /** Set when the canvas resizes, from the height of the frame in device pixels. */
  stripPixel: THREE.IUniform<number>;
}

const vertexHead = /* glsl */ `
attribute vec4 aLight;
varying vec4 vLight;
`;

const fragmentHead = /* glsl */ `
varying vec4 vLight;
`;

/**
 * Runs straight after three's own emissive step, with the `orm` texel already
 * read. A fine pattern of small lights, like the Helix's grate, averages to a flat
 * wash at a distance, so `range` fades it out between two view distances.
 */
function emissiveStep(range: readonly [number, number] | undefined): string {
  const fade = range
    ? `* (1.0 - smoothstep(${range[0].toFixed(1)}, ${range[1].toFixed(1)}, length(vViewPosition)))`
    : '';
  return /* glsl */ `
  totalEmissiveRadiance = vLight.rgb * (totalEmissiveRadiance * texelRoughness.r ${fade} + vLight.a * diffuseColor.rgb);
  `;
}

/**
 * `scene.environment` ignores `material.envMapIntensity`, and a sky bright enough
 * to shape rock and glass washes dark metal out to a pale haze when seen at a low
 * angle along a road. Reflections stay, but at the strength these decks want.
 */
const reflectionStep = /* glsl */ `
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  radiance *= ROAD_REFLECTION;
  iblIrradiance *= ROAD_REFLECTION;
#endif
`;

/**
 * A flat deck turns its whole length into one highlight when seen towards a low
 * light, which hides every seam on it. Keeping that sheen down leaves the rim-lit
 * edges and bolts, which are curved or chamfered, to do the catching.
 */
const specularStep = /* glsl */ `
reflectedLight.directSpecular *= 0.5;
`;

function bakedLightProgram(reflection: number, range: readonly [number, number] | undefined) {
  return (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHead}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLight = aLight;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${fragmentHead}\n#define ROAD_REFLECTION ${reflection.toFixed(3)}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${emissiveStep(range)}`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>\n${reflectionStep}`,
      )
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${specularStep}`);
  };
}

/**
 * Thin strips hold a minimum width on screen. A line slim enough to look right
 * from a few units away would fall below a pixel from the opening shot and
 * shimmer, so it grows with distance just enough to stay a clean line, and dims
 * as it does so that a far-off line is no brighter overall than a near one.
 *
 * That minimum is well over a pixel, because of how these strips are shaded. MSAA
 * does little for a line this far above 1: a pixel a quarter covered still resolves
 * to bright white, so the line comes out stepped. Strips are therefore brightest
 * down their middle and fade to nothing at their edges, which anti-aliases them in
 * the geometry itself, and that needs a couple of pixels to work in.
 */
const stripVertexHead = /* glsl */ `
attribute vec4 aSpread;
uniform float uPixel;
`;

const stripVertexStep = /* glsl */ `
#include <begin_vertex>
if (aSpread.w != 0.0) {
  float reach = abs(aSpread.w);
  float depth = -(modelViewMatrix * vec4(transformed, 1.0)).z;
  float scale = length(aSpread.xyz);
  float wanted = scale * depth * uPixel / projectionMatrix[1][1];
  float grow = max(0.0, wanted - reach);
  vColor *= mix(1.0, reach / (reach + grow), 0.3);
  if (aSpread.w < 0.0) grow = (grow + reach) * (1.0 - smoothstep(55.0, 130.0, depth)) - reach;
  if (scale > 0.0) transformed += aSpread.xyz / scale * grow;
}
`;

/**
 * With MSAA a pixel only partly on a thin triangle is shaded at its own centre,
 * which may be off the triangle, so a colour that fades to zero at the strip's edge
 * extrapolates below zero there. Negative light poisons the multisample resolve and
 * shows as dark specks along the brightest lines.
 */
const stripFragmentStep = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
`;

/** Road markings belong to walking pace: from the opening shot they would only be clutter. */
const decalVertexStep = /* glsl */ `
#include <begin_vertex>
vColor *= 1.0 - smoothstep(48.0, 105.0, -(modelViewMatrix * vec4(transformed, 1.0)).z);
`;

/** Half the wanted minimum width, as a fraction of the frame's height in device pixels. */
const STRIP_HALF_PIXELS = 1.25;

interface LitOptions {
  maps: SurfaceMaps;
  /** Strength of the emissive mask. Above 1, so that lit detail blooms. */
  glow: number;
  normalScale?: number;
  /** Depth bias against coplanar island decks, in depth-buffer steps. */
  bias?: number;
  /** Strength of environment reflections. */
  reflection?: number;
  /** View distances between which the emissive mask fades out. */
  glowRange?: readonly [number, number];
}

function litMaterial(options: LitOptions): THREE.MeshStandardMaterial {
  const { maps, glow, normalScale = 1, bias = 0, reflection = 0.42, glowRange } = options;
  const material = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
    roughness: 1,
    metalness: 1,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: glow,
    polygonOffset: bias !== 0,
    polygonOffsetFactor: bias !== 0 ? -1 : 0,
    polygonOffsetUnits: bias,
  });
  material.onBeforeCompile = bakedLightProgram(reflection, glowRange);
  material.customProgramCacheKey = () => `road-baked-light-${reflection}-${glowRange ?? 'far'}`;
  return material;
}

function decalMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    map,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', decalVertexStep);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      stripFragmentStep,
    );
  };
  material.customProgramCacheKey = () => 'road-decal';
  return material;
}

function stripMaterial(map: THREE.Texture, pixel: THREE.IUniform<number>): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    map,
    vertexColors: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    /* Strips sit a hair off the metal, which is nothing to the depth buffer from afar. */
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -8,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPixel = pixel;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${stripVertexHead}`)
      .replace('#include <begin_vertex>', stripVertexStep);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      stripFragmentStep,
    );
  };
  material.customProgramCacheKey = () => 'road-strip';
  return material;
}

/** Depth bias per family: decks that lie flush on islands must always win there. */
const DECK_BIAS: Record<DeckFamily, number> = {
  inlay: -2,
  helix: -3,
  ring: -4,
  spoke: -5,
  coreLoop: -1,
};

const DECK_GLOW: Record<DeckFamily, number> = {
  ring: 5,
  spoke: 5,
  coreLoop: 3.6,
  helix: 2.6,
  inlay: 3.2,
};

let materials: RoadMaterials | null = null;

export function getRoadMaterials(anisotropy: number): RoadMaterials {
  if (materials) return materials;

  const decks = Object.fromEntries(
    DECK_FAMILIES.map((family) => [
      family,
      litMaterial({
        maps: bakeDeck(family, anisotropy),
        glow: DECK_GLOW[family],
        bias: DECK_BIAS[family],
        ...(family === 'helix' ? { glowRange: [34, 95] as const } : {}),
      }),
    ]),
  ) as Record<DeckFamily, THREE.MeshStandardMaterial>;

  const flow = bakeFlow();
  const stripPixel: THREE.IUniform<number> = { value: stripPixelFor(941) };

  materials = {
    decks,
    hull: litMaterial({ maps: bakeHull(anisotropy), glow: 1 }),
    plates: litMaterial({ maps: bakePlate(anisotropy), glow: 4.5, bias: -6 }),
    lights: stripMaterial(flow, stripPixel),
    decals: decalMaterial(bakeDecals(anisotropy)),
    flow,
    stripPixel,
  };
  return materials;
}

/** The strip shader's size of a pixel, for a frame `height` device pixels tall. */
export function stripPixelFor(height: number): number {
  return (STRIP_HALF_PIXELS * 2) / height;
}

/**
 * A merged road buffer as GPU geometry. `lit` selects how the four light values
 * reach the shader: as `aLight`, or as an HDR `color` for unlit strips.
 */
export function toGeometry(buffer: MeshBuffer, lit: boolean): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffer.uvs, 2));

  if (lit) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffer.normals, 3));
    geometry.setAttribute('aLight', new THREE.Float32BufferAttribute(buffer.lights, 4));
  } else {
    const count = buffer.vertexCount;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = buffer.lights[i * 4] as number;
      colors[i * 3 + 1] = buffer.lights[i * 4 + 1] as number;
      colors[i * 3 + 2] = buffer.lights[i * 4 + 2] as number;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    buffer.padSpreads();
    geometry.setAttribute('aSpread', new THREE.Float32BufferAttribute(buffer.spreads, 4));
  }

  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer.indices), 1));
  geometry.computeBoundingSphere();
  return geometry;
}


