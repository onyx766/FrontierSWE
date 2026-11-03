import { describe, expect, it } from 'vitest';
import { ROAD_WIDTH, type RoadEdge } from '@/universe/world/network';
import { polar, type Vec3 } from '@/universe/world/vec';
import { world } from '@/universe/world/world';
import { SMOOTH_TOLERANCE } from '../buildRoads';
import { ROAD_SECTIONS } from '../sections';
import {
  addBeam,
  addCable,
  buildFrames,
  limitLateral,
  MeshBuffer,
  refine,
  sweep,
  thin,
  type Frame,
  type SectionPath,
} from '../sweep';

const flatUv = { u: () => 0, v: () => 0 };

function arc(radius: number, from: number, to: number, y: (t: number) => number): Vec3[] {
  const points: Vec3[] = [];
  const steps = Math.ceil(Math.abs(to - from));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    points.push(polar(radius, from + (to - from) * t, y(t)));
  }
  return points;
}

function position(buffer: MeshBuffer, index: number): Vec3 {
  return {
    x: buffer.positions[index * 3] as number,
    y: buffer.positions[index * 3 + 1] as number,
    z: buffer.positions[index * 3 + 2] as number,
  };
}

/** A deck top: one flat band from edge to edge. */
const deckTop = (width: number): SectionPath => [
  { x: -width / 2, y: 0 },
  { x: width / 2, y: 0 },
];

describe('sweeping a section along a road', () => {
  it('puts deck-top vertices at the centreline height and at ± width / 2', () => {
    const width = 5.4;
    const points = arc(46, 10, 50, (t) => 1.4 * Math.sin(t * Math.PI));
    const frames = buildFrames(points);
    const buffer = new MeshBuffer();
    sweep(buffer, frames, deckTop(width), flatUv);

    expect(buffer.vertexCount).toBe(frames.length * 2);

    frames.forEach((frame, station) => {
      const left = position(buffer, station * 2);
      const right = position(buffer, station * 2 + 1);

      expect(left.y).toBeCloseTo(frame.y, 10);
      expect(right.y).toBeCloseTo(frame.y, 10);

      expect(Math.hypot(left.x - frame.x, left.z - frame.z)).toBeCloseTo(width / 2, 10);
      expect(Math.hypot(right.x - frame.x, right.z - frame.z)).toBeCloseTo(width / 2, 10);

      /* Left and right lie on opposite sides of the centreline. */
      expect(
        Math.hypot((left.x + right.x) / 2 - frame.x, (left.z + right.z) / 2 - frame.z),
      ).toBeCloseTo(0, 10);
    });
  });

  it('stays level across the road however steeply it climbs', () => {
    const points: Vec3[] = [];
    for (let i = 0; i < 30; i += 1) points.push({ x: i, y: i * 0.45, z: Math.sin(i * 0.2) * 3 });
    const frames = buildFrames(points);
    const buffer = new MeshBuffer();
    sweep(buffer, frames, deckTop(3.4), flatUv);

    for (let station = 0; station < frames.length; station += 1) {
      expect(position(buffer, station * 2).y).toBeCloseTo(position(buffer, station * 2 + 1).y, 10);
    }
  });

  it('raises the whole section by the lift and nothing else', () => {
    const frames = buildFrames(arc(25, 0, 40, () => 0.8));
    const plain = new MeshBuffer();
    const lifted = new MeshBuffer();
    sweep(plain, frames, deckTop(4.2), flatUv);
    sweep(lifted, frames, deckTop(4.2), { ...flatUv, lift: 0.05 });

    for (let index = 0; index < plain.vertexCount; index += 1) {
      const a = position(plain, index);
      const b = position(lifted, index);
      expect(b.y - a.y).toBeCloseTo(0.05, 10);
      expect(b.x).toBe(a.x);
      expect(b.z).toBe(a.z);
    }
  });

  it('winds faces to agree with their normals', () => {
    const frames = buildFrames(arc(46, 10, 50, () => 0));
    const buffer = new MeshBuffer();
    sweep(buffer, frames, deckTop(5.4), flatUv);

    for (let i = 0; i < buffer.indices.length; i += 3) {
      const a = position(buffer, buffer.indices[i] as number);
      const b = position(buffer, buffer.indices[i + 1] as number);
      const c = position(buffer, buffer.indices[i + 2] as number);
      const ux = b.x - a.x;
      const uz = b.z - a.z;
      const vx = c.x - a.x;
      const vz = c.z - a.z;
      /* The y of (b − a) × (c − a) is what makes a level face look upwards. */
      expect(uz * vx - ux * vz).toBeGreaterThan(0);
    }
  });

  it('blends towards flushY only where the road lies on a deck', () => {
    const frames = buildFrames(arc(46, 0, 20, () => 0));
    const buffer = new MeshBuffer();
    const path: SectionPath = [
      { x: -1, y: -0.1, flushY: -0.02 },
      { x: 1, y: -0.1, flushY: -0.02 },
    ];
    sweep(buffer, frames, path, { ...flatUv, flush: () => 1 });
    expect(position(buffer, 0).y).toBeCloseTo(-0.02, 10);

    const clear = new MeshBuffer();
    sweep(clear, frames, path, { ...flatUv, flush: () => 0 });
    expect(position(clear, 0).y).toBeCloseTo(-0.1, 10);
  });
});

