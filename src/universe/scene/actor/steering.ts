import type { RoadEdge } from '../../world/network';
import { angleDelta, clamp, type Vec3 } from '../../world/vec';

/**
 * The maths of moving well: frame-rate independent damping, turning input into a
 * direction, and reading the road ahead. Pure, and free of three.js, so that the
 * tests can walk the real road network at any frame rate.
 */

/** Move `current` towards `target`, covering the same ground at any frame rate. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** `damp` for an angle, going the short way round. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** A small, reusable x/z vector. Written in place so that nothing allocates per frame. */
export interface Flat {
  x: number;
  z: number;
}

export interface Stick {
  x: number;
  y: number;
  /** Length of the combined input, 0–1. */
  magnitude: number;
}

/** Keyboard and on-screen joystick combined, never longer than one. */
export function combineSticks(
  keyX: number,
  keyY: number,
  touchX: number,
  touchY: number,
  out: Stick,
): Stick {
  const x = keyX + touchX;
  const y = keyY + touchY;
  const length = Math.hypot(x, y);
  const scale = length > 1 ? 1 / length : 1;
  out.x = x * scale;
  out.y = y * scale;
  out.magnitude = Math.min(length, 1);
  return out;
}

/**
 * Stick input to a world direction. `azimuth` is where the camera sits around
 * its target: 0 is south of it, looking north.
 */
export function cameraRelative(stickX: number, stickY: number, azimuth: number, out: Flat): Flat {
  const forwardX = -Math.sin(azimuth);
  const forwardZ = -Math.cos(azimuth);
  /* Right is forward turned a quarter clockwise, seen from above. */
  out.x = forwardX * stickY - forwardZ * stickX;
  out.z = forwardZ * stickY + forwardX * stickX;
  return out;
}

/* ─────────────────────────────── Road reading ───────────────────────────── */

/** Where on a road the robot is. Sticks to a road through overlapping junctions. */
export interface RoadTrack {
  edge: RoadEdge | null;
  /** The centreline point nearest the robot. */
  index: number;
}

/** The roads that carry straight on from each end of a road. */
interface RoadEnds {
  first: RoadEdge | null;
  last: RoadEdge | null;
}

export type RoadChains = ReadonlyMap<RoadEdge, RoadEnds>;

/**
 * The Ring and the Core Loop are chains of edges, one per island. This says
 * which edge follows which, so that walking off the end of one is walking onto
 * the next, and not onto whatever other road happens to meet there.
 */
export function chainRoads(edges: readonly RoadEdge[]): RoadChains {
  const carryOn = (road: RoadEdge, junction: string) =>
    edges.find(
      (other) =>
        other !== road &&
        other.style === road.style &&
        (other.from === junction || other.to === junction),
    ) ?? null;

  return new Map(
    edges.map((road) => [road, { first: carryOn(road, road.from), last: carryOn(road, road.to) }]),
  );
}

/** How far along a road to search, in points, from where the robot last was. */
const TRACK_WINDOW = 4;

function nearestIndex(edge: RoadEdge, first: number, last: number, x: number, z: number): number {
  const from = Math.max(first, 0);
  const to = Math.min(last, edge.points.length - 1);
  let best = from;
  let bestDistance = Infinity;
  for (let i = from; i <= to; i += 1) {
    const point = edge.points[i] as Vec3;
    const reach = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (reach < bestDistance) {
      bestDistance = reach;
      best = i;
    }
  }
  return best;
}

function isOnRoad(edge: RoadEdge, index: number, x: number, z: number): boolean {
  const point = edge.points[index] as Vec3;
  return Math.hypot(point.x - x, point.z - z) <= edge.width / 2;
}

/**
 * Follow the road underfoot. `road` is what the surface reports, which is not
 * quite the same thing: where roads overlap it may be any of them, and on an
 * island deck it is nothing, even though the Ring carries on across the deck.
 * So the robot keeps the road it is on for as long as it is still on it. That is
 * what stops a side road, or a stretch of deck, from pulling it away.
 */
export function updateRoadTrack(
  track: RoadTrack,
  road: RoadEdge | null,
  x: number,
  z: number,
  chains: RoadChains,
): RoadTrack {
  const held = track.edge;

  if (held) {
    const index = nearestIndex(held, track.index - TRACK_WINDOW, track.index + TRACK_WINDOW, x, z);
    if (isOnRoad(held, index, x, z)) {
      track.index = index;
      return track;
    }

    const ends = chains.get(held);
    const next = index === 0 ? ends?.first : index === held.points.length - 1 ? ends?.last : null;
    if (next) {
      const nextIndex = nearestIndex(next, 0, next.points.length - 1, x, z);
      if (isOnRoad(next, nextIndex, x, z)) {
        track.edge = next;
        track.index = nextIndex;
        return track;
      }
    }
  }

  track.edge = road;
  track.index = road ? nearestIndex(road, 0, road.points.length - 1, x, z) : 0;
  return track;
}

const tangent: Flat = { x: 0, z: 0 };

