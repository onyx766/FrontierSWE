import { coreStation, islands, type IslandContent } from '@/data/universe';
import { catmullRom, clamp, DEG, distance, polar, resample, vec, type Vec3 } from './vec';

/**
 * The road network: one description of the world's walkable geometry.
 *
 * Road meshes, walking physics, the route finder and the minimap all read this,
 * so what the visitor sees and where the robot can walk cannot drift apart.
 *
 * Network shape, from the crystal outwards:
 *
 *   Core Loop     closed road around the crystal
 *   Spokes        six S-curved roads from the Core Loop to the Ring
 *   Ring          the main orbital road, humped between islands
 *   Island loops  a short loop road on each island, plus spurs to its stations
 *   Helix         six roads weaving around the Ring from island to island:
 *                 over the Ring, a hairpin inside it, back under the Ring.
 *
 * Together the Ring and the Helix give every leg between neighbouring islands
 * two different routes, with real over- and under-passes. The walking surface
 * is therefore a layered graph rather than a height field, which is why
 * `surface.ts` tracks the level the robot is on.
 */

export const WORLD = {
  /** The orbital Ring. */
  ringRadius: 46,
  /** Height the Ring reaches midway between islands. */
  ringHump: 1.4,
  /** Bearing offset from an island where the Ring starts to rise off the deck. */
  ringFlatBearing: 16,

  coreLoopRadius: 25,
  coreLoopY: 0.8,

  /** Distance from the world centre to each island's centre. */
  islandOrbit: 60,
  /** Visual radius of an island platform. */
  islandRadius: 18,
  /** Walkable radius of an island deck. Inside the platform's edge. */
  islandWalkRadius: 16.8,
  /** Centreline radius of an island's loop road. */
  islandLoopRadius: 10.5,
  /** The robot cannot enter this radius. Island props stay within `islandPropReach`. */
  islandPropRadius: 8.8,
  islandPropReach: 8.2,
  /** Where a station pad sits on its island. */
  padOrbit: 13.4,
  padRadius: 2.6,
  /** Extra space around the stop in front of the crystal. */
  corePadRadius: 3.6,
} as const;

export type RoadStyle =
  | 'ring'
  | 'coreLoop'
  | 'spoke'
  | 'helix'
  | 'islandLoop'
  | 'link'
  | 'spur';

/** Full deck width per style. */
export const ROAD_WIDTH: Record<RoadStyle, number> = {
  ring: 5.4,
  coreLoop: 4.2,
  spoke: 3.8,
  helix: 3.4,
  islandLoop: 2.8,
  link: 3.2,
  spur: 2.4,
};

export interface Junction {
  id: string;
  position: Vec3;
  /** Size class, used to draw the plate covering a road meeting. */
  kind: 'major' | 'minor' | 'pad';
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  style: RoadStyle;
  width: number;
  /** Evenly spaced centreline, about one unit apart. Top surface of the deck. */
  points: Vec3[];
  /** Cumulative arc length at each point. */
  lengths: number[];
  length: number;
  /** Maximum |dy/ds| along the edge. */
  maxSlope: number;
}

/** A level round walkable area: an island deck or the pad before the crystal. */
export interface WalkDisc {
  id: string;
  center: Vec3;
  radius: number;
}

