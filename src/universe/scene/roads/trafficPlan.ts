import type { RoadNetwork } from '@/universe/world/network';
import { distance, type Vec3 } from '@/universe/world/vec';
import { COLORS, hdr } from '../palette';
import { createRng } from '@/lib/rng';

/**
 * What the data packets drive along: pure data for `Traffic.tsx`. Each path is
 * resampled evenly into one row of a float texture, so the vertex shader can
 * place a packet from a row number and a distance, and nothing per packet is
 * touched on the CPU.
 */

/** Samples per path. Enough to follow a hairpin on the longest road. */
export const PATH_SAMPLES = 512;

export interface TrafficPath {
  /** `PATH_SAMPLES` points, evenly spaced. */
  points: Vec3[];
  length: number;
  closed: boolean;
}

export interface Packet {
  path: number;
  /** 0 to 1 along its path at time zero. */
  phase: number;
  /** World units per second. Negative runs the path backwards. */
  speed: number;
  /** Offset to the right of travel. */
  lane: number;
  color: [number, number, number];
  /** Length of the trail, world units. */
  tail: number;
}

function resampleEven(points: readonly Vec3[], samples: number): { out: Vec3[]; length: number } {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(
      (lengths[i - 1] as number) + distance(points[i - 1] as Vec3, points[i] as Vec3),
    );
  }
  const length = lengths[lengths.length - 1] as number;
  const out: Vec3[] = [];
  let cursor = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const target = (sample / (samples - 1)) * length;
    while (cursor < points.length - 2 && (lengths[cursor + 1] as number) < target) cursor += 1;
    const start = lengths[cursor] as number;
    const end = lengths[cursor + 1] as number;
    const t = end > start ? Math.min(1, (target - start) / (end - start)) : 0;
    const a = points[cursor] as Vec3;
    const b = points[cursor + 1] as Vec3;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }
  return { out, length };
}

/** Join edges that follow one another into a single polyline. */
function chain(network: RoadNetwork, style: 'ring' | 'coreLoop'): Vec3[] {
  const edges = network.edges.filter((edge) => edge.style === style);
  const points: Vec3[] = [];
  for (const edge of edges) {
    if (points.length > 0) points.push(...edge.points.slice(1));
    else points.push(...edge.points);
  }
  return points;
}

function makePath(points: readonly Vec3[], closed: boolean): TrafficPath {
  const { out, length } = resampleEven(points, PATH_SAMPLES);
  return { points: out, length, closed };
}

function rgb(color: string, intensity: number): [number, number, number] {
  const value = hdr(color, intensity);
  return [value.r, value.g, value.b];
}

export interface TrafficPlan {
  paths: TrafficPath[];
  packets: Packet[];
}

/**
 * The Ring and the Core Loop run as closed circuits with traffic both ways. Each
 * Spoke and Helix leg is an open run: packets fade in and out at its ends, which
 * sit on junction plates, so the hand-over reads as the plate taking them in.
 */
export function planTraffic(network: RoadNetwork): TrafficPlan {
  const rng = createRng(7741);
  const paths: TrafficPath[] = [];
  const packets: Packet[] = [];

  const add = (
    path: TrafficPath,
    count: number,
    design: {
      speed: [number, number];
      lanes: number[];
      colors: [number, number, number][];
      tail: [number, number];
    },
  ) => {
    const index = paths.length;
    paths.push(path);
    for (let i = 0; i < count; i += 1) {
      const lane = design.lanes[i % design.lanes.length] as number;
      const speed = design.speed[0] + rng() * (design.speed[1] - design.speed[0]);
      packets.push({
        path: index,
        phase: (i + rng() * 0.7) / count,
        speed: i % design.lanes.length === 0 ? speed : -speed,
        lane: Math.abs(lane),
        color: design.colors[Math.floor(rng() * design.colors.length)] as [number, number, number],
        tail: design.tail[0] + rng() * (design.tail[1] - design.tail[0]),
      });
    }
  };

  add(makePath(chain(network, 'ring'), true), 56, {
    speed: [8, 13],
    lanes: [1.34, 0.42],
    colors: [rgb(COLORS.orange, 7), rgb(COLORS.amber, 6), rgb(COLORS.orange, 9)],
    tail: [2, 4.2],
  });

  add(makePath(chain(network, 'coreLoop'), true), 18, {
    speed: [6, 9],
    lanes: [1.2, 1.2],
    colors: [rgb(COLORS.cyan, 6), rgb(COLORS.blue, 7)],
    tail: [1.6, 3],
  });

  for (const edge of network.edges) {
    if (edge.style === 'spoke') {
      add(makePath(edge.points, false), 5, {
        speed: [7, 11],
        lanes: [0.92, 0.92],
        colors: [rgb(COLORS.orange, 8), rgb(COLORS.amber, 7)],
        tail: [1.6, 3],
      });
    } else if (edge.style === 'helix') {
      add(makePath(edge.points, false), 9, {
        speed: [8, 12],
        lanes: [0.72, 0.72],
        colors: [rgb(COLORS.violet, 8), rgb(COLORS.magenta, 7), rgb('#a98bff', 7)],
        tail: [1.8, 3.4],
      });
    }
  }

  return { paths, packets };
}


