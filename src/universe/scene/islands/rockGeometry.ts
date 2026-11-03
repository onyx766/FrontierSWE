import type { IslandId } from '@/data/universe';
import { createRng, rngBetween, rngInt } from '@/lib/rng';
import { clamp, distance, polar, type Vec3 } from '../../world/vec';
import {
  bakeStripLight,
  isClear,
  RIM_RADIUS,
  STRIP_Y,
  stripLights,
  type IslandPlan,
} from './islandPlan';
import { BLACK, TriangleSoup, type Rgb } from './soup';

/**
 * The rock under an island. A displaced cone reads as a smooth funnel whatever
 * the noise, so the mass is built the way the reference's rock looks: one great
 * wedge of large planes converging on a single point, with blades and blocks
 * driven through it. Where two pieces cross they cut a crisp crease, and those
 * creases, with the contrast between the planes, are most of the look from far
 * away. `addRockFace` then roughens each plane for when the camera is close.
 */

type Rng = () => number;

interface Spike {
  x: number;
  z: number;
  /** Height of the top ring. Hidden inside the platform unless `capped`. */
  top: number;
  /** Height of the point. */
  tip: number;
  radius: number;
  sides: number;
  rings: number;
  leanX: number;
  leanZ: number;
  /**
   * How long the column keeps its width. At 1 it tapers straight to its point;
   * at 2 or more it stays a block for most of its length, then breaks off.
   */
  blunt: number;
  /** Widening along `heading`, for blocks that hug the rim. */
  stretch: number;
  heading: number;
  capped: boolean;
  /** Albedo multiplier, so that neighbouring columns differ. */
  tone: number;
}

interface RockShape {
  /** Depth of the lowest point below the deck. */
  depth: number;
  /** Where that point hangs, from the island's centre. */
  tipX: number;
  tipZ: number;
  /** Horizontal direction the warm bounce arrives from, mostly the crystal's side. */
  warmX: number;
  warmZ: number;
}

/** Fitted to the reference at the opening shot, with its tips 23 to 26 units below the deck. */
const ROCK_SHAPES: Record<IslandId, RockShape> = {
  'ai-core': { depth: 23, tipX: -1.5, tipZ: 2, warmX: 0.3, warmZ: 0.95 },
  about: { depth: 24.5, tipX: 1.6, tipZ: 1, warmX: 0.25, warmZ: 0.97 },
  'experience-archive': { depth: 24.5, tipX: -2.4, tipZ: 1.6, warmX: -0.85, warmZ: 0.53 },
  'data-vault': { depth: 23.5, tipX: 0.4, tipZ: 1.4, warmX: 0.55, warmZ: 0.83 },
  'backend-engine': { depth: 25.5, tipX: -2.6, tipZ: 1.6, warmX: 0.88, warmZ: 0.47 },
  'project-lab': { depth: 24, tipX: -4.2, tipZ: 1.2, warmX: 0.72, warmZ: 0.69 },
};

const TAU = Math.PI * 2;

/** World units per tile of the rock texture. */
const ROCK_TILE = 8;

/** Height of a crown block's top, inside the platform's lower chamfer. */
const CROWN_TOP = -2.9;

/** Longest edge of a rock facet after it has been broken up: fine where it can be seen close up. */
const FACET_SIZE_NEAR = 1.9;
const FACET_SIZE_FAR = 3.4;

/** Height above which rock counts as near: the part a visitor sees from the rim and the roads. */
const FACET_NEAR_Y = -11;

/** How far a broken edge's midpoint strays, as a share of the edge's length. */
const FACET_ROUGHNESS = 0.05;

/** Broken plates around each island's rim, roads permitting. */
const SLAB_PLATES = 10;

/** Rock must stay below the deck's surface, even where a slab overruns the rim. */
const ROCK_CEILING = -0.05;

/** Rock within this reach, above the crown, is inside the platform itself. */
const PLATFORM_CORE = 17.2;

