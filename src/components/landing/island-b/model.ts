import { createRng, rngBetween, rngPick } from '@/lib/rng';
import {
  TAU,
  angleGap,
  pointPolylineDistance,
  pointRectDistance,
  rectBoundingRadius,
  rectCorners,
  rectMaxRadius,
  rectMinRadius,
  rectsOverlap,
  type Rect,
} from './geometry';

/**
 * The floating island city as plain data: where every tower, tree, car and
 * waterfall sits, plus the rock underside as a triangle mesh. Pure and seeded
 * (no DOM, no Math.random), so it is unit-tested and the renderer only ever
 * projects it.
 *
 * World units: the island top is a disk of radius ~1 on the XZ plane at y = 0,
 * Y up. Everything upright stands on y = 0.
 */

export const ISLAND_SEED = 1207;

/** Ring road annulus. */
export const ROAD_INNER = 0.42;
export const ROAD_OUTER = 0.54;
/** Lane centre radii, inner to outer. The inner pair runs one way, the outer pair the other. */
export const LANE_RADII = [0.436, 0.465, 0.495, 0.524] as const;
export const PLAZA_RADIUS = 0.15;
export const AVENUE_HALF_WIDTH = 0.021;
/** The rim outline and the rock mesh share one angular resolution, so their edges meet exactly. */
export const RIM_SEGMENTS = 60;
export const ROCK_TIP_Y = -1.05;
/** Highest point of the city: the tip of the tower's antenna. */
const SKYLINE_TOP = 1.13;

export type FacadeStyle =
  | 'towerMain'
  | 'towerCrown'
  | 'podium'
  | 'glassIndigo'
  | 'glassBlue'
  | 'glassViolet'
  | 'glassSky'
  | 'ribbonLilac'
  | 'gridWhite'
  | 'house'
  | 'pavilion';

export type RoofKind = 'flat' | 'ac' | 'helipad' | 'antenna' | 'spire' | 'garden' | 'crown';

/** 0 round, 1 deep green, 2 lime, 3 cypress, 4 blossom, 5 bush. */
export type TreeKind = 0 | 1 | 2 | 3 | 4 | 5;

export interface Tier {
  y0: number;
  y1: number;
  hw: number;
  hd: number;
  style: FacadeStyle;
}

export interface Building extends Rect {
  id: number;
  zone: 'tower' | 'inner' | 'outer';
  /** Stacked boxes, bottom first; each sits on the one below (setbacks). */
  tiers: Tier[];
  roof: RoofKind;
  /** Height of the spire or antenna above the top tier (0 for none). */
  topper: number;
  /** 0..1, offsets this building's blinking and twinkling. */
  phase: number;
}

export interface Tree {
  x: number;
  z: number;
  /** Canopy radius. */
  size: number;
  kind: TreeKind;
}

export interface Lamp {
  x: number;
  z: number;
}

export interface Car {
  lane: number;
  /** Angle on the ring at time 0. */
  angle: number;
  /** Radians per second; the sign is the direction of travel. */
  speed: number;
  color: number;
}

export interface Waterfall {
  angle: number;
  width: number;
  /** How far the water falls before it dissolves into mist. */
  drop: number;
}

/** A stroke on the ground: points flat as [x0, z0, x1, z1, ...]. */
export interface GroundStroke {
  points: number[];
  width: number;
}

export interface Pond {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rot: number;
}

export interface Spot {
  x: number;
  z: number;
  r: number;
}

export interface Flower {
  x: number;
  z: number;
  color: number;
}

export interface RockMesh {
  rings: number;
  segments: number;
  /** xyz per vertex: rings x segments, then the tip. */
  positions: Float32Array;
  /** Three vertex indices per triangle, wound so the normal points outward. */
  triangles: Uint16Array;
  /** Unit outward normal per triangle (xyz). */
  normals: Float32Array;
  /** Stratum per triangle, 0 at the rim to rings - 1 at the tip. */
  bands: Uint8Array;
  /** 1 where the triangle is moss rather than bare rock. */
  moss: Uint8Array;
  /** -1, 0 or 1: a per-facet nudge to the shade, so neighbouring facets differ. */
  jitter: Int8Array;
}

/**
 * A small rock drifting beside the island, with its own low-poly mesh. It
 * floats in camera space (like the clouds), so it always hangs at the sides
 * where it reads well, rather than swinging round to the front.
 */
