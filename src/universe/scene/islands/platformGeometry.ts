import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';
import { DEG, polar, type Vec3 } from '../../world/vec';
import { ACCENT, COLORS } from '../palette';
import {
  bakeStripLight,
  RIM_RADIUS,
  STRIP_Y,
  stripEnvelope,
  stripLights,
  type IslandPlan,
  type RimStrip,
  type StripLight,
} from './islandPlan';
import { normalOf, TriangleSoup, type Rgb } from './soup';

/**
 * The machined platform: a flat deck, a stepped chamfered rim with its glowing
 * band, and the clamps that hold the rim to the rock. Built as surfaces of
 * revolution, one crisp band at a time rather than with a lathe, because a
 * lathe would average the normals across each chamfer and soften every edge.
 */

export interface PlatformSoups {
  /** The walkable top. */
  deck: TriangleSoup;
  /** Everything else in metal. */
  hull: TriangleSoup;
  /** Unlit HDR detail: inlays and small lights. */
  light: TriangleSoup;
  /** Additive: the rim strips and the haze under them. */
  haze: TriangleSoup;
}

/** Radius of the flat deck. The walkable radius sits inside this. */
export const DECK_RADIUS = 17.2;

/** World radius mapped to the edge of the deck texture. */
export const DECK_UV_RADIUS = 17.4;

/** Rows of the hull trim sheet, as `[bottom, top]` in v. Painted in `surfaceTextures.ts`. */
export const TRIM_ROWS = {
  panels: [0.5, 1],
  bolts: [0.25, 0.5],
  vents: [0.125, 0.25],
  plain: [0, 0.125],
} as const;

type TrimRow = keyof typeof TRIM_ROWS;

/** How many times the trim sheet repeats around a rim. */
const TRIM_TILES = 16;

/** World length of one tile of the trim sheet at the rim. */
const TRIM_TILE_LENGTH = (Math.PI * 2 * RIM_RADIUS) / TRIM_TILES;

const RIM_SEGMENTS = 144;
const DECK_SEGMENTS = 96;

const WHITE: Rgb = [1, 1, 1];
const UP: Vec3 = { x: 0, y: 1, z: 0 };
const UNDERSIDE: Rgb = [0.3, 0.3, 0.32];

/** How far the strips' baked light travels along the metal. */
const HULL_GLOW_RANGE = 7;

/** Light bounced up off the rock and the planet, without which the rim wall goes black. */
const HULL_FILL: Rgb = [0.17, 0.16, 0.2];

function hullGlow(lights: StripLight[], point: Vec3, normal: Vec3): Rgb {
  const light = bakeStripLight(lights, point, normal, HULL_GLOW_RANGE);
  const fill = Math.max(0, 0.75 - normal.y);
  return [
    light[0] + HULL_FILL[0] * fill,
    light[1] + HULL_FILL[1] * fill,
    light[2] + HULL_FILL[2] * fill,
  ];
}

/** Radius of the groove the glowing band runs in, set back from the rim wall. */
const GROOVE_RADIUS = RIM_RADIUS - 0.3;

interface RimBand {
  from: [radius: number, y: number];
  to: [radius: number, y: number];
  row: TrimRow;
  tint?: Rgb;
}

/** The rim's section, walked from the deck's edge outwards and down. */
const RIM_BANDS: RimBand[] = [
  { from: [DECK_RADIUS, 0], to: [RIM_RADIUS - 0.58, -0.1], row: 'plain' },
  { from: [RIM_RADIUS - 0.58, -0.1], to: [RIM_RADIUS - 0.26, -0.1], row: 'bolts' },
  { from: [RIM_RADIUS - 0.26, -0.1], to: [RIM_RADIUS, -0.34], row: 'plain' },
  { from: [RIM_RADIUS, -0.34], to: [RIM_RADIUS, -1.42], row: 'panels' },
  { from: [RIM_RADIUS, -1.42], to: [GROOVE_RADIUS, -1.58], row: 'plain' },
  { from: [GROOVE_RADIUS, -1.58], to: [GROOVE_RADIUS, -2.5], row: 'plain', tint: UNDERSIDE },
  { from: [GROOVE_RADIUS, -2.5], to: [RIM_RADIUS + 0.02, -2.66], row: 'plain' },
  { from: [RIM_RADIUS + 0.02, -2.66], to: [RIM_RADIUS + 0.02, -2.92], row: 'vents' },
  { from: [RIM_RADIUS + 0.02, -2.92], to: [RIM_RADIUS - 0.6, -3.4], row: 'plain' },
  { from: [RIM_RADIUS - 0.6, -3.4], to: [8, -3.4], row: 'plain', tint: UNDERSIDE },
];

