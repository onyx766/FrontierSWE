import * as THREE from 'three';
import { createRng } from '@/lib/rng';
import { COLORS } from '../palette';
import { polar, vec, type Vec3 } from '../../world/vec';
import { buildCageGeometry, type PortCage } from './fixtures';
import { createGemMaterials } from './gemMaterial';
import {
  buildGemFacets,
  buildHeartFacets,
  edgeDistances,
  facetTangent,
  GEM,
  gemSeams,
  roundedOutline,
  type GemFacet,
} from './gemShape';
import { bakeCrackTexture, bakeGlintTexture, bakeMarbleTexture, CRACK_TILE } from './gemTextures';
import { buildGlintGeometry, createGlintMaterial, createMotes, type Glint } from './glints';
import { createRibbonMaterial, rgb, RibbonBuilder, type Rgb } from './ribbons';

/**
 * Assembles the crystal: glass, lines, hardware and points of light. Built once
 * and kept for the life of the page, so that returning from a case study does not
 * bake the textures again.
 *
 * All the transparent parts share a bounding-sphere centre, so three sorts them
 * as equals against the rest of the world and breaks the tie by creation order.
 * The meshes below are therefore created in the order they must draw: glass that
 * absorbs first, then everything additive.
 */

export interface Crystal {
  root: THREE.Group;
  /** Advances every animated uniform. */
  tick(time: number, pulse: number): void;
  /** Keeps strip widths in pixels. Call when the view size or lens changes. */
  setPixelScale(worldPerPixelPerUnit: number): void;
  /** How far the camera is from the glass, negative when it is inside. */
  setCameraClearance(clearance: number): void;
  /** Where the name plate sits in the lens, so that lines behind it can recede. */
  setPlate(centerX: number, centerY: number, halfX: number, halfY: number, shade: number): void;
  setDetail(high: boolean): void;
}

const SHARED_BOUNDS = new THREE.Sphere(new THREE.Vector3(0, -4, 0), 36);

