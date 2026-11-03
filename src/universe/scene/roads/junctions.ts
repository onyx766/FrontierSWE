import { coreStation, islands } from '@/data/universe';
import { WORLD, type Junction, type RoadEdge, type RoadNetwork } from '@/universe/world/network';
import { polar, type Vec3 } from '@/universe/world/vec';
import { warmthAt } from './layout';
import { COOL, scaled, WARM } from './roadLight';
import { HULL_TILE, type RoadBuild } from './roadTypes';
import { MAJOR_PLATE_LIFT, MINOR_PLATE_LIFT } from './sections';
import { atFrame, stationAt } from './structures';
import { addBeam, addCable, addRevolve, type Frame, type RevolvePoint, type Rgba } from './sweep';

/**
 * Where roads meet. A major junction gets a machined plate with a glowing ring,
 * covering the join; a minor one a small inlay. Pad junctions belong to the
 * stations layer.
 */

export const MAJOR_RADIUS = 3.72;
const MINOR_RADIUS = 1.72;

/** How far before a Spoke's end, which is the Ring's centre, it reaches the Ring's inner edge. */
const GATE_BEFORE_END = 5.2;

function plateUv(radius: number, rotation: number) {
  return (angle: number, point: RevolvePoint): [number, number] => [
    0.5 + (Math.cos(angle + rotation) * point.r) / (radius * 2.2),
    0.5 + (Math.sin(angle + rotation) * point.r) / (radius * 2.2),
  ];
}

function hullRevolveUv(angle: number, _point: RevolvePoint, around: number): [number, number] {
  return [(angle * 4) / HULL_TILE, around / HULL_TILE];
}

/** Hot or cool, as the Ring is at this island. */
function islandHeat(bearing: number): Rgba {
  return warmthAt(bearing) > 0.5 ? WARM : COOL;
}

function junctionTint(junction: Junction): Rgba {
  const island = islands.find((entry) => junction.id.endsWith(entry.id));
  return scaled(island ? islandHeat(island.bearing) : COOL, 1, 0.55);
}

/** The hub in front of the crystal is also a station pad, which sits on this plate. */
function isPadHub(junction: Junction): boolean {
  const island = islands.find((entry) => entry.bearing === coreStation.bearing);
  return island !== undefined && junction.id === `hub-${island.id}`;
}

function buildMajorPlate(junction: Junction, build: RoadBuild): void {
  const center = junction.position;
  const tint = junctionTint(junction);
  const elevated = junction.id.startsWith('hub-');
  const padHub = isPadHub(junction);
  const lift = padHub ? 0 : MAJOR_PLATE_LIFT;
  const top: Vec3 = { ...center, y: center.y + lift };
  /* A pad of radius 3.6 drops into a shallow seat, so it never fights with this plate. */
  const seat = padHub ? -0.05 : 0;

  addRevolve(
    build.plates,
    { ...top, y: top.y + seat },
    [
      { r: 0.02, y: 0 },
      { r: MAJOR_RADIUS, y: 0 },
    ],
    { segments: 72, uv: plateUv(MAJOR_RADIUS, 0.3), light: tint },
  );

  const rim: RevolvePoint[] = [
    { r: MAJOR_RADIUS, y: seat },
    { r: MAJOR_RADIUS + 0.02, y: 0.03 },
    { r: MAJOR_RADIUS + 0.08, y: 0.03 },
    { r: MAJOR_RADIUS + 0.2, y: -0.08 },
    { r: MAJOR_RADIUS + 0.2, y: elevated ? -0.34 : -0.14 },
  ];
  const drum: RevolvePoint[] = elevated
    ? [
        { r: MAJOR_RADIUS - 0.4, y: -0.46 },
        { r: MAJOR_RADIUS - 1.4, y: -0.95 },
        { r: 0.02, y: -0.95 },
      ]
    : [];

  addRevolve(build.hull, top, [...rim, ...drum], {
    segments: 72,
    uv: hullRevolveUv,
    light: tint,
  });
}