export interface Fragment {
  /** Angle around the island in camera space: 0 is right, PI is left. */
  angle: number;
  radius: number;
  /** Height of its grassy top. */
  y: number;
  /** Scale of the unit mesh, in world units. */
  size: number;
  /** 0..1, offsets its bob. */
  phase: number;
  /** xyz per vertex of the unit mesh: top centre, top ring, middle ring, tip. */
  positions: Float32Array;
  triangles: Uint8Array;
  /** Unit outward normal per triangle. */
  normals: Float32Array;
}

export interface IslandModel {
  seed: number;
  /** Rim radius per segment; segment i sits at angle i / RIM_SEGMENTS * TAU. */
  rim: Float32Array;
  /** Angles of the four avenues from the plaza to the ring road. */
  avenues: number[];
  tower: Building;
  /** Every other building, inner city first. */
  buildings: Building[];
  trees: Tree[];
  lamps: Lamp[];
  cars: Car[];
  waterfalls: Waterfall[];
  streams: GroundStroke[];
  ponds: Pond[];
  paths: GroundStroke[];
  viewpoints: Spot[];
  flowers: Flower[];
  rock: RockMesh;
  fragments: Fragment[];
}

/* ──────────────────────────────── Rim ──────────────────────────────── */

function buildRim(rng: () => number): Float32Array {
  const rim = new Float32Array(RIM_SEGMENTS);
  const p0 = rng() * TAU;
  const p1 = rng() * TAU;
  const p2 = rng() * TAU;
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    const a = (i / RIM_SEGMENTS) * TAU;
    rim[i] =
      0.952 +
      0.022 * Math.sin(3 * a + p0) +
      0.013 * Math.sin(5 * a + p1) +
      0.007 * Math.sin(9 * a + p2) +
      (rng() - 0.5) * 0.006;
  }
  return rim;
}

/** Rim radius at any angle, interpolated between segments. */
export function rimRadiusAt(rim: Float32Array, angle: number): number {
  const f = ((((angle / TAU) % 1) + 1) % 1) * rim.length;
  const i = Math.floor(f) % rim.length;
  const t = f - Math.floor(f);
  const a = rim[i] as number;
  const b = rim[(i + 1) % rim.length] as number;
  return a + (b - a) * t;
}

/* ─────────────────────────────── Tower ─────────────────────────────── */

function buildTower(rot: number): Building {
  return {
    id: 0,
    zone: 'tower',
    x: 0,
    z: 0,
    rot,
    hw: 0.09,
    hd: 0.09,
    tiers: [
      { y0: 0, y1: 0.075, hw: 0.09, hd: 0.09, style: 'podium' },
      { y0: 0.075, y1: 0.76, hw: 0.07, hd: 0.07, style: 'towerMain' },
      { y0: 0.76, y1: 0.9, hw: 0.052, hd: 0.052, style: 'towerCrown' },
    ],
    roof: 'spire',
    topper: SKYLINE_TOP - 0.9,
    phase: 0,
  };
}

/* ──────────────────────────── Inner city ───────────────────────────── */

interface RowSpec {
  r: number;
  perQuadrant: number;
  hw: [number, number];
  hd: [number, number];
  h: [number, number];
  tierChance: number;
  styles: FacadeStyle[];
  roofs: RoofKind[];
}

/** Three concentric rows of blocks between the avenues; taller toward the centre. */
const INNER_ROWS: RowSpec[] = [
  {
    r: 0.214,
    perQuadrant: 2,
    hw: [0.027, 0.033],
    hd: [0.024, 0.029],
    h: [0.42, 0.6],
    tierChance: 0.7,
    styles: ['glassIndigo', 'glassBlue', 'glassViolet', 'glassSky', 'glassIndigo'],
    roofs: ['antenna', 'spire', 'crown', 'antenna'],
  },
  {
    r: 0.293,
    perQuadrant: 3,
    hw: [0.024, 0.031],
    hd: [0.021, 0.026],
    h: [0.25, 0.41],
    tierChance: 0.45,
    styles: ['glassBlue', 'gridWhite', 'glassIndigo', 'ribbonLilac', 'glassSky', 'glassViolet'],
    roofs: ['ac', 'helipad', 'garden', 'antenna', 'ac'],
  },
  {
    r: 0.37,
    perQuadrant: 4,
    hw: [0.02, 0.027],
    hd: [0.018, 0.022],
    h: [0.12, 0.23],
    tierChance: 0.12,
    styles: ['gridWhite', 'ribbonLilac', 'glassBlue', 'glassSky', 'gridWhite'],
    roofs: ['ac', 'garden', 'flat', 'ac'],
  },
];

