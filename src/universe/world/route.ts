import type { RoadEdge, RoadNetwork } from './network';
import { distance, type Vec3 } from './vec';

/**
 * Route finding over the road graph, for click-to-travel and the guided tour.
 *
 * Dijkstra from the nearest point on the network to a target junction. The
 * graph has fewer than two hundred nodes, so a linear scan for the next node is
 * clearer than a heap and costs nothing noticeable on a one-off query.
 */

export interface Route {
  /** The polyline to walk, from the start position to the target junction. */
  points: Vec3[];
  length: number;
  /** Road ids in travel order, including the one the walk starts on. */
  via: string[];
}

interface Link {
  to: string;
  edge: RoadEdge;
  /** True when the edge is walked from `to` back towards `from`. */
  reversed: boolean;
}

interface EdgeHit {
  edge: RoadEdge;
  /** Index of the segment start in `edge.points`. */
  segment: number;
  /** Position along that segment, 0–1. */
  t: number;
  point: Vec3;
  /** Arc length from the edge's first point to `point`. */
  along: number;
}

/**
 * Closest point on the network to `position`. Height counts for more than
 * horizontal distance, because at a crossing the road that matters is the one
 * underfoot rather than the one that happens to pass closest overhead.
 */
export function nearestOnNetwork(network: RoadNetwork, position: Vec3): EdgeHit {
  const HEIGHT_WEIGHT = 3;
  let best: EdgeHit | null = null;
  let bestScore = Infinity;

  for (const edge of network.edges) {
    for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1] as Vec3;
      const b = edge.points[i] as Vec3;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lengthSq = abx * abx + abz * abz;
      if (lengthSq < 1e-9) continue;

      let t = ((position.x - a.x) * abx + (position.z - a.z) * abz) / lengthSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;

      const point = {
        x: a.x + abx * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + abz * t,
      };
      const flat = Math.hypot(position.x - point.x, position.z - point.z);
      const score = flat + Math.abs(position.y - point.y) * HEIGHT_WEIGHT;

      if (score < bestScore) {
        bestScore = score;
        const segmentLength =
          (edge.lengths[i] as number) - (edge.lengths[i - 1] as number);
        best = {
          edge,
          segment: i - 1,
          t,
          point,
          along: (edge.lengths[i - 1] as number) + segmentLength * t,
        };
      }
    }
  }

  if (!best) throw new Error('Road network is empty');
  return best;
}

function adjacency(network: RoadNetwork): Map<string, Link[]> {
  const links = new Map<string, Link[]>();
  const add = (from: string, link: Link) => {
    const list = links.get(from);
    if (list) list.push(link);
    else links.set(from, [link]);
  };

  for (const edge of network.edges) {
    add(edge.from, { to: edge.to, edge, reversed: false });
    add(edge.to, { to: edge.from, edge, reversed: true });
  }
  return links;
}

function walkEdge(link: Link): Vec3[] {
  return link.reversed ? [...link.edge.points].reverse() : link.edge.points;
}

/** Shortest walk from `start` to the junction `targetId`. */
export function findRoute(network: RoadNetwork, start: Vec3, targetId: string): Route {
  const links = adjacency(network);
  const hit = nearestOnNetwork(network, start);

  const dist = new Map<string, number>();
  const previous = new Map<string, Link & { from: string }>();
  const pending = new Set<string>(network.junctions.map((junction) => junction.id));

  /* Seed Dijkstra with both ways off the road the walk starts on. */
  const toStart = hit.along;
  const toEnd = hit.edge.length - hit.along;
  dist.set(hit.edge.from, toStart);
  dist.set(hit.edge.to, Math.min(dist.get(hit.edge.to) ?? Infinity, toEnd));

  while (pending.size > 0) {
    let current: string | null = null;
    let currentDist = Infinity;

    for (const id of pending) {
      const value = dist.get(id) ?? Infinity;
      if (value < currentDist) {
        currentDist = value;
        current = id;
      }
    }

    if (current === null || current === targetId) break;
    pending.delete(current);

    for (const link of links.get(current) ?? []) {
      const candidate = currentDist + link.edge.length;
      if (candidate < (dist.get(link.to) ?? Infinity)) {
        dist.set(link.to, candidate);
        previous.set(link.to, { ...link, from: current });
      }
    }
  }

  if (!dist.has(targetId)) throw new Error(`No route to junction "${targetId}"`);

  const chain: (Link & { from: string })[] = [];
  let cursor = targetId;
  for (;;) {
    const step = previous.get(cursor);
    if (!step) break;
    chain.unshift(step);
    cursor = step.from;
  }

  const firstJunction = cursor;
  const points: Vec3[] = [{ ...start }, hit.point];
  const via: string[] = [hit.edge.id];

  /* The stretch of the current road between the start and the first junction. */
  const edgePoints = hit.edge.points;
  if (firstJunction === hit.edge.to) {
    points.push(...edgePoints.slice(hit.segment + 1));
  } else {
    for (let i = hit.segment; i >= 0; i -= 1) points.push(edgePoints[i] as Vec3);
  }

  for (const step of chain) {
    points.push(...walkEdge(step).slice(1));
    via.push(step.edge.id);
  }

  /* Drop near-duplicate points so the walker never divides by a zero-length step. */
  const clean: Vec3[] = [];
  for (const point of points) {
    const last = clean[clean.length - 1];
    if (!last || distance(last, point) > 1e-3) clean.push(point);
  }

  let length = 0;
  for (let i = 1; i < clean.length; i += 1) {
    length += distance(clean[i - 1] as Vec3, clean[i] as Vec3);
  }

  return { points: clean, length, via };
}