/** Half-height of the band in the groove: its surrounding wash and its bright core. */
const STRIP_WASH = 0.42;
const STRIP_CORE = 0.19;
const STRIP_RADIUS = GROOVE_RADIUS + 0.06;

/** The band wanders within its groove, so it reads as energy rather than a tube light. */
function stripWander(compass: number): number {
  const angle = compass * DEG;
  return 0.14 * Math.sin(angle * 5 + 1.2) + 0.06 * Math.sin(angle * 11 + 0.4);
}

function addBand(soup: TriangleSoup, lights: StripLight[], band: RimBand): void {
  const [innerRadius, innerY] = band.from;
  const [outerRadius, outerY] = band.to;
  const size = Math.hypot(outerRadius - innerRadius, outerY - innerY);
  const normalRadial = (innerY - outerY) / size;
  const normalUp = (outerRadius - innerRadius) / size;
  const [bottom, top] = TRIM_ROWS[band.row];
  const tint = band.tint ?? WHITE;

  type RimVertex = { position: Vec3; normal: Vec3; u: number; v: number; glow: Rgb };
  const corners: [RimVertex, RimVertex][] = [];

  for (let segment = 0; segment <= RIM_SEGMENTS; segment += 1) {
    const compass = (segment / RIM_SEGMENTS) * 360;
    const out = polar(1, compass);
    const normal: Vec3 = { x: out.x * normalRadial, y: normalUp, z: out.z * normalRadial };
    const u = (segment / RIM_SEGMENTS) * TRIM_TILES;
    const inner = polar(innerRadius, compass, innerY);
    const outer = polar(outerRadius, compass, outerY);
    corners.push([
      {
        position: inner,
        normal,
        u,
        v: top,
        glow: hullGlow(lights, inner, normal),
      },
      {
        position: outer,
        normal,
        u,
        v: bottom,
        glow: hullGlow(lights, outer, normal),
      },
    ]);
  }

  for (let segment = 0; segment < RIM_SEGMENTS; segment += 1) {
    const [a, d] = corners[segment] as [RimVertex, RimVertex];
    const [b, c] = corners[segment + 1] as [RimVertex, RimVertex];
    for (const corner of [a, b, c, a, c, d]) {
      soup.vertex(corner.position, corner.normal, corner.u, corner.v, tint, corner.glow);
    }
  }
}

/** Rings of the deck's mesh, close enough together to carry its baked light. */
const DECK_RINGS = [0, 3, 6, 8.2, 9.4, 11, 13, 15, 16.4, DECK_RADIUS];

/** Pool of the island's accent colour around the prop court, as if the props lit the deck. */
const POOL_RADIUS = 8.9;
const POOL_WIDTH = 4.6;
const POOL_LEVEL = 0.15;

/** Tilted out and up, to pick up the rim's light on the outer plates. */
const DECK_EDGE_RANGE = 8;
const DECK_EDGE_SHARE = 0.32;

function addDeck(soup: TriangleSoup, plan: IslandPlan, lights: StripLight[], turn: number): void {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const scale = 0.5 / DECK_UV_RADIUS;
  const accent = new THREE.Color(ACCENT[plan.island.accent]);

  const corner = (radius: number, compass: number) => {
    const position = polar(radius, compass);
    const out = polar(0.72, compass);
    const pool = POOL_LEVEL * Math.exp(-(((radius - POOL_RADIUS) / POOL_WIDTH) ** 2));
    const edge = bakeStripLight(lights, position, { x: out.x, y: 0.7, z: out.z }, DECK_EDGE_RANGE);
    soup.vertex(
      position,
      UP,
      0.5 + (position.x * cos - position.z * sin) * scale,
      0.5 + (position.x * sin + position.z * cos) * scale,
      WHITE,
      [
        accent.r * pool + edge[0] * DECK_EDGE_SHARE,
        accent.g * pool + edge[1] * DECK_EDGE_SHARE,
        accent.b * pool + edge[2] * DECK_EDGE_SHARE,
      ],
    );
  };

  for (let ring = 0; ring + 1 < DECK_RINGS.length; ring += 1) {
    const inner = DECK_RINGS[ring] as number;
    const outer = DECK_RINGS[ring + 1] as number;

    for (let segment = 0; segment < DECK_SEGMENTS; segment += 1) {
      const from = (segment / DECK_SEGMENTS) * 360;
      const to = ((segment + 1) / DECK_SEGMENTS) * 360;
      corner(inner, from);
      corner(inner, to);
      corner(outer, to);
      corner(inner, from);
      corner(outer, to);
      corner(outer, from);
    }
  }
}