/** True when the rectangle keeps clear of every avenue strip. */
function clearOfAvenues(rect: Rect, avenues: number[], clearance: number): boolean {
  const corners = rectCorners(rect);
  for (const beta of avenues) {
    const fx = Math.cos(beta);
    const fz = Math.sin(beta);
    let minSide = Infinity;
    let maxSide = -Infinity;
    let ahead = false;
    for (const [x, z] of corners) {
      const side = -fz * x + fx * z;
      minSide = Math.min(minSide, side);
      maxSide = Math.max(maxSide, side);
      if (fx * x + fz * z > 0) ahead = true;
    }
    if (!ahead) continue;
    // Straddling the centre line, or within the strip on either side.
    if (minSide < clearance && maxSide > -clearance) return false;
  }
  return true;
}

function buildInner(rng: () => number, avenues: number[], tower: Building): Building[] {
  const placed: Building[] = [];
  for (const row of INNER_ROWS) {
    const delta = Math.asin(Math.min(0.95, (AVENUE_HALF_WIDTH + 0.012 + row.hw[1]) / row.r));
    const span = Math.PI / 2 - 2 * delta;
    for (let q = 0; q < 4; q += 1) {
      const base = avenues[q] as number;
      for (let k = 0; k < row.perQuadrant; k += 1) {
        const skip = rng() < 0.15;
        const a = base + delta + (span * (k + 0.5 + (rng() - 0.5) * 0.3)) / row.perQuadrant;
        const r = row.r + (rng() - 0.5) * 0.008;
        let hw = rngBetween(rng, row.hw[0], row.hw[1]);
        let hd = rngBetween(rng, row.hd[0], row.hd[1]);
        const h = rngBetween(rng, row.h[0], row.h[1]);
        const tierRoll = rng();
        const split = rngBetween(rng, 0.6, 0.78);
        const style = rngPick(rng, row.styles);
        const roof = rngPick(rng, row.roofs);
        const topperRoll = rng();
        const phase = rng();
        if (skip) continue;

        let rect: Rect | null = null;
        for (let attempt = 0; attempt < 3 && !rect; attempt += 1) {
          const candidate: Rect = { x: r * Math.cos(a), z: r * Math.sin(a), rot: a - Math.PI / 2, hw, hd };
          const fits =
            rectMaxRadius(candidate) < ROAD_INNER - 0.016 &&
            rectMinRadius(candidate) > PLAZA_RADIUS + 0.008 &&
            clearOfAvenues(candidate, avenues, AVENUE_HALF_WIDTH + 0.008) &&
            !rectsOverlap(candidate, tower, 0.03) &&
            placed.every((other) => !rectsOverlap(candidate, other, 0.012));
          if (fits) rect = candidate;
          else {
            hw *= 0.86;
            hd *= 0.9;
          }
        }
        if (!rect) continue;

        const tiers: Tier[] = [];
        if (tierRoll < row.tierChance) {
          const y1 = h * split;
          tiers.push({ y0: 0, y1, hw: rect.hw, hd: rect.hd, style });
          tiers.push({ y0: y1, y1: h, hw: rect.hw * 0.76, hd: rect.hd * 0.76, style });
        } else {
          tiers.push({ y0: 0, y1: h, hw: rect.hw, hd: rect.hd, style });
        }
        const topper =
          roof === 'antenna' ? 0.05 + topperRoll * 0.05 : roof === 'spire' ? 0.06 + topperRoll * 0.05 : 0;
        placed.push({ ...rect, id: 0, zone: 'inner', tiers, roof, topper, phase });
      }
    }
  }
  return placed;
}

/* ──────────────────────── Water, paths, outskirts ─────────────────────── */

function buildWaterfalls(rng: () => number): Waterfall[] {
  const base = rng() * TAU;
  const angles = [base, base + 2.15 + (rng() - 0.5) * 0.4, base + 4.15 + (rng() - 0.5) * 0.4];
  return angles.map((angle) => ({
    angle: ((angle % TAU) + TAU) % TAU,
    width: rngBetween(rng, 0.07, 0.095),
    drop: rngBetween(rng, 0.58, 0.74),
  }));
}