/** The main wedge's width under the rim, and how long it keeps it. See `Spike.blunt`. */
const WEDGE_RADIUS = 15.6;
const WEDGE_BLUNT = 1.5;

/** Rim bearings kept clean, because the front of the rim carries the bright strips. */
const FRONT_FROM = 128;
const FRONT_TO = 232;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pointHash(point: Vec3): number {
  const x = Math.round(point.x * 4096);
  const y = Math.round(point.y * 4096);
  const z = Math.round(point.z * 4096);
  return Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
}

/**
 * The displaced middle of an edge. It depends only on the edge's two ends, in
 * either order, so the two facets sharing an edge break it at the same point and
 * no crack can open between them.
 */
function brokenMidpoint(a: Vec3, b: Vec3, length: number): Vec3 {
  const rng = createRng(pointHash(a) + pointHash(b));
  const reach = length * FACET_ROUGHNESS;
  return {
    x: (a.x + b.x) / 2 + rngBetween(rng, -reach, reach),
    y: Math.min(ROCK_CEILING, (a.y + b.y) / 2 + rngBetween(rng, -reach, reach)),
    z: (a.z + b.z) / 2 + rngBetween(rng, -reach, reach),
  };
}

/** An edge's length over the size allowed where it is. Above 1, it must be broken. */
function edgeExcess(a: Vec3, b: Vec3, length: number): number {
  const near = Math.max(a.y, b.y) > FACET_NEAR_Y;
  return length / (near ? FACET_SIZE_NEAR : FACET_SIZE_FAR);
}

/**
 * Break a large face into small rough ones by splitting its worst edge until no
 * edge is too long. Large flat planes read as card at close range; this keeps
 * the rock's big shapes while its surface becomes fractal, as real rock is. The
 * test belongs to the edge, not the face, so neighbours always agree on a split.
 */
function addRockFace(
  soup: TriangleSoup,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  tone: Rgb,
  hidden: (point: Vec3) => boolean,
): void {
  if (hidden(a) && hidden(b) && hidden(c)) return;

  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);
  const excessAb = edgeExcess(a, b, ab);
  const excessBc = edgeExcess(b, c, bc);
  const excessCa = edgeExcess(c, a, ca);
  const worst = Math.max(excessAb, excessBc, excessCa);

  if (worst <= 1) {
    soup.facet(a, b, c, ROCK_TILE, tone);
  } else if (worst === excessAb) {
    const middle = brokenMidpoint(a, b, ab);
    addRockFace(soup, a, middle, c, tone, hidden);
    addRockFace(soup, middle, b, c, tone, hidden);
  } else if (worst === excessBc) {
    const middle = brokenMidpoint(b, c, bc);
    addRockFace(soup, a, b, middle, tone, hidden);
    addRockFace(soup, a, middle, c, tone, hidden);
  } else {
    const middle = brokenMidpoint(c, a, ca);
    addRockFace(soup, a, b, middle, tone, hidden);
    addRockFace(soup, middle, b, c, tone, hidden);
  }
}

/**
 * Is this point buried in the wedge? The wedge's outline never comes in further
 * than about this, and the columns driven through it are mostly inside it, so
 * this drops around a third of the rock's faces with no visible change.
 */
function buriedInWedge(point: Vec3, shape: RockShape): boolean {
  if (point.y > CROWN_TOP - 0.4) return Math.hypot(point.x, point.z) < PLATFORM_CORE;
  const height = clamp((CROWN_TOP - point.y) / (CROWN_TOP + shape.depth), 0, 1);
  const axisX = shape.tipX * (0.12 + 0.88 * height);
  const axisZ = shape.tipZ * (0.12 + 0.88 * height);
  const inner = WEDGE_RADIUS * (1 - Math.pow(height, WEDGE_BLUNT)) * 0.7;
  return Math.hypot(point.x - axisX, point.z - axisZ) < inner;
}

