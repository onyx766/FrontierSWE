import { describe, expect, it } from 'vitest';
import type { RoadEdge } from '../../../world/network';
import { world } from '../../../world/world';
import {
  assistAlongRoad,
  cameraRelative,
  chainRoads,
  combineSticks,
  damp,
  dampAngle,
  readRoad,
  updateRoadTrack,
  type Flat,
  type RoadReading,
  type RoadTrack,
  type Stick,
} from '../steering';

const stick = (): Stick => ({ x: 0, y: 0, magnitude: 0 });
const flat = (): Flat => ({ x: 0, z: 0 });
const reading = (): RoadReading => ({ hereX: 0, hereZ: 0, aheadX: 0, aheadZ: 0, offset: 0 });

describe('damping', () => {
  it('gets to the same place at any frame rate', () => {
    const run = (dt: number) => {
      let value = 0;
      for (let t = 0; t < 1 - 1e-9; t += dt) value = damp(value, 10, 4, dt);
      return value;
    };
    expect(run(1 / 120)).toBeCloseTo(run(1 / 20), 6);
  });

  it('goes the short way round an angle', () => {
    const start = 3;
    const target = -3;
    const next = dampAngle(start, target, 10, 1 / 60);
    expect(next).toBeGreaterThan(start);
  });
});

describe('combining the keyboard and the joystick', () => {
  it('keeps a diagonal at unit length', () => {
    const out = combineSticks(1, 1, 0, 0, stick());
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
    expect(out.magnitude).toBe(1);
  });

  it('keeps a part-pushed joystick part-pushed', () => {
    const out = combineSticks(0, 0, 0, 0.4, stick());
    expect(out.y).toBeCloseTo(0.4);
    expect(out.magnitude).toBeCloseTo(0.4);
  });

  it('adds the two together without exceeding one', () => {
    const out = combineSticks(1, 0, 1, 0, stick());
    expect(out.x).toBeCloseTo(1);
    expect(out.magnitude).toBe(1);
  });
});