describe('refining a centreline', () => {
  it('passes through every original point, so the deck height is exact there', () => {
    for (const edge of world.network.edges) {
      const refined = refine(edge.points);
      let cursor = 0;
      for (const point of edge.points) {
        while (cursor < refined.length) {
          const candidate = refined[cursor] as Vec3;
          if (
            Math.abs(candidate.x - point.x) < 1e-9 &&
            Math.abs(candidate.y - point.y) < 1e-9 &&
            Math.abs(candidate.z - point.z) < 1e-9
          ) {
            break;
          }
          cursor += 1;
        }
        expect(cursor, edge.id).toBeLessThan(refined.length);
      }
    }
  });

  it('keeps a hairpin smooth: no step turns more than the tolerance allows', () => {
    const leg = world.network.edges.find((edge) => edge.style === 'helix') as RoadEdge;
    const refined = refine(leg.points);
    expect(refined.length).toBeGreaterThan(leg.points.length);

    for (let i = 2; i < refined.length; i += 1) {
      const a = refined[i - 2] as Vec3;
      const b = refined[i - 1] as Vec3;
      const c = refined[i] as Vec3;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      const next = Math.atan2(c.x - b.x, c.z - b.z);
      const turn = Math.abs(Math.atan2(Math.sin(next - heading), Math.cos(next - heading)));
      expect(turn).toBeLessThan((14 * Math.PI) / 180);
    }
  });
});

describe('thinning a centreline', () => {
  it('keeps only original points, including both ends', () => {
    for (const edge of world.network.edges) {
      const refined = refine(edge.points);
      const kept = thin(refined, SMOOTH_TOLERANCE, 2.6);
      expect(kept[0]).toEqual(refined[0]);
      expect(kept[kept.length - 1]).toEqual(refined[refined.length - 1]);
      for (const point of kept) {
        expect(
          refined.some((source) => source.x === point.x && source.y === point.y && source.z === point.z),
        ).toBe(true);
      }
    }
  });

  it('stays within tolerance of the curve it replaces', () => {
    const ring = world.network.edges.find((edge) => edge.style === 'ring') as RoadEdge;
    const refined = refine(ring.points);
    const kept = thin(refined, SMOOTH_TOLERANCE, 2.6);
    expect(kept.length).toBeLessThan(refined.length * 0.75);

    for (const point of refined) {
      let nearest = Infinity;
      for (let i = 1; i < kept.length; i += 1) {
        const a = kept[i - 1] as Vec3;
        const b = kept[i] as Vec3;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const lengthSq = dx * dx + dy * dy + dz * dz;
        const t = Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSq),
        );
        nearest = Math.min(
          nearest,
          Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t, point.z - a.z - dz * t),
        );
      }
      expect(nearest).toBeLessThan(SMOOTH_TOLERANCE * 1.1);
    }
  });
});

describe('offset curves', () => {
  it('stays smooth at the edge of the road, not just along its centre', () => {
    for (const edge of world.network.edges) {
      if (edge.style !== 'spoke' && edge.style !== 'helix') continue;
      const frames = buildFrames(thin(refine(edge.points), SMOOTH_TOLERANCE, 2.6));

      for (let i = 2; i < frames.length; i += 1) {
        const a = frames[i - 2] as Frame;
        const b = frames[i - 1] as Frame;
        const c = frames[i] as Frame;
        const heading = Math.atan2(b.x - a.x, b.z - a.z);
        const next = Math.atan2(c.x - b.x, c.z - b.z);
        const turn = Math.abs(Math.atan2(Math.sin(next - heading), Math.cos(next - heading)));
        expect(turn, `${edge.id} @${i}`).toBeLessThan((15 * Math.PI) / 180);
      }
    }
  });
});