function addSpike(
  soup: TriangleSoup,
  rng: Rng,
  spike: Spike,
  hidden: (point: Vec3) => boolean,
): void {
  const start = rng() * TAU;
  const outline = Array.from({ length: spike.sides }, (_, side) => ({
    angle: start + ((side + rngBetween(rng, -0.28, 0.28)) / spike.sides) * TAU,
    scale: rngBetween(rng, 0.74, 1.2),
  }));

  const headingCos = Math.cos(spike.heading);
  const headingSin = Math.sin(spike.heading);
  const height = spike.top - spike.tip;
  const ledgeRing = spike.rings > 2 && rng() < 0.4 ? rngInt(rng, 1, spike.rings - 1) : -1;
  let ledge = 1;

  const ringAt = (ring: number): Vec3[] => {
    const t = ring === 0 ? 0 : (ring + rngBetween(rng, -0.24, 0.24)) / spike.rings;
    if (ring === ledgeRing) ledge = rngBetween(rng, 0.6, 0.84);

    const width = spike.radius * ledge * (1 - Math.pow(t, spike.blunt));
    const shake = ring === 0 ? 0 : spike.radius * 0.035;
    const centerX = spike.x + spike.leanX * t + rngBetween(rng, -shake, shake);
    const centerZ = spike.z + spike.leanZ * t + rngBetween(rng, -shake, shake);
    const y = spike.top - height * t;
    const slip = ring === 0 ? 0 : height / spike.rings / 12;

    return outline.map(({ angle, scale }) => {
      const spread = width * (scale + (ring === 0 ? 0 : rngBetween(rng, -0.05, 0.05)));
      const along = Math.cos(angle) * spread * spike.stretch;
      const across = Math.sin(angle) * spread;
      return {
        x: centerX + along * headingCos - across * headingSin,
        y: y + rngBetween(rng, -slip, slip),
        z: centerZ + along * headingSin + across * headingCos,
      };
    });
  };

  /* Stored in the vertex colour until `lightRock` replaces it. */
  const facetTone = (): Rgb => {
    const tone = spike.tone * rngBetween(rng, 0.82, 1.18);
    return [tone, tone, tone];
  };

  let upper = ringAt(0);

  if (spike.capped) {
    const peak: Vec3 = {
      x: spike.x + rngBetween(rng, -0.3, 0.3),
      y: Math.min(ROCK_CEILING, spike.top + rngBetween(rng, 0.01, 0.06)),
      z: spike.z + rngBetween(rng, -0.3, 0.3),
    };
    upper.forEach((point, side) => {
      const next = upper[(side + 1) % upper.length] as Vec3;
      addRockFace(soup, peak, next, point, facetTone(), hidden);
    });
  }

  for (let ring = 1; ring < spike.rings; ring += 1) {
    const lower = ringAt(ring);
    upper.forEach((point, side) => {
      const next = (side + 1) % upper.length;
      const tone = facetTone();
      const right = upper[next] as Vec3;
      const below = lower[next] as Vec3;
      const left = lower[side] as Vec3;
      if (rng() < 0.5) {
        addRockFace(soup, point, right, below, tone, hidden);
        addRockFace(soup, point, below, left, tone, hidden);
      } else {
        addRockFace(soup, point, right, left, tone, hidden);
        addRockFace(soup, right, below, left, tone, hidden);
      }
    });
    upper = lower;
  }

  const tip: Vec3 = {
    x: spike.x + spike.leanX + rngBetween(rng, -0.1, 0.1),
    y: spike.tip,
    z: spike.z + spike.leanZ + rngBetween(rng, -0.1, 0.1),
  };
  upper.forEach((point, side) => {
    addRockFace(soup, point, upper[(side + 1) % upper.length] as Vec3, tip, facetTone(), hidden);
  });
}