/** A round area the robot cannot enter. */
export interface Blocker {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface RoadNetwork {
  junctions: Junction[];
  edges: RoadEdge[];
  discs: WalkDisc[];
  blockers: Blocker[];
}

/* ─────────────────────────────── Placement ──────────────────────────────── */

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ring deck height. Flat across each island, rising to a hump between them. */
export function ringHeight(bearing: number): number {
  const fromIsland = Math.abs(((bearing % 60) + 60) % 60);
  const offset = Math.min(fromIsland, 60 - fromIsland);
  return WORLD.ringHump * smoothstep(WORLD.ringFlatBearing, 30, offset);
}

export function islandCenter(island: Pick<IslandContent, 'bearing'>): Vec3 {
  return polar(WORLD.islandOrbit, island.bearing, 0);
}

/**
 * A point in an island's own frame: `angle` degrees from outward (positive
 * towards increasing bearing), `radius` from the island's centre.
 */
export function islandPoint(
  island: Pick<IslandContent, 'bearing'>,
  angle: number,
  radius: number,
  y = 0,
): Vec3 {
  const center = islandCenter(island);
  const outward = polar(1, island.bearing);
  const tangent = polar(1, island.bearing + 90);
  const cos = Math.cos(angle * DEG);
  const sin = Math.sin(angle * DEG);
  return {
    x: center.x + radius * (outward.x * cos + tangent.x * sin),
    y,
    z: center.z + radius * (outward.z * cos + tangent.z * sin),
  };
}

/** A point in an island's frame by distance towards the world centre, and sideways. */
export function islandOffset(
  island: Pick<IslandContent, 'bearing'>,
  inward: number,
  side: number,
  y = 0,
): Vec3 {
  const center = islandCenter(island);
  const outward = polar(1, island.bearing);
  const tangent = polar(1, island.bearing + 90);
  return {
    x: center.x - outward.x * inward + tangent.x * side,
    y,
    z: center.z - outward.z * inward + tangent.z * side,
  };
}

/* ───────────────────────────────── Builder ──────────────────────────────── */

const SAMPLE_SPACING = 1;

function makeEdge(
  id: string,
  from: string,
  to: string,
  style: RoadStyle,
  raw: Vec3[],
): RoadEdge {
  const points = resample(raw, SAMPLE_SPACING);
  const lengths: number[] = [0];
  let maxSlope = 0;

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1] as Vec3;
    const current = points[i] as Vec3;
    const run = distance(previous, current);
    lengths.push((lengths[i - 1] as number) + run);
    const flat = Math.hypot(current.x - previous.x, current.z - previous.z);
    if (flat > 1e-6) maxSlope = Math.max(maxSlope, Math.abs(current.y - previous.y) / flat);
  }

  return {
    id,
    from,
    to,
    style,
    width: ROAD_WIDTH[style],
    points,
    lengths,
    length: lengths[lengths.length - 1] as number,
    maxSlope,
  };
}

function sampleArc(fromBearing: number, toBearing: number, at: (bearing: number) => Vec3): Vec3[] {
  const steps = Math.max(8, Math.ceil(Math.abs(toBearing - fromBearing)));
  const points: Vec3[] = [];
  for (let step = 0; step <= steps; step += 1) {
    points.push(at(fromBearing + ((toBearing - fromBearing) * step) / steps));
  }
  return points;
}

/**
 * One leg of the Helix, as offsets from the leg's starting bearing. It runs
 * along the island's rim and climbs, bridges over the Ring, makes a wide U-turn
 * inside it, dips under the Ring, then follows the next island's flank back up
 * to deck height.
 *
 * Each bridge holds its height across the whole width of the Ring: 2.4 of
 * headroom plus the deck overhead. The height change between them is spread
 * evenly along the U-turn rather than packed into its tight tip, and the
 * approach to the next island runs outside its rim so that the road is back at
 * deck height before it reaches the platform instead of passing through it.
 */
const HELIX_LEG: { radius: number; bearing: number; y: number }[] = [
  { radius: 54.5, bearing: 17.3, y: 1.55 },
  { radius: 49.8, bearing: 19.6, y: 3.1 },
  { radius: 46, bearing: 21.5, y: 3.55 },
  { radius: 42.4, bearing: 22.1, y: 3.5 },
  { radius: 37, bearing: 23.6, y: 1.98 },
  { radius: 34.2, bearing: 26.2, y: 1.15 },
  { radius: 33, bearing: 29.5, y: 0.19 },
  { radius: 34.2, bearing: 32.6, y: -0.64 },
  { radius: 37, bearing: 34.6, y: -1.33 },
  { radius: 41.5, bearing: 35.6, y: -2.35 },
  { radius: 46, bearing: 36, y: -2.6 },
];

