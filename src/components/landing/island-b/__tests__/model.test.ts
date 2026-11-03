import { describe, expect, it } from 'vitest';
import {
  pointRectDistance,
  rectCorners,
  rectMaxRadius,
  rectMinRadius,
  rectsOverlap,
  type Rect,
} from '../geometry';
import {
  ISLAND_SEED,
  LANE_RADII,
  PLAZA_RADIUS,
  RIM_SEGMENTS,
  ROAD_INNER,
  ROAD_OUTER,
  ROCK_TIP_Y,
  createIslandModel,
  rimRadiusAt,
  type IslandModel,
} from '../model';

const SEEDS = [ISLAND_SEED, 1, 42, 2024, 99_991];

function allBuildings(model: IslandModel) {
  return [model.tower, ...model.buildings];
}

describe('island model', () => {
  it('is deterministic for a seed', () => {
    const a = createIslandModel(ISLAND_SEED);
    const b = createIslandModel(ISLAND_SEED);
    expect(a).toEqual(b);
    expect(createIslandModel(ISLAND_SEED + 1).buildings).not.toEqual(a.buildings);
  });

  it.each(SEEDS)('keeps the city within its budget (seed %i)', (seed) => {
    const model = createIslandModel(seed);
    const inner = model.buildings.filter((b) => b.zone === 'inner');
    const outer = model.buildings.filter((b) => b.zone === 'outer');
    expect(inner.length).toBeGreaterThanOrEqual(20);
    expect(inner.length).toBeLessThanOrEqual(35);
    expect(outer.length).toBeGreaterThanOrEqual(10);
    expect(outer.length).toBeLessThanOrEqual(18);
    expect(model.trees.length).toBeGreaterThanOrEqual(40);
    expect(model.trees.length).toBeLessThanOrEqual(80);
    expect(model.cars.length).toBeGreaterThanOrEqual(8);
    expect(model.cars.length).toBeLessThanOrEqual(14);
    expect(model.waterfalls.length).toBeGreaterThanOrEqual(2);
    expect(model.waterfalls.length).toBeLessThanOrEqual(3);
    expect(model.rim).toHaveLength(RIM_SEGMENTS);
  });

  it.each(SEEDS)('puts every building on the disk and off the ring road (seed %i)', (seed) => {
    const model = createIslandModel(seed);
    for (const b of allBuildings(model)) {
      for (const [x, z] of rectCorners(b)) {
        expect(Math.hypot(x, z)).toBeLessThan(rimRadiusAt(model.rim, Math.atan2(z, x)));
      }
      if (b.zone === 'outer') expect(rectMinRadius(b)).toBeGreaterThan(ROAD_OUTER);
      else expect(rectMaxRadius(b)).toBeLessThan(ROAD_INNER);
      if (b.zone === 'inner') expect(rectMinRadius(b)).toBeGreaterThan(PLAZA_RADIUS);
      // Upper tiers sit inside the footprint and stack without gaps.
      b.tiers.forEach((tier, i) => {
        expect(tier.hw).toBeLessThanOrEqual(b.hw + 1e-9);
        expect(tier.hd).toBeLessThanOrEqual(b.hd + 1e-9);
        expect(tier.y1).toBeGreaterThan(tier.y0);
        if (i > 0) expect(tier.y0).toBeCloseTo(b.tiers[i - 1]?.y1 ?? -1, 9);
      });
    }
  });

  it.each(SEEDS)('never overlaps two buildings (seed %i)', (seed) => {
    const list: Rect[] = allBuildings(createIslandModel(seed));
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        expect(rectsOverlap(list[i] as Rect, list[j] as Rect)).toBe(false);
      }
    }
  });

  it.each(SEEDS)('plants trees on open ground (seed %i)', (seed) => {
    const model = createIslandModel(seed);
    for (const tree of model.trees) {
      const r = Math.hypot(tree.x, tree.z);
      expect(r).toBeLessThan(rimRadiusAt(model.rim, Math.atan2(tree.z, tree.x)));
      expect(r < ROAD_INNER || r > ROAD_OUTER).toBe(true);
      for (const b of allBuildings(model)) expect(pointRectDistance(tree.x, tree.z, b)).toBeGreaterThan(0);
    }
  });

  it('drives every car in a real lane', () => {
    for (const car of createIslandModel(ISLAND_SEED).cars) {
      expect(LANE_RADII[car.lane]).toBeDefined();
      expect(Math.abs(car.speed)).toBeGreaterThan(0);
    }
  });

  it('gives each drifting fragment a valid mesh, clear of the island', () => {
    const { fragments } = createIslandModel(ISLAND_SEED);
    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      expect(fragment.radius).toBeGreaterThan(1);
      expect(fragment.y).toBeLessThan(0);
      const vertexCount = fragment.positions.length / 3;
      for (const index of fragment.triangles) expect(index).toBeLessThan(vertexCount);
      for (let t = 0; t < fragment.normals.length / 3; t += 1) {
        const n = fragment.normals.subarray(t * 3, t * 3 + 3);
        expect(Math.hypot(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0)).toBeCloseTo(1, 5);
      }
    }
  });

  it('builds a closed rock mesh that meets the rim and tapers to a tip', () => {
    const { rock, rim } = createIslandModel(ISLAND_SEED);
    const vertexCount = rock.positions.length / 3;
    for (const index of rock.triangles) expect(index).toBeLessThan(vertexCount);
    expect(rock.positions[(vertexCount - 1) * 3 + 1]).toBeCloseTo(ROCK_TIP_Y, 6);
    for (let j = 0; j < rock.segments; j += 1) {
      const x = rock.positions[j * 3] as number;
      const z = rock.positions[j * 3 + 2] as number;
      expect(Math.hypot(x, z)).toBeCloseTo(rim[j] as number, 5);
    }
    for (let t = 0; t < rock.normals.length / 3; t += 1) {
      const nx = rock.normals[t * 3] as number;
      const ny = rock.normals[t * 3 + 1] as number;
      const nz = rock.normals[t * 3 + 2] as number;
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
    }
  });
});