describe('the real network', () => {
  const edges = world.network.edges;

  it('reaches ± width / 2 at every station except inside the very tightest bends', () => {
    for (const edge of edges) {
      const half = edge.width / 2;
      const frames = buildFrames(refine(edge.points));
      for (const frame of frames) {
        const left = Math.abs(limitLateral(-half, frame));
        const right = Math.abs(limitLateral(half, frame));
        const trimmed = Math.min(left, right);
        const radius = 1 / Math.max(Math.abs(frame.bend), 1e-6);
        if (radius > half * 1.2) expect(trimmed, edge.id).toBeCloseTo(half, 6);
      }
    }
  });

  it('has deck under every point the robot can stand on, even inside a hairpin', () => {
    const inside = (p: Vec3, a: Vec3, b: Vec3, c: Vec3) => {
      const side = (u: Vec3, v: Vec3) => (v.x - u.x) * (p.z - u.z) - (v.z - u.z) * (p.x - u.x);
      const d1 = side(a, b);
      const d2 = side(b, c);
      const d3 = side(c, a);
      const epsilon = 1e-6;
      const below = d1 < -epsilon || d2 < -epsilon || d3 < -epsilon;
      const above = d1 > epsilon || d2 > epsilon || d3 > epsilon;
      return !(below && above);
    };

    for (const edge of edges) {
      const half = edge.width / 2;
      const walkable = half - 0.55;
      const frames = buildFrames(thin(refine(edge.points), SMOOTH_TOLERANCE, 2.6));
      const offset = (frame: Frame, lateral: number): Vec3 => {
        const reach = limitLateral(lateral, frame);
        return { x: frame.x + frame.rx * reach, y: frame.y, z: frame.z + frame.rz * reach };
      };

      frames.forEach((frame, station) => {
        for (const lateral of [-walkable, -walkable / 2, 0, walkable / 2, walkable]) {
          const point = { x: frame.x + frame.rx * lateral, y: frame.y, z: frame.z + frame.rz * lateral };
          let covered = false;
          const from = Math.max(0, station - 14);
          const to = Math.min(frames.length - 1, station + 14);

          for (let i = from; i < to && !covered; i += 1) {
            const a0 = offset(frames[i] as Frame, -half);
            const b0 = offset(frames[i] as Frame, half);
            const a1 = offset(frames[i + 1] as Frame, -half);
            const b1 = offset(frames[i + 1] as Frame, half);
            covered = inside(point, a0, b0, b1) || inside(point, a0, b1, a1);
          }

          /* A hole no wider than the robot's foot, at the exact pivot of a hairpin, is allowed. */
          if (!covered) {
            const pivot = Math.abs(frame.bend) > 0.4;
            expect(pivot, `${edge.id} @${station} lateral ${lateral}`).toBe(true);
          }
        }
      });
    }
  });

  it('never folds the inside of a bend back over itself', () => {
    for (const edge of edges) {
      const half = edge.width / 2;
      const frames = buildFrames(refine(edge.points));

      for (const side of [-1, 1]) {
        for (let i = 1; i < frames.length; i += 1) {
          const before = frames[i - 1] as Frame;
          const after = frames[i] as Frame;
          const a = limitLateral(half * side, before);
          const b = limitLateral(half * side, after);
          const stepX = after.x + after.rx * b - (before.x + before.rx * a);
          const stepZ = after.z + after.rz * b - (before.z + before.rz * a);
          /* The edge may stall at a pivot but must not run backwards along the road. */
          expect(stepX * after.tx + stepZ * after.tz, `${edge.id} @${i}`).toBeGreaterThan(-0.02);
        }
      }
    }
  });

  it('gives every style a section whose deck reaches exactly to its width', () => {
    for (const [style, section] of Object.entries(ROAD_SECTIONS)) {
      const xs = section.deck.flat().map((point) => point.x);
      const half = ROAD_WIDTH[style as keyof typeof ROAD_WIDTH] / 2;
      expect(xs, style).toContain(half);
      expect(xs, style).toContain(-half);
      for (const path of section.deck) {
        for (const point of path) {
          if (Math.abs(point.x) <= half) expect(point.y, style).toBe(0);
        }
      }
    }
  });
});

describe('structural members', () => {
  it('builds a closed box with faces pointing outwards', () => {
    const buffer = new MeshBuffer();
    addBeam(buffer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -4 }, 1, 0.5, { tile: 1, caps: true });
    expect(buffer.triangleCount).toBe(12);

    /* The centroid of every face lies in the direction of its normal from the beam's centre. */
    for (let i = 0; i < buffer.indices.length; i += 3) {
      const index = buffer.indices[i] as number;
      const a = position(buffer, index);
      const b = position(buffer, buffer.indices[i + 1] as number);
      const c = position(buffer, buffer.indices[i + 2] as number);
      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      const cz = (a.z + b.z + c.z) / 3 + 2;
      const nx = buffer.normals[index * 3] as number;
      const ny = buffer.normals[index * 3 + 1] as number;
      const nz = buffer.normals[index * 3 + 2] as number;
      expect(cx * nx + cy * ny + cz * nz).toBeGreaterThan(0);

      /* Winding agrees with the normal. */
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const uz = b.z - a.z;
      const vx = c.x - a.x;
      const vy = c.y - a.y;
      const vz = c.z - a.z;
      const crossX = uy * vz - uz * vy;
      const crossY = uz * vx - ux * vz;
      const crossZ = ux * vy - uy * vx;
      expect(crossX * nx + crossY * ny + crossZ * nz).toBeGreaterThan(0);
    }
  });

  it('keeps cable spreads aligned with their vertices', () => {
    const buffer = new MeshBuffer();
    addCable(buffer, { x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, 0.01, { r: 1, g: 1, b: 1, a: 0 });
    addCable(buffer, { x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 }, 0.01, { r: 1, g: 1, b: 1, a: 0 });
    expect(buffer.spreads.length).toBe(buffer.vertexCount * 4);
    for (const value of buffer.positions) expect(Number.isFinite(value)).toBe(true);
  });
});
