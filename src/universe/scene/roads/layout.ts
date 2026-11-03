import { islands, type IslandId } from '@/data/universe';
import { islandCenter, ringHeight, WORLD } from '@/universe/world/network';
import type { WalkSurface } from '@/universe/world/surface';
import { clamp, DEG } from '@/universe/world/vec';
import { limitLateral, type Frame } from './sweep';

/**
 * Where things go along the roads: pure decisions, no meshes. Which stretches lie
 * on an island deck, where a rail must break so that it never crosses a walkable
 * surface, and where the Helix crosses the Ring.
 */

const CENTERS = islands.map(islandCenter);

/** Width of the blend across an island's rim. */
const RIM_BLEND = 0.55;

/** Distance to the nearest island centre. */
export function islandReach(x: number, z: number): number {
  let nearest = Infinity;
  for (const center of CENTERS) {
    nearest = Math.min(nearest, Math.hypot(x - center.x, z - center.z));
  }
  return nearest;
}

/** 1 on an island deck, 0 clear of it, blended across the rim. */
export function deckCover(x: number, z: number): number {
  return clamp((WORLD.islandRadius + RIM_BLEND / 2 - islandReach(x, z)) / RIM_BLEND, 0, 1);
}

/** Compass bearing of a world position, 0 to 360. */
export function bearingOf(x: number, z: number): number {
  return ((Math.atan2(x, -z) / DEG) % 360 + 360) % 360;
}

/**
 * How warmly each island lights the Ring beside it, read from the reference:
 * the eastern and western arcs near the Experience Archive and Project Lab glow
 * orange, while the stretches by the Backend Engine and About run cool blue.
 */
const ISLAND_WARMTH: Record<IslandId, number> = {
  'ai-core': 0.42,
  about: 0.12,
  'experience-archive': 1,
  'data-vault': 0.86,
  'backend-engine': 0.04,
  'project-lab': 0.92,
};

/** Warmth of the light on the Ring at a bearing, 0 cool to 1 hot. */
export function warmthAt(bearing: number): number {
  const ordered = [...islands].sort((a, b) => a.bearing - b.bearing);
  const sector = 360 / ordered.length;
  const position = (((bearing % 360) + 360) % 360) / sector;
  const index = Math.floor(position);
  const t = position - index;
  const eased = t * t * (3 - 2 * t);
  const a = ordered[index % ordered.length] as (typeof ordered)[number];
  const b = ordered[(index + 1) % ordered.length] as (typeof ordered)[number];
  return ISLAND_WARMTH[a.id] + (ISLAND_WARMTH[b.id] - ISLAND_WARMTH[a.id]) * eased;
}

/** 1 at an island's bearing, falling to 0 midway between two islands. */
export function islandProximity(bearing: number): number {
  const sector = 360 / islands.length;
  const offset = Math.abs((((bearing % sector) + sector) % sector) - sector / 2) / (sector / 2);
  return offset * offset;
}

/** An unbroken run of stations, inclusive at both ends. */
export interface Run {
  from: number;
  to: number;
}

/** Group the stations that pass a test into runs at least `minLength` long. */
export function runsWhere(
  frames: readonly Frame[],
  keep: (frame: Frame, index: number) => boolean,
  minLength = 0,
): Run[] {
  const runs: Run[] = [];
  let start = -1;

  const close = (end: number) => {
    if (start < 0) return;
    const length = (frames[end] as Frame).s - (frames[start] as Frame).s;
    if (end > start && length >= minLength) runs.push({ from: start, to: end });
    start = -1;
  };

  frames.forEach((frame, index) => {
    if (keep(frame, index)) {
      if (start < 0) start = index;
    } else {
      close(index - 1);
    }
  });
  close(frames.length - 1);
  return runs;
}

/**
 * The stretches of a rail that stand free. A rail stops at an island's rim and
 * wherever it would stand on another road, so where roads meet it opens by
 * itself and the robot is never walled off. `surface` already knows what is
 * walkable, including that a road overhead does not count. It also stops short of
 * the inside of a bend too tight to follow, where it would crumple into a hook.
 */