/** Convex polygon faces of a box with chamfered edges, centred on the origin. */
function chamferedBoxFaces(hx: number, hy: number, hz: number, bevel: number): Vec3[][] {
  const onX = (x: number, y: number, z: number): Vec3 => ({
    x: x * hx,
    y: y * (hy - bevel),
    z: z * (hz - bevel),
  });
  const onY = (x: number, y: number, z: number): Vec3 => ({
    x: x * (hx - bevel),
    y: y * hy,
    z: z * (hz - bevel),
  });
  const onZ = (x: number, y: number, z: number): Vec3 => ({
    x: x * (hx - bevel),
    y: y * (hy - bevel),
    z: z * hz,
  });

  const faces: Vec3[][] = [];

  for (const s of [-1, 1]) {
    faces.push([onX(s, 1, 1), onX(s, 1, -1), onX(s, -1, -1), onX(s, -1, 1)]);
    faces.push([onY(1, s, 1), onY(1, s, -1), onY(-1, s, -1), onY(-1, s, 1)]);
    faces.push([onZ(1, 1, s), onZ(1, -1, s), onZ(-1, -1, s), onZ(-1, 1, s)]);

    for (const t of [-1, 1]) {
      faces.push([onY(1, s, t), onY(-1, s, t), onZ(-1, s, t), onZ(1, s, t)]);
      faces.push([onX(s, 1, t), onX(s, -1, t), onZ(s, -1, t), onZ(s, 1, t)]);
      faces.push([onX(s, t, 1), onX(s, t, -1), onY(s, t, -1), onY(s, t, 1)]);

      for (const r of [-1, 1]) faces.push([onX(s, t, r), onY(s, t, r), onZ(s, t, r)]);
    }
  }

  return faces;
}

/** A clamp's corner, on the box and on the rim. */
interface Corner {
  local: Vec3;
  world: Vec3;
}

interface ClampSpec {
  compass: number;
  /** Half-size along the rim, up, and out. */
  width: number;
  height: number;
  depth: number;
  y: number;
  radius: number;
}

/** A machined block seated on the rim. Its faces take one panel of the trim sheet. */
function addClamp(soup: TriangleSoup, lights: StripLight[], clamp: ClampSpec): void {
  const origin = polar(clamp.radius, clamp.compass, clamp.y);
  const out = polar(1, clamp.compass);
  const tangent: Vec3 = { x: -out.z, y: 0, z: out.x };
  const [bottom, top] = TRIM_ROWS.panels;
  const lateralHalf = Math.max(clamp.height, clamp.depth);

  const place = (local: Vec3): Vec3 => ({
    x: origin.x + tangent.x * local.x + out.x * local.z,
    y: origin.y + local.y,
    z: origin.z + tangent.z * local.x + out.z * local.z,
  });

  for (const face of chamferedBoxFaces(clamp.width, clamp.height, clamp.depth, 0.11)) {
    const corners = face.map((local) => ({ local, world: place(local) }));
    const [first, second, third] = corners as [Corner, Corner, Corner];
    let normal = normalOf(first.world, second.world, third.world);

    /* The box's frame is mirrored once it is on the rim, so orient faces by outcome. */
    const outward =
      normal.x * (first.world.x - origin.x) +
      normal.y * (first.world.y - origin.y) +
      normal.z * (first.world.z - origin.z);
    if (outward < 0) {
      corners.reverse();
      normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    }

    const emit = ({ local, world }: Corner) => {
      const lateral = Math.abs(normal.y) > 0.7 ? local.z : local.y;
      soup.vertex(
        world,
        normal,
        (clamp.compass + local.x) / TRIM_TILE_LENGTH,
        bottom + ((lateral + lateralHalf) / (2 * lateralHalf)) * (top - bottom),
        WHITE,
        hullGlow(lights, world, normal),
      );
    };

    for (let index = 1; index + 1 < corners.length; index += 1) {
      emit(corners[0] as Corner);
      emit(corners[index] as Corner);
      emit(corners[index + 1] as Corner);
    }
  }
}