/** Lowest point the rock reaches at a given distance from the main tip. */
export function rockBottomAt(distance: number, depth: number): number {
  const across = clamp(distance / RIM_RADIUS, 0, 1);
  return -(6 + (depth - 6) * (1 - Math.pow(across, 1.15)));
}

function layOutSpikes(plan: IslandPlan, rng: Rng): Spike[] {
  const shape = ROCK_SHAPES[plan.island.id];
  const spikes: Spike[] = [];
  const fromTip = (x: number, z: number) => Math.hypot(x - shape.tipX, z - shape.tipZ);

  /* The wedge: large planes running from under the rim to the point. */
  spikes.push({
    x: shape.tipX * 0.12,
    z: shape.tipZ * 0.12,
    top: CROWN_TOP,
    tip: -shape.depth,
    radius: WEDGE_RADIUS,
    sides: 11,
    rings: 4,
    leanX: shape.tipX * 0.88,
    leanZ: shape.tipZ * 0.88,
    blunt: WEDGE_BLUNT,
    stretch: 1,
    heading: 0,
    capped: false,
    tone: 1,
  });

  /* Great blades driven through the wedge, each making its own ridge and lesser point. */
  const bladeCount = 7;
  for (let index = 0; index < bladeCount; index += 1) {
    const compass = (index / bladeCount) * 360 + rngBetween(rng, -16, 16);
    const orbit = rngBetween(rng, 6.5, 11.5);
    const { x, z } = polar(orbit, compass);

    spikes.push({
      x,
      z,
      top: CROWN_TOP - 0.1,
      tip: rockBottomAt(fromTip(x, z) * 0.9, shape.depth) * rngBetween(rng, 0.72, 0.98),
      radius: rngBetween(rng, 5.4, 8),
      sides: 6,
      rings: 3,
      leanX: (shape.tipX - x) * rngBetween(rng, 0.22, 0.48),
      leanZ: (shape.tipZ - z) * rngBetween(rng, 0.22, 0.48),
      blunt: rngBetween(rng, 1.3, 1.8),
      stretch: rngBetween(rng, 1, 1.25),
      heading: (compass * Math.PI) / 180,
      capped: false,
      tone: rngBetween(rng, 0.8, 1.2),
    });
  }

  /* The crown: heavy angular blocks under the rim, where the band's light lands. */
  const crownCount = 19;
  for (let index = 0; index < crownCount; index += 1) {
    const compass = (index / crownCount) * 360 + rngBetween(rng, -6, 6);
    const radius = rngBetween(rng, 2.6, 4.6);
    const { x, z } = polar(17.5 - radius * 0.9, compass);

    spikes.push({
      x,
      z,
      top: CROWN_TOP,
      tip: -rngBetween(rng, 7, 13.5),
      radius,
      sides: 6,
      rings: 3,
      leanX: -x * rngBetween(rng, 0.08, 0.22),
      leanZ: -z * rngBetween(rng, 0.08, 0.22),
      blunt: rngBetween(rng, 2, 3.4),
      stretch: rngBetween(rng, 1, 1.4),
      heading: (compass * Math.PI) / 180,
      capped: false,
      tone: rngBetween(rng, 0.8, 1.3),
    });
  }

  /* Chunks set into the wedge at every height, so that its planes break into ledges. */
  const chunkCount = 44;
  for (let index = 0; index < chunkCount; index += 1) {
    const height = rngBetween(rng, 0.08, 0.86);
    const compass = rng() * 360;
    const face = WEDGE_RADIUS * (1 - Math.pow(height, WEDGE_BLUNT));
    const { x, z } = polar(face * rngBetween(rng, 0.78, 1), compass);
    const radius = rngBetween(rng, 1.7, 3.6) * mix(1, 0.55, height);
    const top = mix(CROWN_TOP, -shape.depth, height);

    spikes.push({
      x: x + shape.tipX * height,
      z: z + shape.tipZ * height,
      top: top + radius,
      tip: top - radius * rngBetween(rng, 1.3, 3),
      radius,
      sides: rngInt(rng, 5, 6),
      rings: 2,
      leanX: -x * 0.1,
      leanZ: -z * 0.1,
      blunt: rngBetween(rng, 1.6, 3.2),
      stretch: rngBetween(rng, 1, 1.5),
      heading: (compass * Math.PI) / 180,
      capped: true,
      tone: rngBetween(rng, 0.8, 1.3),
    });
  }

  /* Teeth of rock that rise over the groove, so the band reads as broken by the rock. */
  const toothCount = 9;
  for (let index = 0; index < toothCount; index += 1) {
    const compass = rng() * 360;
    const orbit = RIM_RADIUS - rngBetween(rng, 0.05, 0.5);
    if (!isClear(plan, compass - 4, compass + 4, orbit + 1.6)) continue;

    const { x, z } = polar(orbit, compass);
    const top = -rngBetween(rng, 2.1, 2.6);

    spikes.push({
      x,
      z,
      top,
      tip: top - rngBetween(rng, 3.5, 8),
      radius: rngBetween(rng, 0.8, 1.3),
      sides: 4,
      rings: 2,
      leanX: -x * 0.08,
      leanZ: -z * 0.08,
      blunt: 1.6,
      stretch: rngBetween(rng, 1.2, 2),
      heading: (compass * Math.PI) / 180,
      capped: true,
      tone: rngBetween(rng, 0.9, 1.3),
    });
  }

  /* Thin broken shards hanging off the crown. */
  const shardCount = 5;
  for (let index = 0; index < shardCount; index += 1) {
    const compass = rng() * 360;
    const { x, z } = polar(rngBetween(rng, 13.5, 16.8), compass);
    const top = -rngBetween(rng, 6, 9);

    spikes.push({
      x,
      z,
      top,
      tip: top - rngBetween(rng, 2.5, 5.5),
      radius: rngBetween(rng, 0.95, 1.5),
      sides: 5,
      rings: 2,
      leanX: rngBetween(rng, -0.6, 0.6),
      leanZ: rngBetween(rng, -0.6, 0.6),
      blunt: 1.1,
      stretch: 1,
      heading: 0,
      capped: false,
      tone: rngBetween(rng, 0.9, 1.25),
    });
  }

  /*
   * The slab's broken edge: flat plates nearly flush with the deck, overrunning the
   * machined rim so that its circle is interrupted, as the reference's are.
   */
  const plateTries = 44;
  let plates = 0;
  for (let index = 0; index < plateTries && plates < SLAB_PLATES; index += 1) {
    const compass = rng() * 360;
    if (compass > FRONT_FROM && compass < FRONT_TO) continue;

    const radius = rngBetween(rng, 1.5, 2.6);
    const stretch = rngBetween(rng, 1.4, 2.5);
    const orbit = RIM_RADIUS + rngBetween(rng, 0.1, 0.9);
    const span = ((radius * stretch) / orbit) * 62;
    if (!isClear(plan, compass - span, compass + span, orbit + radius * 1.25 + 0.3)) continue;

    const { x, z } = polar(orbit, compass);
    const top = -rngBetween(rng, 0.07, 0.24);

    spikes.push({
      x,
      z,
      top,
      tip: top - rngBetween(rng, 5, 9.5),
      radius,
      sides: 7,
      rings: 3,
      leanX: -x * 0.09,
      leanZ: -z * 0.09,
      blunt: 2.2,
      stretch,
      heading: (compass * Math.PI) / 180,
      capped: true,
      tone: rngBetween(rng, 1, 1.35),
    });
    plates += 1;
  }

  return spikes;
}