/** The climb up the next island's flank, in that island's frame: inward, sideways, height. */
const HELIX_APPROACH: { inward: number; side: number; y: number }[] = [
  { inward: 15.2, side: -19.1, y: -2.4 },
  { inward: 12.5, side: -19.4, y: -1.9 },
  { inward: 7, side: -19.8, y: -0.8 },
  { inward: 2.5, side: -19.6, y: 0 },
  { inward: -0.3, side: -16.6, y: 0 },
];

/** Reach from an island's centre where a Helix leg must sit exactly on the deck. */
const DECK_FLUSH = 15.4;
/** Reach within which a leg must not dip below the deck, or it would cut the platform. */
const DECK_CLEAR = 19.6;

function clearOfDecks(points: Vec3[], ...decks: Vec3[]): Vec3[] {
  return points.map((point) => {
    let y = point.y;
    for (const deck of decks) {
      const reach = Math.hypot(point.x - deck.x, point.z - deck.z);
      if (reach < DECK_FLUSH) y = 0;
      else if (reach < DECK_CLEAR) y = Math.max(y, 0);
    }
    return { ...point, y };
  });
}

export function junctionIds(islandId: string) {
  return {
    hub: `hub-${islandId}`,
    ring: `ring-${islandId}`,
    loopIn: `loop-${islandId}-in`,
    loopCw: `loop-${islandId}-cw`,
    loopCcw: `loop-${islandId}-ccw`,
  };
}

export function padJunctionId(stationId: string): string {
  return `pad-${stationId}`;
}

