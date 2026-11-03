import { describe, expect, it } from 'vitest';
import { getProject } from '@/data/projects';
import { islands } from '@/data/universe';
import { islandCenter } from '../../world/network';
import { world } from '../../world/world';
import { islandAt, stationCount, stationGroups, stationHref } from '../stations';

describe('stationGroups', () => {
  it('lists every station in the world exactly once', () => {
    const listed = stationGroups.flatMap((group) => group.stations.map((station) => station.id));
    expect(listed).toHaveLength(stationCount);
    expect(new Set(listed)).toEqual(new Set(world.stations.map((station) => station.id)));
  });
});

describe('stationHref', () => {
  it('sends a project station to the projects section', () => {
    for (const station of world.stations) {
      const { subject } = station.content;
      if (subject.type !== 'project') continue;
      expect(getProject(subject.slug)).toBeDefined();
      expect(stationHref(station.content)).toBe('/#projects');
    }
  });

  it('gives every station a site path', () => {
    for (const station of world.stations) {
      expect(stationHref(station.content)).toMatch(/^\/#[a-z]/);
    }
  });
});

describe('islandAt', () => {
  it('finds the island under the middle of its deck', () => {
    for (const island of islands) {
      expect(islandAt(islandCenter(island))?.id).toBe(island.id);
    }
  });

  it('finds nothing on the roads around the crystal', () => {
    expect(islandAt({ x: 0, z: 25 })).toBeNull();
  });
});