/** Albedo: warm rust near the rim, sinking to blue-black at the tip. */
const ROCK_WARM: Rgb = [0.075, 0.062, 0.06];
const ROCK_DEEP: Rgb = [0.04, 0.042, 0.054];

/** The flat tops of the broken slab match the deck, not the rock below it. */
const SLAB_TOP: Rgb = [0.1, 0.105, 0.13];

/** Sky light on those tops, which have no glow of their own to lean on. */
const SLAB_FILL: Rgb = [0.07, 0.08, 0.115];

/** How far the strips' baked light reaches down the rock. */
const GLOW_RANGE = 11;

/**
 * A warm fill baked per facet, as if the rim and the crystal were bouncing light
 * back into the rock. It is what gives the reference its bright orange planes
 * right beside near-black ones, which the scene's sky-side lights cannot reach.
 */
const BOUNCE_COLOR: Rgb = [0.62, 0.24, 0.08];

/** How far below the horizon the bounce comes from, as a share of its direction. */
const BOUNCE_DROP = 0.28;

/** Warm light gathers in broad patches that span many facets. */
function warmPatch(point: Vec3): number {
  const wave =
    Math.sin(point.x * 0.27 + point.y * 0.16 + 1.3) * Math.sin(point.z * 0.33 - point.y * 0.21 + 0.4) +
    0.35 * Math.sin(point.y * 0.8 + point.x * 0.45);
  return smoothstep(0.02, 0.6, wave);
}