describe('camera-relative input', () => {
  it('with the camera south, forward is north and right is east', () => {
    const forward = cameraRelative(0, 1, 0, flat());
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(-1);

    const right = cameraRelative(1, 0, 0, flat());
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('with the camera north, forward is south and right is west', () => {
    const forward = cameraRelative(0, 1, Math.PI, flat());
    expect(forward.x).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(1);

    const right = cameraRelative(1, 0, Math.PI, flat());
    expect(right.x).toBeCloseTo(-1);
    expect(right.z).toBeCloseTo(0);
  });

  it('with the camera east, forward is west', () => {
    const forward = cameraRelative(0, 1, Math.PI / 2, flat());
    expect(forward.x).toBeCloseTo(-1);
    expect(forward.z).toBeCloseTo(0);
  });
});

describe('road tracking', () => {
  const ring = world.network.edges.find((edge) => edge.style === 'ring') as RoadEdge;
  const spoke = world.network.edges.find((edge) => edge.style === 'spoke') as RoadEdge;
  const chains = chainRoads(world.network.edges);

  it('finds the nearest centreline point', () => {
    const point = ring.points[20] as { x: number; z: number };
    const track = updateRoadTrack({ edge: null, index: 0 }, ring, point.x, point.z, chains);
    expect(track.edge).toBe(ring);
    expect(track.index).toBe(20);
  });

  it('stays on the road it is on when the surface reports an overlapping one', () => {
    const point = ring.points[20] as { x: number; z: number };
    const track: RoadTrack = { edge: ring, index: 20 };
    updateRoadTrack(track, spoke, point.x, point.z, chains);
    expect(track.edge).toBe(ring);
  });

  it('keeps the road across a stretch of island deck, where the surface reports none', () => {
    const point = ring.points[3] as { x: number; z: number };
    const track: RoadTrack = { edge: ring, index: 3 };
    updateRoadTrack(track, null, point.x, point.z, chains);
    expect(track.edge).toBe(ring);
  });

  it('passes from one edge of the Ring to the next, not to a road that meets there', () => {
    const last = ring.points.length - 1;
    const end = ring.points[last] as { x: number; z: number };
    const before = ring.points[last - 1] as { x: number; z: number };
    /* Past the end of the edge by more than half the road's width. */
    const x = end.x + (end.x - before.x) * 3.2;
    const z = end.z + (end.z - before.z) * 3.2;

    const track: RoadTrack = { edge: ring, index: last };
    updateRoadTrack(track, spoke, x, z, chains);
    expect(track.edge?.style).toBe('ring');
    expect(track.edge).not.toBe(ring);
  });

  it('chains the closed roads and leaves the others open', () => {
    for (const edge of world.network.edges) {
      const ends = chains.get(edge);
      if (edge.style === 'ring' || edge.style === 'coreLoop') {
        expect(ends?.first?.style).toBe(edge.style);
        expect(ends?.last?.style).toBe(edge.style);
      }
      if (edge.style === 'spoke') {
        expect(ends?.first).toBeNull();
        expect(ends?.last).toBeNull();
      }
    }
  });

  it('moves to the reported road once it has really left its own', () => {
    const point = spoke.points[spoke.points.length >> 1] as { x: number; z: number };
    const track: RoadTrack = { edge: ring, index: 20 };
    updateRoadTrack(track, spoke, point.x, point.z, chains);
    expect(track.edge).toBe(spoke);
  });

  it('forgets the road once well away from it on a deck', () => {
    const track: RoadTrack = { edge: ring, index: 20 };
    updateRoadTrack(track, null, 0, 0, chains);
    expect(track.edge).toBeNull();
  });
});

describe('reading the road', () => {
  const ring = world.network.edges.find((edge) => edge.style === 'ring') as RoadEdge;

  it('reports nothing on a deck', () => {
    expect(readRoad({ edge: null, index: 0 }, 0, 0, 1, 0, 3, reading())).toBe(false);
  });

  it('picks the direction of the road nearest to the wish', () => {
    const point = ring.points[20] as { x: number; z: number };
    const next = ring.points[21] as { x: number; z: number };
    const dx = next.x - point.x;
    const dz = next.z - point.z;

    const along = reading();
    readRoad({ edge: ring, index: 20 }, point.x, point.z, dx, dz, 3, along);
    expect(along.hereX * dx + along.hereZ * dz).toBeGreaterThan(0);

    const against = reading();
    readRoad({ edge: ring, index: 20 }, point.x, point.z, -dx, -dz, 3, against);
    expect(against.hereX * dx + against.hereZ * dz).toBeLessThan(0);
  });

  it('measures the offset from the centreline', () => {
    const point = ring.points[20] as { x: number; z: number };
    const road = reading();
    readRoad({ edge: ring, index: 20 }, point.x, point.z, 1, 0, 3, road);
    expect(road.offset).toBeCloseTo(0);

    /* One unit to the right of the direction of travel. */
    const rightX = -road.hereZ;
    const rightZ = road.hereX;
    readRoad({ edge: ring, index: 20 }, point.x + rightX, point.z + rightZ, 1, 0, 3, road);
    expect(road.offset).toBeCloseTo(1, 1);
  });
});

describe('road assist', () => {
  const road: RoadReading = { hereX: 0, hereZ: -1, aheadX: 0.5, aheadZ: -Math.sqrt(0.75), offset: 0 };

  it('turns a wish along the road towards the road ahead', () => {
    const out = assistAlongRoad(0, -1, road, flat());
    expect(out.x).toBeGreaterThan(0.3);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1);
  });

  it('leaves a wish across the road alone, so the visitor can step off', () => {
    const out = assistAlongRoad(1, 0, road, flat());
    expect(out.x).toBeCloseTo(1);
    expect(out.z).toBeCloseTo(0);
  });

  it('steers back towards the centreline', () => {
    const straight: RoadReading = { hereX: 0, hereZ: -1, aheadX: 0, aheadZ: -1, offset: 2 };
    const out = assistAlongRoad(0, -1, straight, flat());
    /* Heading north with the centreline to the left, which is west. */
    expect(out.x).toBeLessThan(0);
  });
});
