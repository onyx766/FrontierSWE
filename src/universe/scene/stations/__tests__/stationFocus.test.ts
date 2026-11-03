import { describe, expect, it } from 'vitest';
import { world } from '../../../world/world';
import { beaconStation, BEACON_RANGE, shownStation } from '../stationFocus';

const walking = {
  active: null,
  near: null,
  dismissed: false,
  travel: null,
  phase: 'explore' as const,
};

describe('shownStation', () => {
  it('shows nothing while the robot is away from every pad', () => {
    expect(shownStation(walking)).toBeNull();
  });

  it('shows an open briefing whatever else is going on', () => {
    expect(shownStation({ ...walking, active: 'a', phase: 'overview' })).toBe('a');
  });

  it('shows the pad underfoot', () => {
    expect(shownStation({ ...walking, near: 'a' })).toBe('a');
  });

  it('leaves the opening shot clear, though the robot starts on a pad', () => {
    expect(shownStation({ ...walking, near: 'welcome', phase: 'overview' })).toBeNull();
  });

  it('does not flash up the start pad as the visitor first steps off it', () => {
    expect(shownStation({ ...walking, near: 'welcome', dismissed: true })).toBeNull();
  });

  it('stays down after the visitor presses Esc', () => {
    expect(shownStation({ ...walking, near: 'a', dismissed: true })).toBeNull();
  });

  it('does not flicker over a pad the autopilot is only crossing', () => {
    expect(shownStation({ ...walking, near: 'a', travel: 'b' })).toBeNull();
  });
});

describe('beaconStation', () => {
  const { stations } = world;
  const anchor = world.station('xdial');
  const beside = { x: anchor.pad.x + 6, y: anchor.pad.y, z: anchor.pad.z };
  /* Behind the robot, looking towards the pad. */
  const camera = { x: beside.x + 8, y: 4, z: beside.z };

  it('names the closest pad within reach', () => {
    expect(beaconStation(stations, beside, camera, null, walking)).toBe(anchor.id);
  });

  it('ignores a pad behind the robot, such as the one it just stepped off', () => {
    const facingAway = { x: beside.x - 8, y: 4, z: beside.z };
    expect(beaconStation(stations, beside, facingAway, null, walking)).toBeNull();
  });

  it('names nothing when every pad is out of reach', () => {
    const far = { x: 0, y: 0, z: 0 };
    expect(beaconStation(stations, far, camera, null, walking)).toBeNull();
    const edge = { x: anchor.pad.x + BEACON_RANGE * 2, y: 0, z: anchor.pad.z - 40 };
    expect(beaconStation(stations, edge, camera, null, walking)).toBeNull();
  });

  it('ignores a pad on another level', () => {
    const below = { ...beside, y: beside.y - 6 };
    expect(beaconStation(stations, below, camera, null, walking)).toBeNull();
  });

  it('names nothing once the robot stands on a pad', () => {
    const standing = { ...walking, near: anchor.id };
    expect(beaconStation(stations, anchor.pad, camera, null, standing)).toBeNull();
  });

  it('gives way to a hologram', () => {
    const briefed = { ...walking, active: 'welcome' };
    expect(beaconStation(stations, beside, camera, null, briefed)).toBeNull();
  });

  it('names a hovered pad, even at the opening shot', () => {
    const overview = { ...walking, phase: 'overview' as const };
    expect(beaconStation(stations, anchor.pad, camera, 'services', overview)).toBe('services');
  });

  it('does not name a pad merely for being close at the opening shot', () => {
    const overview = { ...walking, phase: 'overview' as const };
    expect(beaconStation(stations, beside, camera, null, overview)).toBeNull();
  });

  it('stays out of the way while the scene loads', () => {
    const loading = { ...walking, phase: 'loading' as const };
    expect(beaconStation(stations, beside, camera, 'services', loading)).toBeNull();
  });
});
