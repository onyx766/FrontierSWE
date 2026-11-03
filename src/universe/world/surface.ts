import type { RoadEdge, RoadNetwork } from './network';
import type { Vec3 } from './vec';

/**
 * The walking surface.
 *
 * The world is a union of capsules (road segments) and discs (island decks).
 * That is not a height field: at an over- or under-pass two surfaces share the
 * same x/z, so a query also takes the height the robot is standing at and only
 * considers surfaces within reach of it. That single rule is what makes a
 * flyover pass over the Ring instead of snapping the robot onto it.
 *
 * Junctions need no code. They are just where capsules overlap, so the robot
 * flows from one road to the next and slides along an edge rather than
 * stopping dead against it.
 */

/** Tallest step the robot takes upward in one sub-step. */
const STEP_UP = 0.5;
/** Furthest it can drop in one sub-step and stay on the same surface. */
const STEP_DOWN = 1;
/** Longest move that is resolved in one go. Keeps fast movement from skipping edges. */
const MAX_SUBSTEP = 0.3;
/** Stops the robot's centre sitting exactly on the edge of a deck. */
const EDGE_MARGIN = 0.55;
/** A point moved back to an edge lands on it, so "on the edge" must count as inside. */
const INSIDE_TOLERANCE = 1e-6;

const CELL_SIZE = 8;

interface Segment {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  /** Half-width of the walkable deck. */
  halfWidth: number;
  edge: RoadEdge;
}

interface Disc {
  cx: number;
  cy: number;
  cz: number;
  radius: number;
}

export interface SurfaceQuery {
  x: number;
  y: number;
  z: number;
  /** True when the point is on a surface; false when it was moved back to one. */
  inside: boolean;
  /** The road underfoot, or null on a deck. */
  edge: RoadEdge | null;
  /** Unit x/z direction of the road underfoot, or null on a deck. */
  tangentX: number | null;
  tangentZ: number | null;
}

export class WalkSurface {
  private readonly segments: Segment[] = [];
  private readonly discs: Disc[] = [];
  private readonly grid = new Map<number, { segments: number[]; discs: number[] }>();

  constructor(private readonly network: RoadNetwork) {
    for (const edge of network.edges) {
      for (let i = 1; i < edge.points.length; i += 1) {
        const a = edge.points[i - 1] as Vec3;
        const b = edge.points[i] as Vec3;
        this.segments.push({
          ax: a.x,
          ay: a.y,
          az: a.z,
          bx: b.x,
          by: b.y,
          bz: b.z,
          halfWidth: edge.width / 2 - EDGE_MARGIN,
          edge,
        });
      }
    }

    for (const disc of network.discs) {
      this.discs.push({
        cx: disc.center.x,
        cy: disc.center.y,
        cz: disc.center.z,
        radius: disc.radius - EDGE_MARGIN,
      });
    }

    this.segments.forEach((segment, index) => {
      const reach = segment.halfWidth + 1;
      this.insert(
        Math.min(segment.ax, segment.bx) - reach,
        Math.min(segment.az, segment.bz) - reach,
        Math.max(segment.ax, segment.bx) + reach,
        Math.max(segment.az, segment.bz) + reach,
        (cell) => cell.segments.push(index),
      );
    });

    this.discs.forEach((disc, index) => {
      const reach = disc.radius + 1;
      this.insert(disc.cx - reach, disc.cz - reach, disc.cx + reach, disc.cz + reach, (cell) =>
        cell.discs.push(index),
      );
    });
  }

  private key(cellX: number, cellZ: number): number {
    return (cellX + 512) * 1024 + (cellZ + 512);
  }