export function buildRoadNetwork(): RoadNetwork {
  const ordered = [...islands].sort((a, b) => a.bearing - b.bearing);
  const junctions: Junction[] = [];
  const edges: RoadEdge[] = [];
  const discs: WalkDisc[] = [];
  const blockers: Blocker[] = [];

  /* Core Loop, Ring and Spokes share the island bearings. */
  ordered.forEach((island, index) => {
    const next = ordered[(index + 1) % ordered.length] as IslandContent;
    const ids = junctionIds(island.id);
    const nextIds = junctionIds(next.id);
    const endBearing = next.bearing > island.bearing ? next.bearing : next.bearing + 360;

    junctions.push({
      id: ids.hub,
      position: polar(WORLD.coreLoopRadius, island.bearing, WORLD.coreLoopY),
      kind: 'major',
    });
    junctions.push({
      id: ids.ring,
      position: polar(WORLD.ringRadius, island.bearing, 0),
      kind: 'major',
    });

    edges.push(
      makeEdge(
        `core-${island.id}`,
        ids.hub,
        nextIds.hub,
        'coreLoop',
        sampleArc(island.bearing, endBearing, (bearing) =>
          polar(WORLD.coreLoopRadius, bearing, WORLD.coreLoopY),
        ),
      ),
    );

    edges.push(
      makeEdge(
        `ring-${island.id}`,
        ids.ring,
        nextIds.ring,
        'ring',
        sampleArc(island.bearing, endBearing, (bearing) =>
          polar(WORLD.ringRadius, bearing, ringHeight(bearing)),
        ),
      ),
    );

    /* Alternate the chicane so neighbouring spokes mirror each other. */
    const side = index % 2 === 0 ? 1 : -1;
    edges.push(
      makeEdge(
        `spoke-${island.id}`,
        ids.hub,
        ids.ring,
        'spoke',
        catmullRom(
          [
            polar(WORLD.coreLoopRadius, island.bearing, WORLD.coreLoopY),
            polar(30.5, island.bearing + 5.5 * side, 1.2),
            polar(35.5, island.bearing, 1.6),
            polar(40.5, island.bearing - 4 * side, 1.1),
            polar(WORLD.ringRadius, island.bearing, 0),
          ],
          false,
        ),
      ),
    );
  });

  /* Island loops, links to the Ring, and station spurs. */
  ordered.forEach((island) => {
    const ids = junctionIds(island.id);
    const center = islandCenter(island);

    discs.push({ id: `deck-${island.id}`, center, radius: WORLD.islandWalkRadius });
    blockers.push({
      id: `props-${island.id}`,
      x: center.x,
      z: center.z,
      radius: WORLD.islandPropRadius,
    });

    const stops = [
      { angle: -90, id: ids.loopCcw, kind: 'minor' as const },
      { angle: 90, id: ids.loopCw, kind: 'minor' as const },
      { angle: 180, id: ids.loopIn, kind: 'minor' as const },
      ...island.stations.map((station) => ({
        angle: station.angle,
        id: `loop-${station.id}`,
        kind: 'minor' as const,
      })),
    ].sort((a, b) => a.angle - b.angle);

    for (const stop of stops) {
      junctions.push({
        id: stop.id,
        position: islandPoint(island, stop.angle, WORLD.islandLoopRadius),
        kind: stop.kind,
      });
    }

    stops.forEach((stop, index) => {
      const next = stops[(index + 1) % stops.length] as (typeof stops)[number];
      const endAngle = next.angle > stop.angle ? next.angle : next.angle + 360;
      edges.push(
        makeEdge(
          `island-${island.id}-${index}`,
          stop.id,
          next.id,
          'islandLoop',
          sampleArc(stop.angle, endAngle, (angle) =>
            islandPoint(island, angle, WORLD.islandLoopRadius),
          ),
        ),
      );
    });

    edges.push(
      makeEdge(`link-${island.id}`, ids.ring, ids.loopIn, 'link', [
        polar(WORLD.ringRadius, island.bearing, 0),
        islandPoint(island, 180, WORLD.islandLoopRadius),
      ]),
    );

    for (const station of island.stations) {
      const padId = padJunctionId(station.id);
      junctions.push({
        id: padId,
        position: islandPoint(island, station.angle, WORLD.padOrbit),
        kind: 'pad',
      });
      edges.push(
        makeEdge(`spur-${station.id}`, `loop-${station.id}`, padId, 'spur', [
          islandPoint(island, station.angle, WORLD.islandLoopRadius),
          islandPoint(island, station.angle, WORLD.padOrbit),
        ]),
      );
    }
  });

  /* The Helix, one leg per pair of neighbouring islands. */
  ordered.forEach((island, index) => {
    const next = ordered[(index + 1) % ordered.length] as IslandContent;
    const start = island.bearing;

    edges.push(
      makeEdge(
        `helix-${island.id}`,
        junctionIds(island.id).loopCw,
        junctionIds(next.id).loopCcw,
        'helix',
        clearOfDecks(
          catmullRom(
            [
              islandPoint(island, 90, WORLD.islandLoopRadius),
              islandPoint(island, 98, 15.5),
              ...HELIX_LEG.map((control) =>
                polar(control.radius, start + control.bearing, control.y),
              ),
              ...HELIX_APPROACH.map((control) =>
                islandOffset(next, control.inward, control.side, control.y),
              ),
              islandPoint(next, -90, WORLD.islandLoopRadius),
            ],
            false,
          ),
          islandCenter(island),
          islandCenter(next),
        ),
      ),
    );
  });

  /* The stop in front of the crystal gets a little more room than the road. */
  discs.push({
    id: `deck-${coreStation.id}`,
    center: polar(WORLD.coreLoopRadius, coreStation.bearing, WORLD.coreLoopY),
    radius: WORLD.corePadRadius,
  });

  return { junctions, edges, discs, blockers };
}

/** Bounding radius of the road network, for framing and the minimap. */
export function networkExtent(network: RoadNetwork): number {
  let extent = 0;
  for (const edge of network.edges) {
    for (const point of edge.points) extent = Math.max(extent, Math.hypot(point.x, point.z));
  }
  for (const disc of network.discs) {
    extent = Math.max(extent, Math.hypot(disc.center.x, disc.center.z) + disc.radius);
  }
  return extent;
}

export { vec };