/** The seed at the crystal's heart. It stays behind the name plate at the opening shot. */
const HEART = { y: 0.6, radius: 4.1, height: 5.4 } as const;

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(value: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Line colour on the gem: electric blue at the crown, burning to orange at the base. */
function edgeColor(point: Vec3): Rgb {
  const blue = rgb('#2a82ff', 1.45);
  const violet = rgb('#6f50ff', 1);
  const lilac = rgb('#a884ff', 1.4);
  const orange = rgb('#ff7a2a', 1.9);

  /* Along the girdle the right flank burns, and the left only near its two corners. */
  const warm = point.x >= 0 ? 1 : Math.max(ramp(-point.x, 13.5, 18), 1 - ramp(-point.x, 3, 11));
  const base = mixRgb(lilac, orange, warm);

  let color = mixRgb(base, violet, ramp(point.y, -10.6, -5));
  color = mixRgb(color, blue, ramp(point.y, -3, 5));

  const burning = mixRgb(color, orange, ramp(-point.y, 11.4, 13));

  /* The crown's rim is the brightest cool line on the crystal. */
  const crown = 1 + 0.5 * ramp(point.y, 9, 12);
  return [burning[0] * crown, burning[1] * crown, burning[2] * crown];
}

/**
 * How brightly each of a facet's four panes is frosted, in the reference's
 * arrangement: on the crown the east pane burns, the west glows and north and
 * south stay deep. Order is low-left, low-right, high-left, high-right, where
 * left is the negative pane coordinate.
 */
const PANE_FROST: Record<string, readonly [number, number, number, number]> = {
  top: [0.72, 0.1, 0.05, 1],
  'side:-1,1': [0.5, 0.4, 0.2, 0.25],
  'side:1,1': [0.85, 0.62, 0.28, 0.1],
  'side:1,-1': [0.5, 0.2, 0.34, 0.12],
  'side:-1,-1': [0.26, 0.48, 0.1, 0.3],
  'lower:-1,1': [0.9, 0.7, 0.9, 0.7],
  'lower:1,1': [0.8, 1, 0.8, 1],
  'lower:1,-1': [0.7, 0.45, 0.7, 0.45],
  'lower:-1,-1': [0.5, 0.8, 0.5, 0.8],
};

/**
 * Which patch of the crack texture the opening shot's three facets show. Every
 * facet reads its own patch of one continuous image, so these were picked by eye
 * for where the fractures fall, against the reference. The rest are seeded.
 */
const HERO_PATCH: Record<string, readonly [number, number]> = {
  top: [0.419, 0.352],
  'side:-1,1': [0.602, 0.727],
  'side:1,1': [0.178, 0.479],
};

/** Names a main facet by what it faces. */
function facetKey(facet: GemFacet): string {
  if (facet.kind === 'top') return 'top';
  return `${facet.kind}:${Math.sign(facet.normal.x)},${Math.sign(facet.normal.z)}`;
}

/** Position within a facet's two-by-two panes. The joints are at zero. */
function paneCoordinate(facet: GemFacet, point: Vec3, tangent: Vec3): [number, number] {
  if (facet.kind === 'top') return [point.x + point.z, point.x - point.z];
  const across = point.x * tangent.x + point.z * tangent.z;
  return [across, point.y - (GEM.top + GEM.girdle) / 2];
}

function buildGlassGeometry(facets: GemFacet[]): THREE.BufferGeometry {
  const random = createRng(23);
  const positions: number[] = [];
  const normals: number[] = [];
  const tangents: number[] = [];
  const uvs: number[] = [];
  const edges: number[] = [];
  const panes: number[] = [];
  const frosts: number[] = [];
  const indices: number[] = [];

  for (const facet of facets) {
    const base = positions.length / 3;
    const tangent = facetTangent(facet);
    const bitangent = vec(
      facet.normal.y * tangent.z - facet.normal.z * tangent.y,
      facet.normal.z * tangent.x - facet.normal.x * tangent.z,
      facet.normal.x * tangent.y - facet.normal.y * tangent.x,
    );
    const distances = edgeDistances(facet);
    const frost = PANE_FROST[facetKey(facet)] ?? [0.8, 0.8, 0.8, 0.8];
    const seeded = [random(), random()] as const;
    const [offsetU, offsetV] = HERO_PATCH[facetKey(facet)] ?? seeded;

    facet.points.forEach((point, index) => {
      positions.push(point.x, point.y, point.z);
      normals.push(facet.normal.x, facet.normal.y, facet.normal.z);
      tangents.push(tangent.x, tangent.y, tangent.z);
      uvs.push(
        (point.x * tangent.x + point.y * tangent.y + point.z * tangent.z) / CRACK_TILE + offsetU,
        (point.x * bitangent.x + point.y * bitangent.y + point.z * bitangent.z) / CRACK_TILE +
          offsetV,
      );
      edges.push(...(distances[index] as number[]));
      panes.push(...paneCoordinate(facet, point, tangent));
      frosts.push(...frost);
    });

    for (let corner = 1; corner < facet.points.length - 1; corner += 1) {
      indices.push(base, base + corner, base + corner + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aTangent', new THREE.Float32BufferAttribute(tangents, 3));
  geometry.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 4));
  geometry.setAttribute('aPane', new THREE.Float32BufferAttribute(panes, 2));
  geometry.setAttribute('aFrost', new THREE.Float32BufferAttribute(frosts, 4));
  geometry.setIndex(indices);
  return geometry;
}

function wallIndexCount(facets: GemFacet[]): number {
  return facets.reduce((total, facet) => total + (facet.points.length - 2) * 3, 0);
}

function subdivide(from: Vec3, to: Vec3, pieces: number): Vec3[] {
  return Array.from({ length: pieces + 1 }, (_, index) => {
    const t = index / pieces;
    return vec(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t,
    );
  });
}

function addGemLines(builder: RibbonBuilder, facets: GemFacet[]) {
  for (const facet of facets) {
    if (facet.kind === 'bevel' || facet.kind === 'corner') continue;

    /* From the opening shot the lower ridges lie along the girdle, so they share its light. */
    const strength = facet.kind === 'lower' ? 0.45 : 1;
    builder.add(roundedOutline(facet, 0.03, 1.15, 1.4), {
      width: 0.26,
      minPixels: 5,
      closed: true,
      facet: facet.normal,
      color: (point) => {
        const color = edgeColor(point);
        return [color[0] * strength, color[1] * strength, color[2] * strength];
      },
    });
  }

  for (const seam of gemSeams()) {
    builder.add(subdivide(seam.from, seam.to, 12), {
      width: 0.09,
      minPixels: 1.25,
      facet: seam.normal,
      color: (point) => {
        const color = edgeColor(point);
        return [color[0] * 0.09, color[1] * 0.09, color[2] * 0.09];
      },
    });
  }
}

/** Sectors between the spokes that carry the arcs: the two flanks of the opening shot. */
const ARC_SECTORS = [270, 90];

function arc(radius: number, bearing: number, spread: number, y: number): Vec3[] {
  const steps = Math.ceil(spread * 1.5);
  return Array.from({ length: steps + 1 }, (_, index) =>
    polar(radius, bearing - spread / 2 + (spread * index) / steps, y),
  );
}

/**
 * The fine holographic arcs hugging the gem at Ring height, as in the reference.
 * Their radii stay inside the Core Loop's inner edge, and they sit below the road.
 */
function addArcs(builder: RibbonBuilder) {
  const y = -1.4;
  const inner = rgb(COLORS.violet, 0.26);
  const outer = rgb('#7a7cff', 0.34);

  for (const sector of ARC_SECTORS) {
    builder.add(arc(20.4, sector, 46, y), {
      width: 0.1,
      minPixels: 1.3,
      color: (_, t) => {
        const fade = Math.sin(t * Math.PI);
        return [inner[0] * fade, inner[1] * fade, inner[2] * fade];
      },
    });
    builder.add(arc(21.9, sector, 62, y), {
      width: 0.1,
      minPixels: 1.4,
      color: (_, t) => {
        const fade = Math.sin(t * Math.PI) ** 0.6;
        return [outer[0] * fade, outer[1] * fade, outer[2] * fade];
      },
    });

    /* A small bracket holding each end of the arc pair. */
    for (const end of [-1, 1]) {
      const bearing = sector + end * 23;
      const bracket = { width: 0.08, minPixels: 1.2, color: () => outer };
      builder.add([polar(20.2, bearing, y), polar(22.1, bearing, y)], bracket);
      builder.add(arc(20.2, bearing - end * 1.2, 2.4, y), bracket);
      builder.add(arc(22.1, bearing - end * 1.2, 2.4, y), bracket);
    }
  }
}

/** A beam leaving the gem through a port: hot where it leaves, fading to nothing. */
function addBeam(
  builder: RibbonBuilder,
  origin: THREE.Vector3,
  axis: THREE.Vector3,
  length: number,
  width: number,
  color: Rgb,
) {
  const from = vec(origin.x, origin.y, origin.z);
  const to = vec(
    origin.x + axis.x * length,
    origin.y + axis.y * length,
    origin.z + axis.z * length,
  );
  builder.add(subdivide(from, to, 10), {
    width,
    minPixels: 2.2,
    color: (_, t) => {
      const fade = (1 - t) ** 1.6;
      return [color[0] * fade, color[1] * fade, color[2] * fade];
    },
  });
}

const APEX_PORT: PortCage = {
  origin: new THREE.Vector3(0, GEM.apex + 0.5, 0),
  axis: new THREE.Vector3(0, -1, 0),
  length: 6,
  radius: 1.9,
  light: new THREE.Color('#ff8a3c'),
};

const CROWN_PORT: PortCage = {
  origin: new THREE.Vector3(0, GEM.top - 0.25, -GEM.radius + 0.4),
  axis: new THREE.Vector3(0, 0.55, -0.84).normalize(),
  length: 4.2,
  radius: 1.25,
  light: new THREE.Color('#58a4ff'),
};

function buildGlints(): Glint[] {
  const blue = rgb('#4f9dff', 0.5);
  const violet = rgb('#6a4cff', 0.09);
  const hot = rgb('#ff9a4a', 0.9);

  return [
    { position: [0, -2, 0], size: 30, color: violet, sparkle: 0, twinkle: 0.31 },
    { position: [0, HEART.y, 0], size: 12, color: rgb('#8a7cff', 0.3), sparkle: 0, twinkle: 0.46 },
    { position: [0, HEART.y, 0], size: 6, color: rgb('#dfe4ff', 1.1), sparkle: 1, twinkle: 0.58 },
    { position: [0, GEM.top + 0.1, -3.2], size: 6.5, color: rgb('#dbe8ff', 2.6), sparkle: 1, twinkle: 0.7 },
    { position: [-8.9, GEM.top + 0.1, -8.7], size: 3.2, color: rgb('#9cc4ff', 1.5), sparkle: 1, twinkle: 0.53 },
    { position: [8.2, GEM.top + 0.1, 5.1], size: 2.8, color: rgb('#c9b4ff', 1.3), sparkle: 1, twinkle: 0.44 },
    { position: [CROWN_PORT.origin.x, CROWN_PORT.origin.y, CROWN_PORT.origin.z], size: 9, color: blue, sparkle: 0, twinkle: 0.41 },
    { position: [0, GEM.apex, 0], size: 10, color: hot, sparkle: 0, twinkle: 0.37 },
    { position: [0, GEM.girdle, GEM.radius], size: 5, color: hot, sparkle: 0, twinkle: 0.29 },
    { position: [-GEM.radius, GEM.girdle, 0], size: 3.6, color: rgb('#ff8f6a', 0.5), sparkle: 0 },
    { position: [GEM.radius, GEM.girdle, 0], size: 4, color: rgb('#ffa35c', 0.6), sparkle: 0 },
    { position: [-GEM.radius, GEM.top, 0], size: 3, color: rgb('#6fb0ff', 0.4), sparkle: 0 },
    { position: [GEM.radius, GEM.top, 0], size: 3, color: rgb('#6fb0ff', 0.4), sparkle: 0 },
    { position: [0, GEM.top, -GEM.radius], size: 3.4, color: rgb('#8cc0ff', 0.6), sparkle: 0 },
    { position: [-21.9, -1.4, 0], size: 0.8, color: rgb('#b9b4ff', 1.6), sparkle: 0 },
    { position: [21.9, -1.4, 0], size: 0.8, color: rgb('#b9b4ff', 1.6), sparkle: 0 },
  ];
}

const RISE_HEIGHT = 34;

let crystal: Crystal | null = null;

function createCrystal(): Crystal {
  const textures = {
    cracks: bakeCrackTexture(),
    marble: bakeMarbleTexture(),
  };
  const facets = buildGemFacets();
  const heart = buildHeartFacets(HEART.y, HEART.radius, HEART.height);

  /* The heart only adds light, so the absorbing pass draws just the outer walls. */
  const glass = buildGlassGeometry([...facets, ...heart]);
  glass.boundingSphere = SHARED_BOUNDS.clone();
  const walls = glass.clone();
  walls.setDrawRange(0, wallIndexCount(facets));
  walls.boundingSphere = SHARED_BOUNDS.clone();
  const materials = createGemMaterials(textures);

  const root = new THREE.Group();
  root.name = 'crystal';

  /* Created in draw order; see the note at the top of this file. */
  const body = new THREE.Mesh(walls, materials.body);
  const shell = new THREE.Mesh(glass, materials.shell);

  const ribbons = new RibbonBuilder();
  addGemLines(ribbons, facets);
  addArcs(ribbons);
  addBeam(ribbons, APEX_PORT.origin, APEX_PORT.axis, 8.5, 0.9, rgb('#ff8f3a', 2.4));
  addBeam(ribbons, CROWN_PORT.origin, CROWN_PORT.axis, 8, 0.5, rgb('#4f9dff', 2.2));
  const ribbonGeometry = ribbons.build();
  ribbonGeometry.boundingSphere = SHARED_BOUNDS.clone();
  const ribbonMaterial = createRibbonMaterial();
  const lines = new THREE.Mesh(ribbonGeometry, ribbonMaterial);

  const glintGeometry = buildGlintGeometry(
    buildGlints(),
    createMotes({ count: 56, seed: 5, innerRadius: 19.5, outerRadius: 23, bottom: -22 }),
  );
  glintGeometry.boundingSphere = SHARED_BOUNDS.clone();
  const glintMaterial = createGlintMaterial(bakeGlintTexture(), RISE_HEIGHT);
  const glints = new THREE.Mesh(glintGeometry, glintMaterial);

  const cages = new THREE.Mesh(
    buildCageGeometry([APEX_PORT, CROWN_PORT]),
    new THREE.MeshBasicMaterial({ vertexColors: true }),
  );

  root.add(body, shell, lines, glints, cages);

  return {
    root,
    tick(time, pulse) {
      /* The two glass materials share these uniform objects, so this sets both. */
      materials.body.uniforms.uTime!.value = time;
      materials.body.uniforms.uGlow!.value = pulse;
      glintMaterial.uniforms.uTime!.value = time;
      ribbonMaterial.uniforms.uGlow!.value = pulse;
    },
    setPixelScale(worldPerPixelPerUnit) {
      ribbonMaterial.uniforms.uPixel!.value = worldPerPixelPerUnit;
    },
    setCameraClearance(clearance) {
      /* The chase camera can trail into the gem, and the robot must stay in sight. */
      materials.body.uniforms.uSolid!.value = THREE.MathUtils.smoothstep(clearance, -0.6, 2.2);
    },
    setPlate(centerX, centerY, halfX, halfY, shade) {
      (ribbonMaterial.uniforms.uPlate!.value as THREE.Vector4).set(centerX, centerY, halfX, halfY);
      ribbonMaterial.uniforms.uPlateShade!.value = shade;
    },
    setDetail(high) {
      materials.shell.uniforms.uDetail!.value = high ? 1 : 0;
    },
  };
}

export function getCrystal(): Crystal {
  crystal ??= createCrystal();
  return crystal;
}