/**
 * Earthshine. The undersides face a lit planet, and with nothing else reaching
 * them ACES would crush the whole mass to black against the night side.
 */
const EARTHSHINE: Rgb = [0.02, 0.034, 0.07];

/**
 * Bake one facet at a time. Facets are small and flat-shaded, so a vertex-by-vertex
 * bake would look the same and take three times as long, on a page that is loading.
 */
function lightRock(soup: TriangleSoup, plan: IslandPlan): void {
  const { depth, warmX, warmZ } = ROCK_SHAPES[plan.island.id];
  const lights = stripLights(plan);
  const { positions, normals, colors, glows } = soup;
  const glowFloor = STRIP_Y - GLOW_RANGE;

  for (let facet = 0; facet < soup.vertexCount; facet += 3) {
    const first = facet * 3;
    const tone = colors[first] as number;
    const normal: Vec3 = {
      x: normals[first] as number,
      y: normals[first + 1] as number,
      z: normals[first + 2] as number,
    };
    const center: Vec3 = {
      x: ((positions[first] as number) + (positions[first + 3] as number) + (positions[first + 6] as number)) / 3,
      y: ((positions[first + 1] as number) + (positions[first + 4] as number) + (positions[first + 7] as number)) / 3,
      z: ((positions[first + 2] as number) + (positions[first + 5] as number) + (positions[first + 8] as number)) / 3,
    };

    const sink = smoothstep(0.08, 0.74, -center.y / depth);
    const slab = smoothstep(0.82, 0.96, normal.y) * smoothstep(-2, -0.4, center.y);
    const light = center.y > glowFloor ? bakeStripLight(lights, center, normal, GLOW_RANGE) : BLACK;
    const facing = Math.max(0, normal.x * warmX - normal.y * BOUNCE_DROP + normal.z * warmZ);
    const bounce = facing * facing * warmPatch(center) * mix(1, 0.35, sink);
    const shine = Math.max(0, (0.35 - normal.y * 0.65) * tone);

    for (let channel = 0; channel < 3; channel += 1) {
      const rock = mix(ROCK_WARM[channel] as number, ROCK_DEEP[channel] as number, sink);
      const albedo = mix(rock * tone, SLAB_TOP[channel] as number, slab);
      const glow =
        (light[channel] as number) +
        (BOUNCE_COLOR[channel] as number) * bounce +
        (EARTHSHINE[channel] as number) * shine +
        (SLAB_FILL[channel] as number) * slab;

      for (let corner = 0; corner < 3; corner += 1) {
        colors[first + corner * 3 + channel] = albedo;
        glows[first + corner * 3 + channel] = glow;
      }
    }
  }
}