function buildMinorPlate(junction: Junction, build: RoadBuild): void {
  const center = junction.position;
  const island = islands.find((entry) => junction.id.includes(entry.id));
  addRevolve(
    build.plates,
    { ...center, y: center.y + MINOR_PLATE_LIFT },
    [
      { r: 0.02, y: 0 },
      { r: MINOR_RADIUS, y: 0 },
      { r: MINOR_RADIUS + 0.05, y: -0.03 },
    ],
    {
      segments: 36,
      uv: plateUv(MINOR_RADIUS, 1.1),
      light: scaled(island ? islandHeat(island.bearing) : COOL, 0.7, 0.4),
    },
  );
}

/**
 * Where a Spoke lands on the Ring it passes between a pair of lit bollards: the
 * bright tips of the reference, set by each island's heat, so the crossings by the
 * Backend Engine and About burn blue and the others orange, as they do in the image.
 * They stand on the deck's edges, clear of the walkable width.
 */
export function buildLandingGate({
  edge,
  frames,
  build,
  lift,
}: {
  edge: RoadEdge;
  frames: readonly Frame[];
  build: RoadBuild;
  lift: number;
}): void {
  const island = islands.find((entry) => edge.id === `spoke-${entry.id}`);
  if (!island) return;
  const heat = islandHeat(island.bearing);
  const end = (frames[frames.length - 1] as Frame).s;
  const frame = frames[stationAt(frames, end - GATE_BEFORE_END)] as Frame;
  const reach = edge.width / 2 + 0.2;
  const options = { tile: HULL_TILE, caps: true, light: scaled(heat, 1, 0.6) };

  for (const side of [-1, 1]) {
    const foot = atFrame(frame, reach * side, -0.3, lift);
    const head = { ...foot, y: foot.y + 1.42 };
    addBeam(build.hull, foot, head, 0.26, 0.26, { ...options, taper: 0.72 });
    addBeam(build.hull, { ...head, y: head.y + 0.08 }, { ...head, y: head.y - 0.04 }, 0.3, 0.3, options);

    const inward = { x: -frame.rx * side * 0.14, y: 0, z: -frame.rz * side * 0.14 };
    addCable(
      build.lights,
      { x: foot.x + inward.x, y: foot.y + 0.42, z: foot.z + inward.z },
      { x: head.x + inward.x, y: head.y - 0.1, z: head.z + inward.z },
      0.028,
      scaled(heat, 13),
      'line',
      1.6,
    );
    build.glows.push({
      x: head.x + inward.x,
      y: head.y - 0.4,
      z: head.z + inward.z,
      size: 4.6,
      color: [heat.r * 0.6, heat.g * 0.6, heat.b * 0.6],
    });
  }
}

/** Soft haloes where a Spoke burns hottest, and a band of heat along it. */
function buildGlows(network: RoadNetwork, build: RoadBuild): void {
  for (const island of islands) {
    const heat = islandHeat(island.bearing);
    const tip = (radius: number, y: number, size: number, level: number) => {
      const point = polar(radius, island.bearing, y);
      build.glows.push({
        x: point.x,
        y: point.y,
        z: point.z,
        size,
        color: [heat.r * level, heat.g * level, heat.b * level],
      });
    };
    tip(WORLD.ringRadius - 3.4, 0.7, 13, 0.42);
    tip(WORLD.ringRadius - 3.4, 0.7, 5, 0.5);
  }

  for (const edge of network.edges) {
    if (edge.style !== 'spoke') continue;
    const every = 3.4;
    for (let s = every / 2; s < edge.length; s += every) {
      const point = edge.points[Math.round(s)] as Vec3;
      build.glows.push({
        x: point.x,
        y: point.y + 0.35,
        z: point.z,
        size: 8.5,
        color: [WARM.r * 0.1, WARM.g * 0.1, WARM.b * 0.1],
      });
    }
  }
}

export function buildJunctions(network: RoadNetwork, build: RoadBuild): void {
  for (const junction of network.junctions) {
    if (junction.kind === 'major') buildMajorPlate(junction, build);
    else if (junction.kind === 'minor') buildMinorPlate(junction, build);
  }
  buildGlows(network, build);
}