function buildStreams(
  rng: () => number,
  rim: Float32Array,
  waterfalls: Waterfall[],
): { streams: GroundStroke[]; ponds: Pond[] } {
  const streams: GroundStroke[] = [];
  const ponds: Pond[] = [];
  for (const fall of waterfalls) {
    const r0 = rngBetween(rng, 0.66, 0.71);
    const a0 = fall.angle + (rng() - 0.5) * 0.32;
    const r1 = rimRadiusAt(rim, fall.angle) - 0.004;
    const wiggle = rng() * TAU;
    const points: number[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const ease = t * t * (3 - 2 * t);
      const r = r0 + (r1 - r0) * t;
      const a = a0 + (fall.angle - a0) * ease + Math.sin(t * Math.PI * 2 + wiggle) * 0.035 * (1 - t);
      points.push(r * Math.cos(a), r * Math.sin(a));
    }
    streams.push({ points, width: fall.width * 0.42 });
    ponds.push({
      x: r0 * Math.cos(a0),
      z: r0 * Math.sin(a0),
      rx: rngBetween(rng, 0.046, 0.058),
      rz: rngBetween(rng, 0.032, 0.04),
      rot: a0 + Math.PI / 2 + (rng() - 0.5) * 0.6,
    });
  }
  return { streams, ponds };
}

function buildPaths(
  rng: () => number,
  rim: Float32Array,
  waterfalls: Waterfall[],
): { paths: GroundStroke[]; viewpoints: Spot[] } {
  const paths: GroundStroke[] = [];
  const viewpoints: Spot[] = [];
  const start = rng() * TAU;
  for (let k = 0; k < 4; k += 1) {
    let a = start + (k * Math.PI) / 2 + (rng() - 0.5) * 0.3;
    for (let tries = 0; tries < 6 && waterfalls.some((f) => angleGap(f.angle, a) < 0.5); tries += 1) a += 0.35;
    if (waterfalls.some((f) => angleGap(f.angle, a) < 0.42)) continue;
    const r0 = ROAD_OUTER + 0.026;
    const r1 = rimRadiusAt(rim, a) - 0.085;
    const wiggle = rng() * TAU;
    const points: number[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const r = r0 + (r1 - r0) * t;
      const aa = a + Math.sin(t * Math.PI * 1.5 + wiggle) * 0.05 * t;
      points.push(r * Math.cos(aa), r * Math.sin(aa));
    }
    paths.push({ points, width: 0.018 });
    const ex = points[points.length - 2] as number;
    const ez = points[points.length - 1] as number;
    viewpoints.push({ x: ex, z: ez, r: 0.03 });
  }
  return { paths, viewpoints };
}

interface Obstacles {
  rim: Float32Array;
  streams: GroundStroke[];
  ponds: Pond[];
  paths: GroundStroke[];
  viewpoints: Spot[];
}

/** True when a circle at (x, z) keeps `clearance` from water and paths. */
function clearOfGround(x: number, z: number, clearance: number, o: Obstacles): boolean {
  for (const s of o.streams) if (pointPolylineDistance(x, z, s.points) < s.width / 2 + clearance) return false;
  for (const p of o.ponds) if (Math.hypot(x - p.x, z - p.z) < Math.max(p.rx, p.rz) + clearance) return false;
  for (const p of o.paths) if (pointPolylineDistance(x, z, p.points) < p.width / 2 + clearance) return false;
  for (const v of o.viewpoints) if (Math.hypot(x - v.x, z - v.z) < v.r + clearance) return false;
  return true;
}

function insideRim(rect: Rect, rim: Float32Array, margin: number): boolean {
  return rectCorners(rect).every(([x, z]) => Math.hypot(x, z) < rimRadiusAt(rim, Math.atan2(z, x)) - margin);
}