/** One loose rock, about two units across, to be scaled and scattered. */
export function buildShardRock(): TriangleSoup {
  const soup = new TriangleSoup();
  const rng = createRng(0x5a4d);

  const spike: Spike = {
    x: 0,
    z: 0,
    top: 0.75,
    tip: -1.5,
    radius: 1,
    sides: 7,
    rings: 3,
    leanX: 0.2,
    leanZ: -0.15,
    blunt: 1.6,
    stretch: 1.1,
    heading: 0.6,
    capped: true,
    tone: 1,
  };
  addSpike(soup, rng, spike, () => false);

  const { normals, colors, glows } = soup;
  for (let vertex = 0; vertex < soup.vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const tone = colors[offset] as number;
    const shine = Math.max(0, 0.35 - (normals[offset + 1] as number) * 0.65);

    for (let channel = 0; channel < 3; channel += 1) {
      colors[offset + channel] = (ROCK_DEEP[channel] as number) * tone;
      glows[offset + channel] = (EARTHSHINE[channel] as number) * shine * 0.5;
    }
  }

  return soup;
}

export interface ShardPlacement {
  position: Vec3;
  /** Squash per axis, so that one mesh gives both chunks and slivers. */
  scale: Vec3;
  axis: Vec3;
  angle: number;
  /** Radians per second of tumble and of bobbing. */
  tumble: number;
  bob: number;
  phase: number;
}

const SHARDS_PER_ISLAND = 12;

/** The space inside the Ring stays clear: the reference keeps it empty around the crystal. */
const SHARD_MIN_ORBIT = 60;

/** Rocks broken off an island, drifting clear of its mass and of every road. */
export function layOutShards(plan: IslandPlan): ShardPlacement[] {
  const rng = createRng(plan.seed ^ 0x5eed);
  const depth = ROCK_SHAPES[plan.island.id].depth;
  const shards: ShardPlacement[] = [];

  while (shards.length < SHARDS_PER_ISLAND) {
    const compass = rng() * 360;
    const radius = rngBetween(rng, 8, 27);
    const y = -rngBetween(rng, 6, 31);
    const under = radius < 20;
    if (under && y > rockBottomAt(radius, depth) - 2.5) continue;

    const { x, z } = polar(radius, compass);
    if (Math.hypot(plan.center.x + x, plan.center.z + z) < SHARD_MIN_ORBIT) continue;

    const size = Math.pow(rng(), 2) * 1.5 + 0.3;
    const axis: Vec3 = {
      x: rngBetween(rng, -1, 1),
      y: rngBetween(rng, -1, 1),
      z: rngBetween(rng, -1, 1),
    };
    const length = Math.hypot(axis.x, axis.y, axis.z) || 1;

    shards.push({
      position: { x: plan.center.x + x, y: plan.center.y + y, z: plan.center.z + z },
      scale: {
        x: size * rngBetween(rng, 0.55, 1.2),
        y: size * rngBetween(rng, 0.6, 1.5),
        z: size * rngBetween(rng, 0.55, 1.2),
      },
      axis: { x: axis.x / length, y: axis.y / length, z: axis.z / length },
      angle: rng() * Math.PI * 2,
      tumble: rngBetween(rng, 0.03, 0.14),
      bob: rngBetween(rng, 0.12, 0.3),
      phase: rng() * Math.PI * 2,
    });
  }

  return shards;
}

/** All the rock for one island, in coordinates local to its centre. */
export function buildIslandRock(plan: IslandPlan): TriangleSoup {
  const soup = new TriangleSoup();
  const rng = createRng(plan.seed);

  const shape = ROCK_SHAPES[plan.island.id];
  const hidden = (point: Vec3) => buriedInWedge(point, shape);

  for (const spike of layOutSpikes(plan, rng)) addSpike(soup, rng, spike, hidden);
  lightRock(soup, plan);

  return soup;
}