function addClamps(soup: TriangleSoup, plan: IslandPlan, lights: StripLight[]): void {
  const rng = createRng(plan.seed ^ 0xc1a3);

  /* A heavy bracket at the front of the rim, as on the reference's Vault and Archive. */
  addClamp(soup, lights, {
    compass: 180 + rngBetween(rng, -1, 1),
    width: 0.8,
    height: 1.2,
    depth: 0.24,
    y: -1.7,
    radius: 18.04,
  });

  /* Smaller ones around the back and flanks. A row of them would read as a film strip. */
  plan.strips.forEach((strip, index) => {
    const next = plan.strips[index + 1];
    if (next === undefined || next.from - strip.to > 14 || strip.to < 250) return;
    if (rng() < 0.6) return;

    addClamp(soup, lights, {
      compass: (strip.to + next.from) / 2,
      width: rngBetween(rng, 0.4, 0.7),
      height: rngBetween(rng, 1.1, 1.4),
      depth: 0.28,
      y: -1.8,
      radius: 18.02,
    });
  });
}

function arc(
  soup: TriangleSoup,
  inner: number,
  outer: number,
  y: number,
  from: number,
  to: number,
  color: Rgb,
): void {
  const steps = Math.max(2, Math.ceil((to - from) / 2));
  for (let step = 0; step < steps; step += 1) {
    const start = from + ((to - from) * step) / steps;
    const end = from + ((to - from) * (step + 1)) / steps;
    const a = polar(inner, start, y);
    const b = polar(inner, end, y);
    const c = polar(outer, end, y);
    const d = polar(outer, start, y);
    for (const point of [a, b, c, a, c, d]) soup.vertex(point, UP, 0, 0, color);
  }
}

function hdrRgb(color: string, intensity: number, whiten = 0): Rgb {
  const value = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), whiten);
  return [value.r * intensity, value.g * intensity, value.b * intensity];
}

/** Rows across a ribbon, as a share of its half-height, and their brightness. */
const RIBBON_ROWS: [offset: number, level: number][] = [
  [-1, 0],
  [-0.42, 0.5],
  [0, 1],
  [0.42, 0.5],
  [1, 0],
];

/**
 * A soft-edged ribbon following the rim, fading to nothing across its height and
 * along its length. Additive, so that those fades need no alpha and it reads as
 * energy in the groove rather than a flat shape stuck on the wall.
 */
function addRibbon(
  soup: TriangleSoup,
  strip: RimStrip,
  radius: number,
  half: number,
  color: Rgb,
): void {
  const steps = Math.max(6, Math.ceil((strip.to - strip.from) / 2.2));

  const corner = (t: number, row: number): { position: Vec3; color: Rgb } => {
    const [offset, level] = RIBBON_ROWS[row] as (typeof RIBBON_ROWS)[number];
    const compass = strip.from + (strip.to - strip.from) * t;
    const envelope = stripEnvelope(t);
    const brightness = level * envelope * strip.power;
    return {
      position: polar(radius, compass, STRIP_Y + stripWander(compass) + offset * half * envelope),
      color: [color[0] * brightness, color[1] * brightness, color[2] * brightness],
    };
  };

  for (let step = 0; step < steps; step += 1) {
    const t0 = step / steps;
    const t1 = (step + 1) / steps;

    for (let row = 0; row + 1 < RIBBON_ROWS.length; row += 1) {
      const a = corner(t0, row + 1);
      const b = corner(t1, row + 1);
      const c = corner(t1, row);
      const d = corner(t0, row);
      for (const { position, color: shade } of [a, b, c, a, c, d]) {
        soup.vertex(position, UP, 0, 0, shade);
      }
    }
  }
}

function addStrip(soup: TriangleSoup, strip: RimStrip): void {
  addRibbon(soup, strip, STRIP_RADIUS, STRIP_WASH * strip.weight, hdrRgb(strip.color, 3.8));
  addRibbon(soup, strip, STRIP_RADIUS + 0.01, STRIP_CORE * strip.weight, hdrRgb(strip.color, 12, 0.1));
}