function buildOuter(rng: () => number, o: Obstacles): Building[] {
  const placed: Building[] = [];
  const tryPlace = (rect: Rect, h: number, style: FacadeStyle, roof: RoofKind, phase: number) => {
    const ok =
      rectMinRadius(rect) > ROAD_OUTER + 0.035 &&
      insideRim(rect, o.rim, 0.06) &&
      clearOfGround(rect.x, rect.z, rectBoundingRadius(rect) + 0.016, o) &&
      placed.every((other) => !rectsOverlap(rect, other, 0.035));
    if (ok) placed.push({ ...rect, id: 0, zone: 'outer', tiers: [{ y0: 0, y1: h, hw: rect.hw, hd: rect.hd, style }], roof, topper: 0, phase });
    return ok;
  };

  // A low glass pavilion by the road, like a transit hall.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const a = rng() * TAU;
    const r = ROAD_OUTER + 0.075;
    const rect: Rect = { x: r * Math.cos(a), z: r * Math.sin(a), rot: a - Math.PI / 2, hw: 0.062, hd: 0.03 };
    if (tryPlace(rect, 0.052, 'pavilion', 'crown', rng())) break;
  }

  const styles: FacadeStyle[] = ['house', 'gridWhite', 'house', 'ribbonLilac', 'glassSky', 'house'];
  const roofs: RoofKind[] = ['garden', 'ac', 'flat', 'garden', 'ac', 'helipad'];
  for (let attempt = 0; attempt < 1400 && placed.length < 15; attempt += 1) {
    const a = rng() * TAU;
    const r = rngBetween(rng, 0.6, 0.86);
    const hw = rngBetween(rng, 0.024, 0.04);
    const hd = rngBetween(rng, 0.022, 0.033);
    const rot = a - Math.PI / 2 + (rng() - 0.5) * 0.3;
    const h = rngBetween(rng, 0.05, 0.12);
    const style = rngPick(rng, styles);
    const roof = rngPick(rng, roofs);
    tryPlace({ x: r * Math.cos(a), z: r * Math.sin(a), rot, hw, hd }, h, style, roof, rng());
  }
  return placed;
}

/* ─────────────────────────────── Trees ─────────────────────────────── */

function pickTreeKind(rng: () => number, weights: readonly number[]): TreeKind {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i] as number;
    if (roll <= 0) return i as TreeKind;
  }
  return 0;
}

const OUTER_TREE_WEIGHTS = [30, 20, 14, 16, 12, 8];
const INNER_TREE_WEIGHTS = [34, 0, 22, 10, 18, 16];

function buildTrees(
  rng: () => number,
  o: Obstacles,
  avenues: number[],
  buildings: Building[],
): Tree[] {
  const trees: Tree[] = [];
  const fits = (x: number, z: number, size: number): boolean => {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    if (r + size * 0.5 > rimRadiusAt(o.rim, a) - 0.022) return false;
    if (r > ROAD_INNER - 0.03 - size * 0.5 && r < ROAD_OUTER + 0.03 + size * 0.5) return false;
    if (r < PLAZA_RADIUS + size * 0.8) return false;
    if (r < ROAD_INNER) {
      for (const beta of avenues) {
        const ahead = Math.cos(beta) * x + Math.sin(beta) * z;
        const side = Math.abs(-Math.sin(beta) * x + Math.cos(beta) * z);
        if (ahead > 0 && side < AVENUE_HALF_WIDTH + size * 0.75) return false;
      }
    }
    for (const b of buildings) if (pointRectDistance(x, z, b) < size * 0.8 + 0.006) return false;
    if (!clearOfGround(x, z, size * 0.7, o)) return false;
    for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < (size + t.size) * 0.72) return false;
    return true;
  };
  const add = (x: number, z: number, size: number, kind: TreeKind) => {
    if (trees.length >= 80 || !fits(x, z, size)) return false;
    trees.push({ x, z, size, kind });
    return true;
  };

  // A fringe along the rim, so the edge reads as lush from every side.
  const fringeStart = rng() * TAU;
  for (let i = 0; i < 18; i += 1) {
    const a = fringeStart + (i / 18) * TAU + (rng() - 0.5) * 0.18;
    const size = rngBetween(rng, 0.026, 0.038);
    const r = rimRadiusAt(o.rim, a) - 0.05 - size * 0.4;
    add(r * Math.cos(a), r * Math.sin(a), size, pickTreeKind(rng, OUTER_TREE_WEIGHTS));
  }

  // Street trees between the inner blocks.
  for (let attempt = 0, placed = 0; attempt < 400 && placed < 14; attempt += 1) {
    const a = rng() * TAU;
    const r = rngBetween(rng, PLAZA_RADIUS + 0.03, ROAD_INNER - 0.035);
    const size = rngBetween(rng, 0.017, 0.025);
    if (add(r * Math.cos(a), r * Math.sin(a), size, pickTreeKind(rng, INNER_TREE_WEIGHTS))) placed += 1;
  }

  // Copses in the outskirts.
  for (let cluster = 0; cluster < 14 && trees.length < 76; cluster += 1) {
    const ca = rng() * TAU;
    const cr = rngBetween(rng, 0.62, 0.86);
    const cx = cr * Math.cos(ca);
    const cz = cr * Math.sin(ca);
    const count = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < count * 3 && trees.length < 76; i += 1) {
      const angle = rng() * TAU;
      const dist = Math.sqrt(rng()) * 0.085;
      const size = rngBetween(rng, 0.024, 0.04);
      add(cx + Math.cos(angle) * dist, cz + Math.sin(angle) * dist, size, pickTreeKind(rng, OUTER_TREE_WEIGHTS));
    }
  }
  return trees;
}

