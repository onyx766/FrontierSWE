import { beforeEach, describe, expect, it } from 'vitest';
import { projects } from '@/data/projects';
import { projectStationId, WORLD_AT_PARAM, worldHref } from '@/data/universe';
import { world } from '../../world/world';
import { knownStation, placeRobotAtStation, requestedStation } from '../arrival';
import { runtime } from '../runtime';
import { useUniverse } from '../store';

describe('links from the portfolio into the world', () => {
  it('maps a project with a station to that station, and others to nothing', () => {
    const stationIds = new Set(world.stations.map((station) => station.id));
    for (const project of projects) {
      const id = projectStationId(project.slug);
      if (id !== null) expect(stationIds.has(id)).toBe(true);
    }
    expect(projectStationId('no-such-project')).toBeNull();
  });

  it('gives every project station a working deep link', () => {
    const projectStations = world.stations.filter(
      (station) => station.content.subject.type === 'project',
    );
    expect(projectStations.length).toBeGreaterThan(0);
    for (const station of projectStations) {
      const href = worldHref(station.id);
      const search = href.slice(href.indexOf('?'));
      expect(requestedStation(search, WORLD_AT_PARAM)).toBe(station.id);
    }
  });

  it('links to the opening shot without a station', () => {
    expect(worldHref()).toBe('/world');
    expect(worldHref(null)).toBe('/world');
  });

  it('ignores unknown or missing stations', () => {
    expect(requestedStation('', WORLD_AT_PARAM)).toBeNull();
    expect(requestedStation('?at=', WORLD_AT_PARAM)).toBeNull();
    expect(requestedStation('?at=nope', WORLD_AT_PARAM)).toBeNull();
    expect(requestedStation('?other=welcome', WORLD_AT_PARAM)).toBeNull();
    expect(knownStation(null)).toBeNull();
    expect(knownStation('welcome')).toBe('welcome');
  });
});

describe('arriving at a station from a link', () => {
  beforeEach(() => {
    useUniverse.setState({
      phase: 'overview',
      near: null,
      active: null,
      beat: 3,
      travel: 'welcome',
      touring: true,
      visited: [],
    });
  });

  it('stands the robot on the pad, on the walking surface, facing the hologram', () => {
    for (const station of world.stations) {
      placeRobotAtStation(station.id);
      const { robot } = runtime;
      expect(world.surface.contains(robot.x, robot.y, robot.z)).toBe(true);
      expect(robot.yaw).toBe(station.facing);
      expect(Math.hypot(robot.x - station.pad.x, robot.z - station.pad.z)).toBeLessThan(1e-9);
    }
  });

  it('opens the briefing in explore mode and records the visit', () => {
    const id = 'saas-platform-core';
    useUniverse.getState().arriveAt(id);
    const state = useUniverse.getState();
    expect(state.phase).toBe('explore');
    expect(state.near).toBe(id);
    expect(state.active).toBe(id);
    expect(state.beat).toBe(0);
    expect(state.travel).toBeNull();
    expect(state.touring).toBe(false);
    expect(state.visited).toContain(id);
  });

  it('waits for the scene', () => {
    useUniverse.setState({ phase: 'loading' });
    useUniverse.getState().arriveAt('saas-platform-core');
    expect(useUniverse.getState().active).toBeNull();
  });
});