  private insert(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    add: (cell: { segments: number[]; discs: number[] }) => void,
  ) {
    const fromX = Math.floor(minX / CELL_SIZE);
    const toX = Math.floor(maxX / CELL_SIZE);
    const fromZ = Math.floor(minZ / CELL_SIZE);
    const toZ = Math.floor(maxZ / CELL_SIZE);

    for (let cellX = fromX; cellX <= toX; cellX += 1) {
      for (let cellZ = fromZ; cellZ <= toZ; cellZ += 1) {
        const key = this.key(cellX, cellZ);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = { segments: [], discs: [] };
          this.grid.set(key, cell);
        }
        add(cell);
      }
    }
  }

  /**
   * Resolve a point against the surfaces reachable from `groundY`: the highest
   * surface containing it, otherwise the nearest edge it can be moved back to.
   * Returns null only if no surface is within reach at all.
   */
  resolve(x: number, z: number, groundY: number): SurfaceQuery | null {
    const cell = this.grid.get(this.key(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)));
    if (!cell) return null;

    let insideY = -Infinity;
    let insideEdge: RoadEdge | null = null;
    let insideTX = 0;
    let insideTZ = 0;

    let bestExcess = Infinity;
    let edgeX = 0;
    let edgeY = 0;
    let edgeZ = 0;
    let edgeRoad: RoadEdge | null = null;
    let edgeTX = 0;
    let edgeTZ = 0;

    for (const index of cell.segments) {
      const segment = this.segments[index] as Segment;
      const abx = segment.bx - segment.ax;
      const abz = segment.bz - segment.az;
      const lengthSq = abx * abx + abz * abz;
      if (lengthSq < 1e-9) continue;

      let t = ((x - segment.ax) * abx + (z - segment.az) * abz) / lengthSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;

      const surfaceY = segment.ay + (segment.by - segment.ay) * t;
      const rise = surfaceY - groundY;
      if (rise > STEP_UP || rise < -STEP_DOWN) continue;

      const closestX = segment.ax + abx * t;
      const closestZ = segment.az + abz * t;
      const dx = x - closestX;
      const dz = z - closestZ;
      const dist = Math.hypot(dx, dz);
      const excess = dist - segment.halfWidth;
      const length = Math.sqrt(lengthSq);

      if (excess <= INSIDE_TOLERANCE) {
        if (surfaceY > insideY) {
          insideY = surfaceY;
          insideEdge = segment.edge;
          insideTX = abx / length;
          insideTZ = abz / length;
        }
      } else if (excess < bestExcess) {
        bestExcess = excess;
        const ratio = dist > 1e-6 ? segment.halfWidth / dist : 0;
        edgeX = closestX + dx * ratio;
        edgeY = surfaceY;
        edgeZ = closestZ + dz * ratio;
        edgeRoad = segment.edge;
        edgeTX = abx / length;
        edgeTZ = abz / length;
      }
    }

    for (const index of cell.discs) {
      const disc = this.discs[index] as Disc;
      const rise = disc.cy - groundY;
      if (rise > STEP_UP || rise < -STEP_DOWN) continue;

      const dx = x - disc.cx;
      const dz = z - disc.cz;
      const dist = Math.hypot(dx, dz);
      const excess = dist - disc.radius;

      if (excess <= INSIDE_TOLERANCE) {
        /* `>=` so that a deck beats a road flush with it: on a deck the robot
           walks freely, and its camera stops tracking the road beneath. */
        if (disc.cy >= insideY) {
          insideY = disc.cy;
          insideEdge = null;
        }
      } else if (excess < bestExcess) {
        bestExcess = excess;
        const ratio = dist > 1e-6 ? disc.radius / dist : 0;
        edgeX = disc.cx + dx * ratio;
        edgeY = disc.cy;
        edgeZ = disc.cz + dz * ratio;
        edgeRoad = null;
      }
    }

    if (insideY > -Infinity) {
      return {
        x,
        y: insideY,
        z,
        inside: true,
        edge: insideEdge,
        tangentX: insideEdge ? insideTX : null,
        tangentZ: insideEdge ? insideTZ : null,
      };
    }

    if (bestExcess < Infinity) {
      return {
        x: edgeX,
        y: edgeY,
        z: edgeZ,
        inside: false,
        edge: edgeRoad,
        tangentX: edgeRoad ? edgeTX : null,
        tangentZ: edgeRoad ? edgeTZ : null,
      };
    }

    return null;
  }

  private pushOutOfBlockers(position: { x: number; z: number }): boolean {
    let pushed = false;
    for (const blocker of this.network.blockers) {
      const dx = position.x - blocker.x;
      const dz = position.z - blocker.z;
      const dist = Math.hypot(dx, dz);
      if (dist < blocker.radius) {
        const ratio = blocker.radius / (dist > 1e-6 ? dist : 1e-6);
        position.x = blocker.x + (dist > 1e-6 ? dx : blocker.radius) * ratio;
        position.z = blocker.z + dz * ratio;
        pushed = true;
      }
    }
    return pushed;
  }

  /**
   * Move a grounded point by (dx, dz), keeping it on the surface. Long moves
   * are sub-stepped, so a slow frame behaves the same as several fast ones.
   */
  move(from: Vec3, dx: number, dz: number): SurfaceQuery {
    const distanceToMove = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(distanceToMove / MAX_SUBSTEP));
    const stepX = dx / steps;
    const stepZ = dz / steps;

    let x = from.x;
    let y = from.y;
    let z = from.z;
    let result: SurfaceQuery = {
      x,
      y,
      z,
      inside: true,
      edge: null,
      tangentX: null,
      tangentZ: null,
    };

    for (let step = 0; step < steps; step += 1) {
      const candidate = { x: x + stepX, z: z + stepZ };
      this.pushOutOfBlockers(candidate);

      const hit = this.resolve(candidate.x, candidate.z, y);
      if (!hit) break;

      x = hit.x;
      y = hit.y;
      z = hit.z;
      result = hit;
    }

    return result;
  }

  /** Snap an arbitrary point onto the surface, searching around `y` for a level. */
  snap(point: Vec3): SurfaceQuery | null {
    return this.resolve(point.x, point.z, point.y);
  }

  /** True when (x, z) is on a surface reachable from `y`. */
  contains(x: number, y: number, z: number): boolean {
    return this.resolve(x, z, y)?.inside === true;
  }
}