/** Rows of the haze under a strip: height below it, radius, and strength. */
const HAZE_ROWS: [drop: number, radius: number, level: number][] = [
  [-0.8, 18.16, 0],
  [-0.1, 18.16, 1],
  [0.7, 18.1, 0.5],
  [1.9, 17.9, 0.18],
  [3.6, 17.5, 0],
];

function addHaze(soup: TriangleSoup, strip: RimStrip): void {
  const steps = Math.max(4, Math.ceil((strip.to - strip.from) / 5));
  const base = hdrRgb(strip.color, 0.52);

  const shade = (t: number, level: number): Rgb => {
    const power = stripEnvelope(t) * strip.power * level;
    return [base[0] * power, base[1] * power, base[2] * power];
  };

  for (let step = 0; step < steps; step += 1) {
    const t0 = step / steps;
    const t1 = (step + 1) / steps;
    const start = strip.from + (strip.to - strip.from) * t0;
    const end = strip.from + (strip.to - strip.from) * t1;

    for (let row = 0; row + 1 < HAZE_ROWS.length; row += 1) {
      const [dropA, radiusA, levelA] = HAZE_ROWS[row] as (typeof HAZE_ROWS)[number];
      const [dropB, radiusB, levelB] = HAZE_ROWS[row + 1] as (typeof HAZE_ROWS)[number];
      const a = polar(radiusA, start, STRIP_Y - dropA);
      const b = polar(radiusA, end, STRIP_Y - dropA);
      const c = polar(radiusB, end, STRIP_Y - dropB);
      const d = polar(radiusB, start, STRIP_Y - dropB);
      soup.vertex(a, UP, 0, 0, shade(t0, levelA));
      soup.vertex(b, UP, 0, 0, shade(t1, levelA));
      soup.vertex(c, UP, 0, 0, shade(t1, levelB));
      soup.vertex(a, UP, 0, 0, shade(t0, levelA));
      soup.vertex(c, UP, 0, 0, shade(t1, levelB));
      soup.vertex(d, UP, 0, 0, shade(t0, levelB));
    }
  }
}

/** Inlay arcs near the rim: centre bearing and width. */
const FLANK_ARCS: [center: number, width: number][] = [
  [265, 0.12],
  [95, 0.12],
  [0, 0.06],
  [315, 0.06],
  [45, 0.06],
];

/** Fine inlays on the deck and small lights in the rim. */
function addDetailLights(soup: TriangleSoup, plan: IslandPlan): void {
  const rng = createRng(plan.seed ^ 0x7a11);
  const accent = ACCENT[plan.island.accent];
  const inlay = hdrRgb(accent, 2.2);
  const amber = hdrRgb(COLORS.amber, 1.9);

  /* A broken ring around the prop court. */
  const start = rng() * 60;
  for (let index = 0; index < 6; index += 1) {
    const from = start + index * 60;
    arc(soup, 8.92, 9, 0.014, from, from + 46, inlay);
  }

  /* Thin amber arcs inside the rim, heaviest on the flanks the opening shot sees edge-on. */
  for (const [center, width] of FLANK_ARCS) {
    const reach = rngBetween(rng, 10, 18);
    const from = center + rngBetween(rng, -8, 8) - reach;
    arc(soup, 17.04 - width, 17.04, 0.014, from, from + reach * 2, amber);
  }

  /* A few status lights, in short runs along the lip. */
  for (let run = 0; run < 7; run += 1) {
    const from = rng() * 360;
    const color = rng() < 0.5 ? hdrRgb(accent, 3.2) : hdrRgb(COLORS.amber, 2.6);
    for (let light = 0; light < 4; light += 1) {
      const compass = from + light * 1.1;
      arc(soup, 17.54, 17.62, -0.092, compass, compass + 0.5, color);
    }
  }
}

export function buildIslandPlatform(plan: IslandPlan): PlatformSoups {
  const soups: PlatformSoups = {
    deck: new TriangleSoup(),
    hull: new TriangleSoup(),
    light: new TriangleSoup(),
    haze: new TriangleSoup(),
  };

  const lights = stripLights(plan);
  const turn = ((plan.seed % 360) * Math.PI) / 180;

  addDeck(soups.deck, plan, lights, turn);
  for (const band of RIM_BANDS) addBand(soups.hull, lights, band);
  addClamps(soups.hull, plan, lights);

  for (const strip of plan.strips) {
    addStrip(soups.haze, strip);
    addHaze(soups.haze, strip);
  }
  addDetailLights(soups.light, plan);

  return soups;
}

