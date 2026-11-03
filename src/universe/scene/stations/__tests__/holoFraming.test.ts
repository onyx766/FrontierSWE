import { describe, expect, it } from 'vitest';
import { world } from '../../../world/world';
import type { StationAnchor } from '../../../world/stations';
import type { Vec3 } from '../../../world/vec';
import { STATION_VIEW } from '../../actor/rig';
import { holoScale, narrowFit, PANEL } from '../holoLayout';

/**
 * The hologram has to be readable from the station camera, so its position, its
 * size and the camera are held together here. This is a pinhole projection using
 * the actor's own station lens, so that changing either side fails this test
 * rather than quietly putting the display out of frame.
 */

const ASPECT = 1672 / 941;
/** Where the 420 px briefing panel begins, as a fraction of a 1672 px frame. */
const PANEL_EDGE = 0.75;
/** Top of the robot's head above its feet. */
const ROBOT_HEIGHT = 2.05;

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}

interface Lens {
  aspect: number;
  shiftX: number;
  shiftY: number;
}

const WIDE: Lens = { aspect: ASPECT, shiftX: STATION_VIEW.shiftX, shiftY: 0 };
const PHONE: Lens = { aspect: 390 / 844, shiftX: 0, shiftY: STATION_VIEW.narrowShiftY };

function stationProjector(anchor: StationAnchor, { aspect, shiftX, shiftY }: Lens = WIDE) {
  const forward = normalize(sub(anchor.cameraTarget, anchor.cameraPosition));
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  const tangent = Math.tan((STATION_VIEW.fov * Math.PI) / 360);

  return (point: Vec3) => {
    const offset = sub(point, anchor.cameraPosition);
    const depth = dot(offset, forward);
    return {
      u: 0.5 + dot(offset, right) / (depth * tangent * aspect) / 2 + shiftX,
      v: 0.5 - dot(offset, up) / (depth * tangent) / 2 - shiftY,
    };
  };
}

function panelCorners(anchor: StationAnchor, fit = 1): Vec3[] {
  const scale = holoScale(anchor) * fit;
  const halfWidth = (PANEL.widthWithModel * scale) / 2;
  const halfHeight = (PANEL.height * scale) / 2;
  const right = { x: Math.cos(anchor.holoYaw), y: 0, z: -Math.sin(anchor.holoYaw) };

  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([side = 0, level = 0]) => ({
    x: anchor.holo.x + right.x * side * halfWidth,
    y: anchor.holo.y + level * halfHeight,
    z: anchor.holo.z + right.z * side * halfWidth,
  }));
}

describe('the hologram seen from the station camera', () => {
  it('sits inside the frame, left of the briefing panel', () => {
    for (const anchor of world.stations) {
      const project = stationProjector(anchor);
      for (const corner of panelCorners(anchor).map(project)) {
        expect(corner.u, anchor.id).toBeGreaterThan(0);
        expect(corner.u, anchor.id).toBeLessThan(PANEL_EDGE);
        expect(corner.v, anchor.id).toBeGreaterThan(0);
        expect(corner.v, anchor.id).toBeLessThan(1);
      }
    }
  });

  it('clears the head of the robot standing on the pad', () => {
    for (const anchor of world.stations) {
      const project = stationProjector(anchor);
      const head = project({ ...anchor.pad, y: anchor.pad.y + ROBOT_HEIGHT });
      const lowestEdge = Math.max(...panelCorners(anchor).map((corner) => project(corner).v));
      expect(lowestEdge, anchor.id).toBeLessThan(head.v);
    }
  });

  it('fills enough of the frame to be read', () => {
    for (const anchor of world.stations) {
      const project = stationProjector(anchor);
      const corners = panelCorners(anchor).map(project);
      const rows = corners.map((corner) => corner.v);
      expect(Math.max(...rows) - Math.min(...rows), anchor.id).toBeGreaterThan(0.45);
    }
  });

  it('stays clear of the deck', () => {
    for (const anchor of world.stations) {
      const lowest = Math.min(...panelCorners(anchor).map((corner) => corner.y));
      expect(lowest, anchor.id).toBeGreaterThan(anchor.pad.y + 1);
    }
  });
});

describe('the hologram on a phone', () => {
  it('stays whole inside a portrait frame', () => {
    for (const anchor of world.stations) {
      const project = stationProjector(anchor, PHONE);
      for (const corner of panelCorners(anchor, narrowFit(PHONE.aspect)).map(project)) {
        expect(corner.u, anchor.id).toBeGreaterThan(0);
        expect(corner.u, anchor.id).toBeLessThan(1);
        expect(corner.v, anchor.id).toBeGreaterThan(0);
      }
    }
  });

  it('does not shrink on any screen at least as wide as a tablet', () => {
    expect(narrowFit(ASPECT)).toBe(1);
    expect(narrowFit(4 / 3)).toBe(1);
  });
});

describe('every station', () => {
  it('shows the camera the front of the hologram, so that its text is not mirrored', () => {
    for (const anchor of world.stations) {
      const front = { x: Math.sin(anchor.holoYaw), y: 0, z: Math.cos(anchor.holoYaw) };
      const toCamera = normalize(sub(anchor.cameraPosition, anchor.holo));
      expect(dot(front, toCamera), anchor.id).toBeGreaterThan(0.85);
    }
  });

  it('turns the front of the hologram back towards the pad', () => {
    for (const anchor of world.stations) {
      const front = { x: Math.sin(anchor.holoYaw), y: 0, z: Math.cos(anchor.holoYaw) };
      const toPad = normalize({ ...sub(anchor.pad, anchor.holo), y: 0 });
      expect(dot(front, toPad), anchor.id).toBeCloseTo(1, 6);
    }
  });

  it('frames every stop the same way round: robot on the left, hologram to its right', () => {
    for (const anchor of world.stations) {
      const project = stationProjector(anchor);
      const robot = project({ ...anchor.pad, y: anchor.pad.y + 1.2 });
      const panel = project(anchor.holo);
      expect(robot.u, anchor.id).toBeLessThan(panel.u);
    }
  });
});