/* ─────────────────────────── Lamps and cars ─────────────────────────── */

function buildLamps(avenues: number[]): Lamp[] {
  const lamps: Lamp[] = [];
  const outer = 22;
  for (let i = 0; i < outer; i += 1) {
    const a = ((i + 0.5) / outer) * TAU;
    const r = ROAD_OUTER + 0.013;
    lamps.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
  }
  const inner = 20;
  for (let i = 0; i < inner; i += 1) {
    const a = (i / inner) * TAU;
    if (avenues.some((beta) => angleGap(beta, a) < 0.12)) continue;
    const r = ROAD_INNER - 0.011;
    lamps.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
  }
  return lamps;
}

function buildCars(rng: () => number): Car[] {
  const cars: Car[] = [];
  for (let lane = 0; lane < LANE_RADII.length; lane += 1) {
    // One speed per lane, so cars in a lane never pass through each other.
    const direction = lane < 2 ? 1 : -1;
    const speed = direction * rngBetween(rng, 0.13, 0.27);
    const start = rng() * TAU;
    const count = 3;
    for (let i = 0; i < count; i += 1) {
      cars.push({
        lane,
        angle: start + (i / count) * TAU + (rng() - 0.5) * 0.9,
        speed,
        color: Math.floor(rng() * 5),
      });
    }
  }
  return cars;
}

function buildFlowers(rng: () => number, o: Obstacles, buildings: Building[], trees: Tree[]): Flower[] {
  const flowers: Flower[] = [];
  for (let attempt = 0; attempt < 600 && flowers.length < 70; attempt += 1) {
    const a = rng() * TAU;
    const r = rngBetween(rng, ROAD_OUTER + 0.05, 0.9);
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    const color = Math.floor(rng() * 4);
    if (r > rimRadiusAt(o.rim, a) - 0.04) continue;
    if (!clearOfGround(x, z, 0.012, o)) continue;
    if (buildings.some((b) => pointRectDistance(x, z, b) < 0.02)) continue;
    if (trees.some((t) => Math.hypot(x - t.x, z - t.z) < t.size * 0.9)) continue;
    flowers.push({ x, z, color });
  }
  return flowers;
}

/* ──────────────────────────── Rock underside ──────────────────────────── */

/** Ring heights and radii (as a fraction of the rim) from the grass lip down to above the tip. */
// An upper cliff, a grassy ledge (rings 3 to 4 step inward), a lower cliff,
// then the long taper to the tip.
const RING_Y = [0, -0.05, -0.15, -0.26, -0.3, -0.44, -0.6, -0.76, -0.92];
const RING_R = [1, 0.99, 0.972, 0.948, 0.872, 0.815, 0.61, 0.37, 0.16];
const RING_NOISE = [0, 0.006, 0.026, 0.036, 0.036, 0.046, 0.05, 0.04, 0.028];
const RING_Y_JITTER = [0, 0.003, 0.012, 0.012, 0.01, 0.022, 0.028, 0.028, 0.022];

