import * as THREE from 'three';
import { getIslandPlans } from './islandPlan';
import { buildIslandPlatform } from './platformGeometry';
import { buildIslandRock } from './rockGeometry';
import { TriangleSoup } from './soup';
import { createDeckSurface, createRockSurface, createTrimSurface } from './surfaceTextures';

/**
 * Every island's static geometry, merged per material, so that all six cost five
 * draw calls together. Built on first use and kept for the life of the page, like
 * the kit: returning from a case study re-uses it rather than rebaking.
 */

export interface IslandPart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export interface IslandAssets {
  parts: IslandPart[];
  /** Shared by the drifting shards. */
  rockMaterial: THREE.MeshStandardMaterial;
  /** Seconds, advanced by the layer; drives the shimmer along the rim strips. */
  shimmerTime: THREE.IUniform<number>;
}

interface SoupChannels {
  surface: boolean;
  glow: boolean;
}

export function soupGeometry(soup: TriangleSoup, channels: SoupChannels): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const attribute = (values: number[], size: number) =>
    new THREE.BufferAttribute(new Float32Array(values), size);

  geometry.setAttribute('position', attribute(soup.positions, 3));
  geometry.setAttribute('color', attribute(soup.colors, 3));
  if (channels.surface) {
    geometry.setAttribute('normal', attribute(soup.normals, 3));
    geometry.setAttribute('uv', attribute(soup.uvs, 2));
  }
  if (channels.glow) geometry.setAttribute('glow', attribute(soup.glows, 3));
  return geometry;
}

/**
 * Adds a baked per-vertex light to a lit material. A strip's glow on the rock
 * below it has to read on faces no scene light reaches, so it is emission, not
 * a vertex colour. `response` is GLSL for how a surface takes that light. Emission
 * ignores the normal map, so the rock's response embosses it by hand, as if lit
 * from above, or its relief would vanish wherever the glow is strongest.
 *
 * `sunGlare` scales direct specular only. The scene's lights sit low, so at the
 * grazing angles of a walking camera Fresnel turns rough surfaces into a pale
 * sheet that drowns their colour. Reflections of the sky are left alone.
 */
function withBakedGlow(
  material: THREE.MeshStandardMaterial,
  name: string,
  response: string,
  sunGlare: number,
): THREE.MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * (${response});`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>\nreflectedLight.directSpecular *= ${sunGlare.toFixed(2)};`,
      );
  };
  material.customProgramCacheKey = () => `island-glow-${name}`;
  return material;
}

/**
 * A slow travelling swell along the strips, in the vertex shader so it costs
 * nothing. The fragment clamp matters: under MSAA a thin sliver's colour is
 * extrapolated outside the triangle at its edges and can go negative, which an
 * HDR target keeps, so that additive light would punch black specks in the strip.
 */
function withShimmer(material: THREE.MeshBasicMaterial, time: THREE.IUniform<number>): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        vColor *= 0.86 + 0.14 * sin(uTime * 1.3 + position.x * 0.31 + position.z * 0.27);`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 24.0);`,
    );
  };
  material.customProgramCacheKey = () => 'island-shimmer';
}

function buildAssets(anisotropy: number): IslandAssets {
  const rock = new TriangleSoup();
  const deck = new TriangleSoup();
  const hull = new TriangleSoup();
  const light = new TriangleSoup();
  const haze = new TriangleSoup();

  for (const plan of getIslandPlans()) {
    rock.append(buildIslandRock(plan), plan.center);
    const platform = buildIslandPlatform(plan);
    deck.append(platform.deck, plan.center);
    hull.append(platform.hull, plan.center);
    light.append(platform.light, plan.center);
    haze.append(platform.haze, plan.center);
  }

  const shimmerTime: THREE.IUniform<number> = { value: 0 };

  /* Decks sit exactly at y = 0, as do Ring decks; let every road win that tie. */
  const deckMaterial = withBakedGlow(
    new THREE.MeshStandardMaterial({
      ...createDeckSurface(anisotropy),
      roughness: 1,
      metalness: 0.68,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    }),
    'deck',
    '0.3 + sampledDiffuseColor.g * 5.0',
    0.34,
  );

  const hullMaterial = withBakedGlow(
    new THREE.MeshStandardMaterial({
      ...createTrimSurface(anisotropy),
      roughness: 1,
      metalness: 0.32,
      vertexColors: true,
    }),
    'hull',
    '0.14 + sampledDiffuseColor.g * 2.2',
    0.7,
  );

  const rockMaterial = withBakedGlow(
    new THREE.MeshStandardMaterial({
      ...createRockSurface(anisotropy),
      roughness: 0.94,
      metalness: 0.04,
      vertexColors: true,
    }),
    'rock',
    `(0.12 + sampledDiffuseColor.g * 0.6) *
      clamp(1.0 + 1.5 * dot(normal - nonPerturbedNormal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.6, 1.5)`,
    0.22,
  );

  const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  const hazeMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  withShimmer(hazeMaterial, shimmerTime);

  return {
    parts: [
      {
        name: 'rock',
        geometry: soupGeometry(rock, { surface: true, glow: true }),
        material: rockMaterial,
      },
      {
        name: 'deck',
        geometry: soupGeometry(deck, { surface: true, glow: true }),
        material: deckMaterial,
      },
      {
        name: 'hull',
        geometry: soupGeometry(hull, { surface: true, glow: true }),
        material: hullMaterial,
      },
      {
        name: 'light',
        geometry: soupGeometry(light, { surface: false, glow: false }),
        material: lightMaterial,
      },
      {
        name: 'haze',
        geometry: soupGeometry(haze, { surface: false, glow: false }),
        material: hazeMaterial,
      },
    ],
    rockMaterial,
    shimmerTime,
  };
}

/** Anisotropy above this costs fill rate on the low-end GPUs and is not visible. */
const MAX_ANISOTROPY = 8;

let assets: IslandAssets | null = null;

export function getIslandAssets(gl: THREE.WebGLRenderer): IslandAssets {
  assets ??= buildAssets(Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy()));
  return assets;
}
