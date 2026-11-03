import * as THREE from 'three';
import { islands, type IslandContent } from '@/data/universe';
import { createRng, hashSeed, rngBetween } from '@/lib/rng';
import { islandCenter, WORLD, type RoadNetwork } from '../../world/network';
import { world } from '../../world/world';
import { DEG, polar, type Vec3 } from '../../world/vec';
import { ACCENT, COLORS } from '../palette';
import type { Rgb } from './soup';

/**
 * What every island is made of, worked out once from the road network, so the
 * rock can never drift into a road when the network changes.
 *
 * Angles here are compass bearings around the island's own centre: 0 north,
 * 90 east, 180 south, towards the opening camera. Island geometry is authored
 * this way, not in the island's outward frame, because the composition is tied
 * to the viewer: the bright front of every rim faces the same way on screen.
 */

/** One glowing segment of the band around an island's rim. */
export interface RimStrip {
  /** Compass degrees, `from` below `to`. `to` may run past 360. */
  from: number;
  to: number;
  color: string;
  /** Relative brightness, about 0.5 to 1.3. */
  power: number;
  /** Relative thickness. The band swells where it is hottest. */
  weight: number;
}

export interface IslandPlan {
  island: IslandContent;
  center: Vec3;
  seed: number;
  /** For each whole compass degree, how far out rock can reach before a road. */
  reach: Float32Array;
  strips: RimStrip[];
}

/** A point source sampled along a rim strip, for baking its light onto rock. */
export interface StripLight {
  position: Vec3;
  color: Rgb;
}

export const RIM_RADIUS = WORLD.islandRadius;

/** Height of the band's centre, in the groove between the rim wall and the rock. */
export const STRIP_Y = -2.05;

/** The reference's strips, read off the Data Vault, Backend and Archive rims. */
const FRONT_STRIPS: [from: number, to: number, power: number, weight: number][] = [
  [116, 134, 1.3, 1.5],
  [147, 166, 1.1, 1.15],
  [171, 177, 0.6, 0.55],
  [183, 203, 0.7, 0.6],
  [211, 215, 0.45, 0.45],
  [224, 248, 1.35, 1.6],
];

export function compassOf(dx: number, dz: number): number {
  return ((Math.atan2(dx, -dz) / DEG) % 360 + 360) % 360;
}

function wrapBin(bin: number): number {
  return ((bin % 360) + 360) % 360;
}

/**
 * How close roads pass the rim at each bearing. Only road outside the deck
 * counts: on the deck a road runs above the rock and cannot touch it.
 */
function roadReach(center: Vec3, network: RoadNetwork): Float32Array {
  const reach = new Float32Array(360).fill(Number.POSITIVE_INFINITY);

  for (const edge of network.edges) {
    if (edge.style === 'islandLoop' || edge.style === 'spur') continue;
    const half = edge.width / 2;

    for (const point of edge.points) {
      const dx = point.x - center.x;
      const dz = point.z - center.z;
      const radius = Math.hypot(dx, dz);
      if (radius < 15 || radius > 36) continue;

      const compass = Math.round(compassOf(dx, dz));
      const spread = Math.ceil(Math.asin(Math.min(1, (half + 1.5) / radius)) / DEG);
      const clear = radius - half - 0.4;

      for (let offset = -spread; offset <= spread; offset += 1) {
        const bin = wrapBin(compass + offset);
        reach[bin] = Math.min(reach[bin] as number, clear);
      }
    }
  }

  return reach;
}

function rimStrips(island: IslandContent, seed: number): RimStrip[] {
  const rng = createRng(seed ^ 0x51ed);
  const cool = island.accent !== 'orange';
  const accent = ACCENT[island.accent];
  const nudge = rngBetween(rng, -4, 4);

  const strips: RimStrip[] = FRONT_STRIPS.map(([from, to, power, weight]) => ({
    from: from + nudge + rngBetween(rng, -2, 2),
    to: to + nudge + rngBetween(rng, -2, 2),
    color: COLORS.orange,
    power: power * rngBetween(rng, 0.9, 1.1),
    weight: weight * rngBetween(rng, 0.9, 1.1),
  }));

  /*
   * Cool islands turn the end of the band to their accent colour, on the flank the
   * opening camera can still see: the rim wall past about 250 faces away from it.
   */
  const flank = strips[strips.length - 1];
  if (cool && flank) {
    const split = flank.from + (flank.to - flank.from) * 0.58;
    strips.push({ ...flank, from: split + 1.5, color: accent, power: flank.power * 1.1 });
    flank.to = split;
  }

  /* The back half, seen when orbiting. Cool islands run their accent there too. */
  let cursor = 256 + nudge;
  let index = 0;
  while (cursor < 360 + 104) {
    const length = rngBetween(rng, 16, 40);
    const end = Math.min(cursor + length, 360 + 108);
    strips.push({
      from: cursor,
      to: end,
      color: cool && index % 2 === 0 ? accent : COLORS.orange,
      power: rngBetween(rng, 0.55, 1),
      weight: rngBetween(rng, 0.5, 1.2),
    });
    cursor = end + rngBetween(rng, 5, 13);
    index += 1;
  }

  return strips;
}

function createPlan(island: IslandContent, network: RoadNetwork): IslandPlan {
  const center = islandCenter(island);
  const seed = hashSeed(island.id);
  return { island, center, seed, reach: roadReach(center, network), strips: rimStrips(island, seed) };
}

let plans: IslandPlan[] | null = null;

export function getIslandPlans(): IslandPlan[] {
  plans ??= islands.map((island) => createPlan(island, world.network));
  return plans;
}

/** Is a rock reaching `radius` over this span of bearings clear of every road? */
export function isClear(plan: IslandPlan, from: number, to: number, radius: number): boolean {
  for (let compass = Math.floor(from); compass <= Math.ceil(to); compass += 1) {
    if ((plan.reach[wrapBin(compass)] as number) < radius) return false;
  }
  return true;
}

/** A strip's brightness at `t` along its length: tapered, so that no end is cut square. */
export function stripEnvelope(t: number): number {
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55);
}

/** Point lights along the strips, in island-local coordinates. */
export function stripLights(plan: IslandPlan): StripLight[] {
  const lights: StripLight[] = [];
  const color = new THREE.Color();

  for (const strip of plan.strips) {
    const steps = Math.max(2, Math.ceil((strip.to - strip.from) / 4));
    color.set(strip.color);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const compass = strip.from + (strip.to - strip.from) * t;
      const power = strip.power * stripEnvelope(t);
      lights.push({
        position: polar(RIM_RADIUS, compass, STRIP_Y),
        color: [color.r * power, color.g * power, color.b * power],
      });
    }
  }

  return lights;
}

/** Light reaching a surface from the strips. Baked once per vertex. */
export function bakeStripLight(
  lights: StripLight[],
  point: Vec3,
  normal: Vec3,
  range: number,
): Rgb {
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const { position, color } of lights) {
    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const dz = position.z - point.z;
    const squared = dx * dx + dy * dy + dz * dz;
    if (squared > range * range) continue;

    const size = Math.sqrt(squared) || 1;
    const facing = (normal.x * dx + normal.y * dy + normal.z * dz) / size;
    /* Half-Lambert: light wraps round a facet slightly, as it would off the rim above. */
    const wrapped = Math.max(0, facing * 0.72 + 0.28);
    const fade = 1 - size / range;
    const strength = (wrapped * wrapped * fade * fade) / (squared + 2.4);

    red += color[0] * strength;
    green += color[1] * strength;
    blue += color[2] * strength;
  }

  return [red, green, blue];
}
