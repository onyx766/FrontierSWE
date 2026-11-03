import { describe, expect, it } from 'vitest';
import { ROAD_WIDTH, type RoadStyle } from '../../world/network';
import { world } from '../../world/world';
import { MAP_RADIUS, mapPercent, polylinePath, roadPaths } from '../mapGeometry';

describe('polylinePath', () => {
  it('moves to the first point, then draws lines, rounded to a tenth', () => {
    expect(
      polylinePath([
        { x: 1.23, z: -4.56 },
        { x: 7, z: 8.04 },
      ]),
    ).toBe('M1.2 -4.6L7 8');
  });
});

describe('roadPaths', () => {
  it('produces one path for every road family in the network', () => {
    const styles = roadPaths(world.network).map((road) => road.style);
    expect(new Set(styles)).toEqual(new Set(Object.keys(ROAD_WIDTH) as RoadStyle[]));
    expect(styles).toHaveLength(new Set(styles).size);
  });

  it('draws the Ring last, so it sits over everything that crosses it', () => {
    expect(roadPaths(world.network).at(-1)?.style).toBe('ring');
  });
});

describe('mapPercent', () => {
  it('puts the world centre in the middle of the map', () => {
    expect(mapPercent({ x: 0, z: 0 })).toEqual({ left: 50, top: 50 });
  });

  it('keeps north up and east right', () => {
    const north = mapPercent({ x: 0, z: -40 });
    const east = mapPercent({ x: 40, z: 0 });
    expect(north.top).toBeLessThan(50);
    expect(east.left).toBeGreaterThan(50);
  });

  it('fits every road and every station on the map', () => {
    expect(world.extent).toBeLessThan(MAP_RADIUS);
    for (const station of world.stations) {
      const { left, top } = mapPercent(station.pad);
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThan(100);
      expect(top).toBeGreaterThan(0);
      expect(top).toBeLessThan(100);
    }
  });
});