function buildRock(rng: () => number, rim: Float32Array): RockMesh {
  const segments = RIM_SEGMENTS;
  const rings = RING_Y.length;
  const vertexCount = rings * segments + 1;
  const positions = new Float32Array(vertexCount * 3);

  // One smooth offset per column, shared down the rings, so the cliffs read as
  // fluted buttresses rather than random static.
  const ridge = new Float32Array(segments);
  const q0 = rng() * TAU;
  const q1 = rng() * TAU;
  for (let j = 0; j < segments; j += 1) {
    ridge[j] = Math.sin(j * 0.9 + q0) * 0.5 + Math.sin(j * 2.3 + q1) * 0.3 + (rng() - 0.5) * 0.7;
  }

  for (let i = 0; i < rings; i += 1) {
    const noise = RING_NOISE[i] as number;
    const yJitter = RING_Y_JITTER[i] as number;
    for (let j = 0; j < segments; j += 1) {
      let a = (j / segments) * TAU;
      let r: number;
      let y = RING_Y[i] as number;
      if (i === 0) {
        r = rim[j] as number;
      } else {
        if (i >= 2) a += (rng() - 0.5) * (TAU / segments) * 0.35;
        r =
          rimRadiusAt(rim, a) * (RING_R[i] as number) +
          (ridge[j] as number) * noise * 0.9 +
          (rng() - 0.5) * 2 * noise * 0.6;
        y += (rng() - 0.5) * 2 * yJitter;
      }
      const o = (i * segments + j) * 3;
      positions[o] = r * Math.cos(a);
      positions[o + 1] = y;
      positions[o + 2] = r * Math.sin(a);
    }
  }
  const tip = rings * segments;
  positions[tip * 3] = 0.02;
  positions[tip * 3 + 1] = ROCK_TIP_Y;
  positions[tip * 3 + 2] = -0.012;

  const triCount = (rings - 1) * segments * 2 + segments;
  const triangles = new Uint16Array(triCount * 3);
  const normals = new Float32Array(triCount * 3);
  const bands = new Uint8Array(triCount);
  const moss = new Uint8Array(triCount);
  const jitter = new Int8Array(triCount);
  let t = 0;

  const vx = (v: number) => positions[v * 3] as number;
  const vy = (v: number) => positions[v * 3 + 1] as number;
  const vz = (v: number) => positions[v * 3 + 2] as number;

  const pushTri = (a: number, b: number, c: number, band: number) => {
    const e1x = vx(b) - vx(a);
    const e1y = vy(b) - vy(a);
    const e1z = vz(b) - vz(a);
    const e2x = vx(c) - vx(a);
    const e2y = vy(c) - vy(a);
    const e2z = vz(c) - vz(a);
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    // Outward means away from the vertical axis at the facet's centre.
    const cx = (vx(a) + vx(b) + vx(c)) / 3;
    const cz = (vz(a) + vz(b) + vz(c)) / 3;
    let second = b;
    let third = c;
    if (nx * cx + nz * cz < 0) {
      second = c;
      third = b;
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    triangles[t * 3] = a;
    triangles[t * 3 + 1] = second;
    triangles[t * 3 + 2] = third;
    normals[t * 3] = nx;
    normals[t * 3 + 1] = ny;
    normals[t * 3 + 2] = nz;
    bands[t] = band;
    // Grass on the ledges (facets facing up), and moss clinging to the upper cliff.
    const roll0 = rng();
    moss[t] = ny > 0.3 || (ny > -0.35 && ((band === 1 && roll0 < 0.3) || (band === 2 && roll0 < 0.06))) ? 1 : 0;
    const roll = rng();
    jitter[t] = roll < 0.3 ? -1 : roll > 0.7 ? 1 : 0;
    t += 1;
  };

  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j1 = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + j1;
      const c = (i + 1) * segments + j;
      const d = (i + 1) * segments + j1;
      // Alternate the diagonal at random so the facets don't line up.
      if (rng() < 0.5) {
        pushTri(a, c, d, i);
        pushTri(a, d, b, i);
      } else {
        pushTri(a, c, b, i);
        pushTri(b, c, d, i);
      }
    }
  }
  for (let j = 0; j < segments; j += 1) {
    pushTri((rings - 1) * segments + j, tip, (rings - 1) * segments + ((j + 1) % segments), rings - 1);
  }

  return { rings, segments, positions, triangles, normals, bands, moss, jitter };
}

/* ─────────────────────────── Drifting fragments ─────────────────────────── */

const FRAGMENT_SIDES = 5;

/** Left, right and back right: beside the island, never in front of it. */
const FRAGMENT_ANGLES = [Math.PI - 0.12, 0.2, -0.62];

