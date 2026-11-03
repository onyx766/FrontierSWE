import { islands } from '@/data/universe';
import { ROAD_WIDTH, type RoadEdge } from '@/universe/world/network';
import { ACCENT, COLORS, hdr } from '../palette';
import { bearingOf, islandProximity, warmthAt } from './layout';
import type { LightBand } from './sections';
import type { LightFn, Rgba } from './sweep';

/**
 * The colour of everything on the roads, chosen per vertex. The Ring's light
 * changes along its length, as in the reference: warm where the Experience Archive
 * and Project Lab pour orange onto it, cool steel by the Backend Engine.
 */

export function linear(color: string, intensity = 1): Rgba {
  const value = hdr(color, intensity);
  return { r: value.r, g: value.g, b: value.b, a: 0 };
}

export function scaled(color: Rgba, level: number, pool = 0): Rgba {
  return { r: color.r * level, g: color.g * level, b: color.b * level, a: pool };
}

function mix(a: Rgba, b: Rgba, t: number, out: Rgba): void {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
}

export const COOL = linear(COLORS.blue);
export const WARM = linear(COLORS.orange);
export const STEEL_BLUE = linear('#74b6ff');
export const VIOLET = linear(COLORS.violet);
export const MAGENTA = linear(COLORS.magenta);
export const CYAN = linear(COLORS.cyan);
/** Light falling on bare metal is far less saturated than the strip that casts it. */
const POOL_COOL = linear('#88a8dc');
const POOL_WARM = linear('#ff9f5c');

const STRIP_LEVEL: Record<LightBand['role'], number> = {
  edge: 6.5,
  inset: 1.8,
  spine: 16,
  skirt: 9,
  diffuser: 1.5,
};

export function solid(color: Rgba, level: number, pool = 0): LightFn {
  return (_x, _y, _z, _lateral, _frame, out) => {
    out.r = color.r * level;
    out.g = color.g * level;
    out.b = color.b * level;
    out.a = pool;
  };
}

export function ringStripLight(level: number): LightFn {
  return (x, _y, z, _lateral, _frame, out) => {
    const bearing = bearingOf(x, z);
    const warm = warmthAt(bearing);
    const near = islandProximity(bearing);
    mix(STEEL_BLUE, WARM, warm * (0.62 + 0.38 * near), out);
    const scale = level * (1 + 0.5 * near);
    out.r *= scale;
    out.g *= scale;
    out.b *= scale;
  };
}

/**
 * The Ring is the hero of the opening shot, and it must not sink into black from
 * any angle. Where the reference's islands would pour warm light on the road, the
 * pool is strong and orange; elsewhere it is a steady cool steel.
 */
function ringPool(base: number): LightFn {
  return (x, _y, z, lateral, _frame, out) => {
    const bearing = bearingOf(x, z);
    const warm = warmthAt(bearing);
    const near = Math.sqrt(islandProximity(bearing));
    mix(POOL_COOL, POOL_WARM, warm * (0.55 + 0.45 * near), out);
    const edge = Math.min(1, Math.abs(lateral) / (ROAD_WIDTH.ring / 2));
    out.a = base * (1 + 2.6 * near * warm * warm + 0.45 * edge * edge);
  };
}

function spineLight(length: number, level: number): LightFn {
  return (_x, _y, _z, _lateral, frame, out) => {
    const fromEnd = Math.min(frame.s, length - frame.s);
    const tip = Math.max(0, 1 - fromEnd / 3.5);
    const scale = level * (1 + 1.4 * tip * tip);
    out.r = WARM.r * scale;
    out.g = WARM.g * scale;
    out.b = WARM.b * scale;
  };
}

function spokeDeckLight(length: number): LightFn {
  return (_x, _y, _z, lateral, frame, out) => {
    const fromEnd = Math.min(frame.s, length - frame.s);
    const tip = Math.max(0, 1 - fromEnd / 5);
    out.r = POOL_WARM.r;
    out.g = POOL_WARM.g;
    out.b = POOL_WARM.b;
    /* The hot spine lights the plates either side of it. */
    const falloff = Math.exp(-((lateral / 0.8) ** 2));
    out.a = 0.32 + 2.2 * falloff + 2.6 * falloff * tip * tip;
  };
}

/** Violet to magenta and back along a leg, so each ribbon is alive along its length. */
export function helixLight(level: number, pool: number): LightFn {
  return (_x, _y, _z, _lateral, frame, out) => {
    mix(VIOLET, MAGENTA, 0.5 + 0.5 * Math.sin(frame.s * 0.11), out);
    out.r *= level;
    out.g *= level;
    out.b *= level;
    out.a = pool;
  };
}

export function stripLight(edge: RoadEdge, role: LightBand['role']): LightFn {
  const level = STRIP_LEVEL[role];
  switch (edge.style) {
    case 'ring':
      return ringStripLight(level);
    case 'spoke':
      if (role === 'spine' || role === 'diffuser') return spineLight(edge.length, level);
      return solid(STEEL_BLUE, level * 0.55);
    case 'coreLoop':
      return solid(CYAN, role === 'edge' ? level * 0.42 : level);
    case 'helix':
      return helixLight(role === 'edge' ? level * 0.6 : level, 0);
    default:
      return solid(STEEL_BLUE, level);
  }
}

export function railLight(edge: RoadEdge): LightFn {
  switch (edge.style) {
    case 'ring':
      return ringStripLight(1.05);
    case 'spoke':
      return solid(WARM, 1.1);
    case 'coreLoop':
      return solid(CYAN, 1.1);
    default:
      return helixLight(1.3, 0);
  }
}

function accentFor(edge: RoadEdge): Rgba {
  const island = islands.find((entry) => edge.id.includes(entry.id));
  return linear(island ? ACCENT[island.accent] : COLORS.blue);
}

export function deckLight(edge: RoadEdge): LightFn {
  switch (edge.style) {
    case 'ring':
      return ringPool(1.5);
    case 'spoke':
      return spokeDeckLight(edge.length);
    case 'coreLoop':
      return solid(POOL_COOL, 1, 0.55);
    case 'helix':
      return helixLight(1, 0.12);
    default:
      return solid(accentFor(edge), 1, 0.3);
  }
}

export function hullLight(edge: RoadEdge): LightFn {
  switch (edge.style) {
    case 'ring':
      return ringPool(1.3);
    case 'spoke':
      return solid(POOL_WARM, 1, 0.3);
    case 'coreLoop':
      return solid(POOL_COOL, 1, 0.3);
    case 'helix':
      return helixLight(1, 0.32);
    default:
      return solid(STEEL_BLUE, 1, 0);
  }
}