export function railRuns(
  frames: readonly Frame[],
  offset: number,
  surface: Pick<WalkSurface, 'contains'>,
): Run[] {
  return runsWhere(
    frames,
    (frame) => {
      const lateral = limitLateral(offset, frame);
      if (Math.abs(frame.bend) * Math.abs(offset) > 0.42 && offset * frame.bend > 0) return false;
      const x = frame.x + frame.rx * lateral;
      const z = frame.z + frame.rz * lateral;
      return deckCover(x, z) === 0 && !surface.contains(x, frame.y, z);
    },
    2.5,
  );
}

/** Stations of a run spaced about `spacing` apart, staying clear of its ends. */
export function stationsAlong(frames: readonly Frame[], run: Run, spacing: number): number[] {
  const start = (frames[run.from] as Frame).s;
  const end = (frames[run.to] as Frame).s;
  const count = Math.max(1, Math.round((end - start) / spacing));
  const out: number[] = [];
  let cursor = run.from;

  for (let step = 0; step <= count; step += 1) {
    const target = start + ((end - start) * step) / count;
    while (cursor < run.to && (frames[cursor] as Frame).s < target) cursor += 1;
    out.push(cursor);
  }
  return out;
}

/** Where a Helix leg passes the Ring. */
export interface Crossing {
  kind: 'over' | 'under';
  /** Station where the Helix is directly above or below the Ring's centreline. */
  center: number;
  /** Stations just clear of the Ring's outer and inner edges. */
  outer: number;
  inner: number;
}

/** How far from the Ring's centreline a crossing's portals stand. */
export const PORTAL_REACH = 3.55;

function radius(frame: Frame): number {
  return Math.hypot(frame.x, frame.z);
}

/** Height of the Ring's deck under or over a position. */
export function ringDeckAt(x: number, z: number): number {
  return ringHeight(bearingOf(x, z));
}

function stationAtRadius(
  frames: readonly Frame[],
  from: number,
  direction: 1 | -1,
  target: number,
): number {
  const outward = target > WORLD.ringRadius;
  let index = from;
  while (index + direction >= 0 && index + direction < frames.length) {
    const r = radius(frames[index] as Frame);
    if (outward ? r >= target : r <= target) break;
    index += direction;
  }
  return index;
}

/** Find both of a leg's crossings of the Ring, from its stations. */
export function findCrossings(frames: readonly Frame[]): Crossing[] {
  const crossings: Crossing[] = [];

  for (let index = 1; index < frames.length; index += 1) {
    const before = radius(frames[index - 1] as Frame) - WORLD.ringRadius;
    const after = radius(frames[index] as Frame) - WORLD.ringRadius;
    if (before === 0 || before * after > 0) continue;

    const frame = frames[index] as Frame;
    const heading = before > 0 ? 1 : -1;
    const outerTarget = WORLD.ringRadius + PORTAL_REACH;
    const innerTarget = WORLD.ringRadius - PORTAL_REACH;

    crossings.push({
      kind: frame.y > ringDeckAt(frame.x, frame.z) ? 'over' : 'under',
      center: index,
      outer: stationAtRadius(frames, index, heading > 0 ? -1 : 1, outerTarget),
      inner: stationAtRadius(frames, index, heading > 0 ? 1 : -1, innerTarget),
    });
  }
  return crossings;
}

/** Stations of a road whose centreline is clear of every island. */
export function isElevated(frame: Frame): boolean {
  return islandReach(frame.x, frame.z) > WORLD.islandRadius - 0.5;
}

/**
 * How deep the truss may hang here. Where the Helix bridges the Ring the robot walks
 * underneath it with only just enough headroom, so the portals carry that span and
 * the truss runs out either side of them.
 */
export function trussDepthAt(
  frame: Frame,
  nominal: number,
  crossings: readonly Crossing[],
  frames: readonly Frame[],
): number {
  let depth = nominal;
  for (const crossing of crossings) {
    if (crossing.kind !== 'over') continue;
    const center = frames[crossing.center] as Frame;
    const distance = Math.abs(frame.s - center.s);
    const fade = clamp((distance - PORTAL_REACH - 0.2) / 2.4, 0, 1);
    depth = Math.min(depth, nominal * fade * fade * (3 - 2 * fade));
  }
  return depth;
}