function buildFragments(rng: () => number): Fragment[] {
  const fragments: Fragment[] = [];
  for (const home of FRAGMENT_ANGLES) {
    const angle = home + (rng() - 0.5) * 0.16;
    const n = FRAGMENT_SIDES;
    const positions = new Float32Array((2 + n * 2) * 3);
    positions.set([0, 0.12, 0], 0);
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + (rng() - 0.5) * 0.5;
      const top = 0.85 + rng() * 0.3;
      const mid = 0.62 + rng() * 0.25;
      positions.set([top * Math.cos(a), (rng() - 0.5) * 0.08, top * Math.sin(a)], (1 + i) * 3);
      positions.set([mid * Math.cos(a + 0.3), -0.5 - rng() * 0.2, mid * Math.sin(a + 0.3)], (1 + n + i) * 3);
    }
    const tip = 1 + n * 2;
    positions.set([(rng() - 0.5) * 0.3, -1.5 - rng() * 0.4, (rng() - 0.5) * 0.3], tip * 3);

    const tris: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      tris.push(0, 1 + i, 1 + j);
      tris.push(1 + i, 1 + n + i, 1 + n + j);
      tris.push(1 + i, 1 + n + j, 1 + j);
      tris.push(1 + n + i, tip, 1 + n + j);
    }
    const triangles = Uint8Array.from(tris);
    const normals = new Float32Array(triangles.length);
    for (let t = 0; t < triangles.length / 3; t += 1) {
      const a = triangles[t * 3] as number;
      const b = triangles[t * 3 + 1] as number;
      const c = triangles[t * 3 + 2] as number;
      const p = (v: number, k: number) => positions[v * 3 + k] as number;
      const e1 = [p(b, 0) - p(a, 0), p(b, 1) - p(a, 1), p(b, 2) - p(a, 2)] as const;
      const e2 = [p(c, 0) - p(a, 0), p(c, 1) - p(a, 1), p(c, 2) - p(a, 2)] as const;
      let nx = e1[1] * e2[2] - e1[2] * e2[1];
      let ny = e1[2] * e2[0] - e1[0] * e2[2];
      let nz = e1[0] * e2[1] - e1[1] * e2[0];
      // Outward is away from the fragment's heart, a little below its top.
      const gx = (p(a, 0) + p(b, 0) + p(c, 0)) / 3;
      const gy = (p(a, 1) + p(b, 1) + p(c, 1)) / 3 + 0.45;
      const gz = (p(a, 2) + p(b, 2) + p(c, 2)) / 3;
      if (nx * gx + ny * gy + nz * gz < 0) {
        triangles[t * 3 + 1] = c;
        triangles[t * 3 + 2] = b;
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.set([nx / len, ny / len, nz / len], t * 3);
    }
    fragments.push({
      angle,
      radius: 1.1 + rng() * 0.1,
      y: -0.34 - rng() * 0.26,
      size: 0.05 + rng() * 0.04,
      phase: rng(),
      positions,
      triangles,
      normals,
    });
  }
  return fragments;
}

/* ─────────────────────────────── Model ─────────────────────────────── */

export function createIslandModel(seed: number = ISLAND_SEED): IslandModel {
  const rng = createRng(seed);
  const rim = buildRim(rng);
  const avenueBase = rng() * (Math.PI / 2);
  const avenues = [0, 1, 2, 3].map((k) => avenueBase + (k * Math.PI) / 2);
  const tower = buildTower(avenueBase);
  const inner = buildInner(rng, avenues, tower);
  const waterfalls = buildWaterfalls(rng);
  const { streams, ponds } = buildStreams(rng, rim, waterfalls);
  const { paths, viewpoints } = buildPaths(rng, rim, waterfalls);
  const obstacles: Obstacles = { rim, streams, ponds, paths, viewpoints };
  const outer = buildOuter(rng, obstacles);
  const buildings = [...inner, ...outer].map((b, index) => ({ ...b, id: index + 1 }));
  const trees = buildTrees(rng, obstacles, avenues, [tower, ...buildings]);
  const lamps = buildLamps(avenues);
  const cars = buildCars(rng);
  const flowers = buildFlowers(rng, obstacles, [tower, ...buildings], trees);
  const rock = buildRock(rng, rim);
  const fragments = buildFragments(rng);
  return {
    seed,
    rim,
    avenues,
    tower,
    buildings,
    trees,
    lamps,
    cars,
    waterfalls,
    streams,
    ponds,
    paths,
    viewpoints,
    flowers,
    rock,
    fragments,
  };
}

let cached: IslandModel | null = null;

/** The one island every canvas on the page shares. */
export function getIslandModel(): IslandModel {
  cached ??= createIslandModel(ISLAND_SEED);
  return cached;
}