/**
 * Height of the deck under the robot, or `fallback` off any road. The walking
 * surface answers with the highest capsule in reach, which on a slope sits above
 * the deck and moves in steps. That is right for physics, but the robot's feet
 * belong on the deck itself. Decks are level across, so the height comes from
 * the centreline abreast of the robot.
 */
export function deckHeight(track: RoadTrack, x: number, z: number, fallback: number): number {
  const { edge, index } = track;
  if (!edge) return fallback;

  const point = edge.points[index] as Vec3;
  tangentAt(edge, index, tangent);
  const along = (x - point.x) * tangent.x + (z - point.z) * tangent.z;
  const neighbour = edge.points[index + (along >= 0 ? 1 : -1)];
  if (!neighbour) return point.y;

  const span = Math.hypot(neighbour.x - point.x, neighbour.z - point.z) || 1;
  return point.y + (neighbour.y - point.y) * clamp(Math.abs(along) / span, 0, 1);
}

/** How the deck under the robot climbs, per unit of x and of z. Level off any road. */
export function deckSlope(track: RoadTrack, out: Flat): Flat {
  const { edge, index } = track;
  out.x = 0;
  out.z = 0;
  if (!edge) return out;

  const before = edge.points[Math.max(index - 1, 0)] as Vec3;
  const after = edge.points[Math.min(index + 1, edge.points.length - 1)] as Vec3;
  const run = Math.hypot(after.x - before.x, after.z - before.z);
  if (run < 1e-6) return out;

  const climb = (after.y - before.y) / run;
  out.x = (climb * (after.x - before.x)) / run;
  out.z = (climb * (after.z - before.z)) / run;
  return out;
}

/** Unit x/z direction of the centreline at a point. */
function tangentAt(edge: RoadEdge, index: number, out: Flat): Flat {
  const last = edge.points.length - 1;
  const a = edge.points[Math.max(index - 1, 0)] as Vec3;
  const b = edge.points[Math.min(index + 1, last)] as Vec3;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  out.x = dx / length;
  out.z = dz / length;
  return out;
}

export interface RoadReading {
  /** Road direction here, pointing along `toward`. */
  hereX: number;
  hereZ: number;
  /** Road direction a little further on, pointing the same way along the road. */
  aheadX: number;
  aheadZ: number;
  /** Signed distance from the centreline; positive to the right of `here`. */
  offset: number;
}

/**
 * Read the road the robot is tracking, for travel along `toward`. The road has
 * two directions and this picks the nearer one. Returns false on a deck.
 */
export function readRoad(
  track: RoadTrack,
  x: number,
  z: number,
  towardX: number,
  towardZ: number,
  lookAhead: number,
  out: RoadReading,
): boolean {
  const { edge, index } = track;
  if (!edge) return false;

  tangentAt(edge, index, tangent);
  const sign = tangent.x * towardX + tangent.z * towardZ >= 0 ? 1 : -1;
  out.hereX = tangent.x * sign;
  out.hereZ = tangent.z * sign;

  const point = edge.points[index] as Vec3;
  out.offset = (x - point.x) * -out.hereZ + (z - point.z) * out.hereX;

  const ahead = clamp(index + Math.round(sign * lookAhead), 0, edge.points.length - 1);
  tangentAt(edge, ahead, tangent);
  out.aheadX = tangent.x * sign;
  out.aheadZ = tangent.z * sign;
  return true;
}

/** Wishing this close to the road's direction gets full help following it. */
const ASSIST_FULL = Math.cos((18 * Math.PI) / 180);
/** Further off the road's direction than this and the visitor is leaving it. */
const ASSIST_NONE = Math.cos((55 * Math.PI) / 180);
/** How firmly the road takes over at full help. Below one, so the stick still counts. */
const ASSIST_STRENGTH = 0.92;
/** Radians of correction per unit off the centreline. */
const CENTRING = 0.09;

/**
 * Bend a wished direction along the road, so that holding forward carries the
 * robot round curves rather than into the rail. The help fades out as the wish
 * turns away from the road, so stepping off at a junction, or crossing a deck,
 * is never fought.
 */
export function assistAlongRoad(
  wishX: number,
  wishZ: number,
  reading: RoadReading,
  out: Flat,
): Flat {
  const strength =
    smoothstep(ASSIST_NONE, ASSIST_FULL, wishX * reading.hereX + wishZ * reading.hereZ) *
    ASSIST_STRENGTH;

  if (strength <= 0) {
    out.x = wishX;
    out.z = wishZ;
    return out;
  }

  /* Ahead of the road, with a slight turn back towards the centreline. */
  const correction = -reading.offset * CENTRING;
  const roadX = reading.aheadX - reading.aheadZ * correction;
  const roadZ = reading.aheadZ + reading.aheadX * correction;

  const x = wishX + (roadX - wishX) * strength;
  const z = wishZ + (roadZ - wishZ) * strength;
  const length = Math.hypot(x, z) || 1;
  out.x = x / length;
  out.z = z / length;
  return out;
}
