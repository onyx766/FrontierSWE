import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { RobotState } from '../../../state/runtime';
import type { Phase } from '../../../state/store';
import { WORLD } from '../../../world/network';
import { DEG, polar, type Vec3 } from '../../../world/vec';
import { HERO_SHOT, START_STATION_ID, world } from '../../../world/world';
import { heroPosition, poseHeroCamera } from '../../heroCamera';
import { createMotion, Driver, type Motion } from '../driver';
import {
  boomReach,
  CHASE_VIEW,
  chaseAim,
  createPose,
  easeFlight,
  OVERVIEW_LIMITS,
  poseFromShot,
  positionOf,
  Rig,
  STATION_VIEW,
  type RigFrame,
} from '../rig';

const DT = 1 / 60;
const REFERENCE_ASPECT = 1672 / 941;

function makeFrame(overrides: Partial<RigFrame> = {}): RigFrame {
  const pad = world.station(START_STATION_ID).pad;
  const robot: RobotState = {
    x: pad.x,
    y: pad.y,
    z: pad.z,
    lift: 0,
    yaw: 0,
    speed: 0,
    road: null,
    roadTangentX: 0,
    roadTangentZ: 0,
  };
  return {
    phase: 'overview',
    station: null,
    aspect: REFERENCE_ASPECT,
    narrow: false,
    reducedMotion: false,
    robot,
    motion: { ...createMotion(), groundY: robot.y },
    steering: false,
    dragging: false,
    ...overrides,
  };
}

const makeRig = (frame: RigFrame) => new Rig(frame, world.surface, world.network.blockers);

function advance(rig: Rig, frame: RigFrame, seconds: number) {
  for (let step = 0; step < seconds * 60; step += 1) rig.update(frame, DT);
}

function setPhase(frame: RigFrame, phase: Phase) {
  frame.phase = phase;
}

describe('the opening shot', () => {
  it('is exactly the fitted hero camera when nothing has been pressed', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    advance(rig, frame, 3);

    const hero = heroPosition(REFERENCE_ASPECT);
    expect(rig.camera.x).toBeCloseTo(hero.x, 9);
    expect(rig.camera.y).toBeCloseTo(hero.y, 9);
    expect(rig.camera.z).toBeCloseTo(hero.z, 9);
    expect(rig.pose.fov).toBe(HERO_SHOT.fov);
    expect(rig.pose.shiftX).toBe(HERO_SHOT.shiftX);
    expect(rig.pose.shiftY).toBe(HERO_SHOT.shiftY);
  });

  it('produces the same projection as poseHeroCamera, so the pixels match', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);

    const reference = new THREE.PerspectiveCamera(HERO_SHOT.fov, REFERENCE_ASPECT, 0.5, 9000);
    poseHeroCamera(reference, 1672, 941);

    const camera = new THREE.PerspectiveCamera(rig.pose.fov, REFERENCE_ASPECT, 0.5, 9000);
    camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
    camera.lookAt(rig.pose.x, rig.pose.y, rig.pose.z);
    camera.updateMatrixWorld(true);
    camera.setViewOffset(
      1672,
      941,
      -rig.pose.shiftX * 1672,
      rig.pose.shiftY * 941,
      1672,
      941,
    );

    const point = polar(WORLD.ringRadius, 75, 1);
    const a = new THREE.Vector3(point.x, point.y, point.z).project(reference);
    const b = new THREE.Vector3(point.x, point.y, point.z).project(camera);
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
  });

  it('backs off on a narrow screen by the same fit as the hero camera', () => {
    const frame = makeFrame({ aspect: 0.5 });
    const rig = makeRig(frame);
    const hero = heroPosition(0.5);
    expect(rig.camera.z).toBeCloseTo(hero.z, 9);
  });
});

describe('orbiting the overview', () => {
  it('turns with a drag and keeps the limits on elevation', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);

    rig.drag(200, 0);
    advance(rig, frame, 2);
    expect(rig.pose.azimuth).toBeLessThan(-0.5);

    rig.drag(0, 100000);
    advance(rig, frame, 2);
    expect(rig.pose.elevation).toBeCloseTo(OVERVIEW_LIMITS.maxElevation, 3);

    rig.drag(0, -100000);
    advance(rig, frame, 2);
    expect(rig.pose.elevation).toBeCloseTo(OVERVIEW_LIMITS.minElevation, 3);
  });

  it('zooms only between its limits', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);

    rig.zoom(0.001);
    advance(rig, frame, 2);
    expect(rig.pose.distance).toBeCloseTo(HERO_SHOT.distance * OVERVIEW_LIMITS.minZoom, 2);

    rig.zoom(1000);
    advance(rig, frame, 2);
    expect(rig.pose.distance).toBeCloseTo(HERO_SHOT.distance * OVERVIEW_LIMITS.maxZoom, 2);
  });

  it('does not drift back to the opening shot by itself', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    rig.drag(200, 40);
    advance(rig, frame, 2);
    const azimuth = rig.pose.azimuth;
    advance(rig, frame, 5);
    expect(rig.pose.azimuth).toBeCloseTo(azimuth, 3);
  });

  it('returns exactly to the opening shot when overview is asked for afresh', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    rig.drag(300, 80);
    rig.zoom(0.6);
    advance(rig, frame, 2);

    rig.recenter(false);
    advance(rig, frame, 1.3);

    const hero = heroPosition(REFERENCE_ASPECT);
    expect(rig.camera.x).toBeCloseTo(hero.x, 6);
    expect(rig.camera.y).toBeCloseTo(hero.y, 6);
    expect(rig.camera.z).toBeCloseTo(hero.z, 6);
  });
});

describe('the flight into the world', () => {
  it('takes about 1.4 seconds, with no jump in any frame', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    setPhase(frame, 'explore');

    let previous: Vec3 = { ...rig.camera };
    let frames = 0;
    let largest = 0;
    while (rig.pose.distance > CHASE_VIEW.distance + 0.01 && frames < 240) {
      rig.update(frame, DT);
      const moved = Math.hypot(
        rig.camera.x - previous.x,
        rig.camera.y - previous.y,
        rig.camera.z - previous.z,
      );
      largest = Math.max(largest, moved);
      previous = { ...rig.camera };
      frames += 1;
    }

    expect(frames * DT).toBeGreaterThan(1.2);
    expect(frames * DT).toBeLessThan(1.6);
    expect(largest).toBeLessThan(14);
    expect(rig.mode).toBe('chase');
  });

  it('holds its direction of sweep even if the robot turns during it', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    setPhase(frame, 'explore');
    frame.robot.speed = 6;
    frame.motion.velocityX = 0.05;
    frame.motion.velocityZ = 6;

    let previous = rig.pose.azimuth;
    for (let step = 0; step < 84; step += 1) {
      rig.update(frame, DT);
      const change = rig.pose.azimuth - previous;
      expect(Math.abs(change)).toBeLessThan(0.3);
      previous = rig.pose.azimuth;
      frame.motion.velocityX = -frame.motion.velocityX;
    }
  });

  it('cuts instead of flying when motion is reduced', () => {
    const frame = makeFrame({ reducedMotion: true });
    const rig = makeRig(frame);
    setPhase(frame, 'explore');
    rig.update(frame, DT);
    expect(rig.pose.distance).toBeCloseTo(CHASE_VIEW.distance);
  });

  it('flies back to the exact opening shot', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    setPhase(frame, 'explore');
    advance(rig, frame, 2);
    setPhase(frame, 'overview');
    advance(rig, frame, 1.7);

    const hero = heroPosition(REFERENCE_ASPECT);
    expect(rig.camera.x).toBeCloseTo(hero.x, 6);
    expect(rig.camera.y).toBeCloseTo(hero.y, 6);
    expect(rig.camera.z).toBeCloseTo(hero.z, 6);
    expect(rig.pose.shiftX).toBeCloseTo(HERO_SHOT.shiftX, 9);
  });
});

describe('the chase camera', () => {
  it('sits behind the robot at the chase distance and elevation, without lens shift', () => {
    const frame = makeFrame({ phase: 'explore' });
    frame.robot.yaw = 0;
    const rig = makeRig(frame);
    advance(rig, frame, 1);

    expect(rig.pose.distance).toBeCloseTo(CHASE_VIEW.distance);
    expect(rig.pose.elevation).toBeCloseTo(CHASE_VIEW.elevation);
    expect(rig.pose.shiftX).toBe(0);
    expect(rig.pose.shiftY).toBe(0);
    /* Facing south, so the camera is to the north, looking south. */
    expect(rig.camera.z).toBeLessThan(frame.robot.z);
  });

  it('holds a drag for about two seconds, then swings back', () => {
    const frame = makeFrame({ phase: 'explore' });
    const rig = makeRig(frame);
    frame.robot.speed = 6.5;
    frame.motion.velocityZ = 6.5;
    const behind = rig.basisAzimuth;

    rig.drag(150, 0);
    rig.update(frame, DT);
    const held = rig.basisAzimuth;
    expect(Math.abs(held - behind)).toBeGreaterThan(0.5);

    advance(rig, frame, 1.8);
    expect(rig.basisAzimuth).toBe(held);

    advance(rig, frame, 4);
    expect(Math.abs(Math.sin((rig.basisAzimuth - behind) / 2))).toBeLessThan(0.05);
  });

  it('zooms between 5 and 16', () => {
    const frame = makeFrame({ phase: 'explore' });
    const rig = makeRig(frame);
    rig.zoom(0.01);
    advance(rig, frame, 1);
    expect(rig.pose.distance).toBeCloseTo(CHASE_VIEW.minDistance);
    rig.zoom(100);
    advance(rig, frame, 1);
    expect(rig.pose.distance).toBeCloseTo(CHASE_VIEW.maxDistance);
  });

  it('does not spin round when the robot backs towards it', () => {
    const motion: Motion = { ...createMotion(), velocityZ: 6.5, speed: 6.5 };
    /* The camera is south, looking north, and the robot is walking south at it. */
    expect(chaseAim(0, motion, { azimuth: 0, rate: 0 })).toBe(false);
  });

  it('does swing behind the autopilot, whichever way it runs', () => {
    const motion: Motion = { ...createMotion(), velocityZ: 11, speed: 11, autopilot: true };
    expect(chaseAim(0, motion, { azimuth: 0, rate: 0 })).toBe(true);
  });

  it('ignores a road being crossed rather than followed', () => {
    const aim = { azimuth: 0, rate: 0 };
    const motion: Motion = {
      ...createMotion(),
      velocityZ: -6.5,
      speed: 6.5,
      onRoad: true,
      road: { hereX: 1, hereZ: 0, aheadX: 1, aheadZ: 0, offset: 0 },
    };
    chaseAim(0, motion, aim);
    /* Keeps heading north across the east-west road. */
    expect(Math.abs(aim.azimuth)).toBeLessThan(1e-6);
  });

  it('never drops the camera below the floor of the world', () => {
    const frame = makeFrame({ phase: 'explore' });
    const rig = makeRig(frame);
    frame.robot.y = -40;
    frame.motion.groundY = -40;
    rig.drag(0, -100000);
    advance(rig, frame, 3);
    expect(rig.camera.y).toBeGreaterThanOrEqual(-20);
  });

});

describe('the camera among the roads', () => {
  /** Hold forward along a stretch of road, checking the camera on every frame. */
  function walkAndWatch(points: Vec3[], seconds: number) {
    const driver = new Driver(world.network);
    const start = points[0] as Vec3;
    const next = points[1] as Vec3;
    const frame = makeFrame({ phase: 'explore', motion: driver.motion, steering: true });
    frame.robot.x = start.x;
    frame.robot.y = start.y;
    frame.robot.z = start.z;
    frame.robot.yaw = Math.atan2(next.x - start.x, next.z - start.z);
    const rig = makeRig(frame);
    const input = {
      stick: { x: 0, y: 1, magnitude: 1 },
      run: false,
      jump: false,
      touchMagnitude: 0,
      basisAzimuth: 0,
      facing: null,
    };

    let inside = 0;
    for (let step = 0; step < seconds * 60; step += 1) {
      input.basisAzimuth = rig.basisAzimuth;
      driver.tick(frame.robot, input, world.surface, DT);
      rig.update(frame, DT);

      /* Reaches decks from 0.65 below the camera to 0.85 above it: inside the structure. */
      const deck = world.surface.resolve(rig.camera.x, rig.camera.z, rig.camera.y + 0.35);
      if (step > 30 && deck?.inside) inside += 1;
    }
    return inside;
  }

  const ring = world.network.edges.filter((edge) => edge.style === 'ring');
  const helix = world.network.edges.filter((edge) => edge.style === 'helix');
  /* Bearings increase along the Ring, so each edge also gives the opposite walk. */
  const ringForward = ring.flatMap((edge) => edge.points);
  const ringBackward = [...ringForward].reverse();

  it('never enters a deck walking the Ring either way', () => {
    expect(walkAndWatch(ringForward, 48)).toBe(0);
    expect(walkAndWatch(ringBackward, 48)).toBe(0);
  });

  it.each(helix.map((edge) => edge.id))('never enters a deck walking %s either way', (id) => {
    const road = helix.find((edge) => edge.id === id) as (typeof helix)[number];
    const clear = road.points.filter((point) => point.y > 0.8 || point.y < -0.5);
    expect(walkAndWatch(clear, 12)).toBe(0);
    expect(walkAndWatch([...clear].reverse(), 12)).toBe(0);
  });
});

describe('boom against the props', () => {
  const blocker = { id: 'b', x: 0, z: 0, radius: 8.8 };

  it('is unchanged in the clear', () => {
    expect(boomReach(20, 0, 30, 0, [blocker])).toBe(1);
  });

  it('stops short of a prop zone between robot and camera', () => {
    const reach = boomReach(20, 0, 0, 0, [blocker]);
    expect(reach).toBeGreaterThan(0.5);
    expect(reach).toBeLessThan(0.65);
  });
});

describe('the station shot', () => {
  const station = world.station('rag-knowledge-service');

  function atStation() {
    const frame = makeFrame({ phase: 'explore' });
    frame.robot.x = station.pad.x;
    frame.robot.y = station.pad.y;
    frame.robot.z = station.pad.z;
    const rig = makeRig(frame);
    frame.station = station;
    return { frame, rig };
  }

  it('waits for the robot to have stopped', () => {
    const { frame, rig } = atStation();
    advance(rig, frame, 0.3);
    expect(rig.mode).toBe('chase');
    advance(rig, frame, 0.4);
    expect(rig.mode).toBe('station');
  });

  it('ends exactly on the anchor camera, with the subject moved left of the panel', () => {
    const { frame, rig } = atStation();
    advance(rig, frame, 2.4);

    expect(rig.camera.x).toBeCloseTo(station.cameraPosition.x, 4);
    expect(rig.camera.y).toBeCloseTo(station.cameraPosition.y, 4);
    expect(rig.camera.z).toBeCloseTo(station.cameraPosition.z, 4);
    expect(rig.pose.x).toBeCloseTo(station.cameraTarget.x, 4);
    expect(rig.pose.shiftX).toBeCloseTo(STATION_VIEW.shiftX, 4);
  });

  it('centres the shot and lifts it on a phone instead', () => {
    const { frame, rig } = atStation();
    frame.narrow = true;
    advance(rig, frame, 2.4);
    expect(rig.pose.shiftX).toBeCloseTo(0, 4);
    expect(rig.pose.shiftY).toBeCloseTo(STATION_VIEW.narrowShiftY, 4);
  });

  it('returns to the chase at once on moving, with forward still into the screen', () => {
    const { frame, rig } = atStation();
    advance(rig, frame, 2.4);
    const azimuth = rig.pose.azimuth;

    frame.steering = true;
    rig.update(frame, DT);
    expect(rig.mode).toBe('chase');
    expect(rig.basisAzimuth).toBeCloseTo(azimuth, 3);
  });

  it('is already there on coming back from a case study', () => {
    const frame = makeFrame({ phase: 'explore', station });
    frame.robot.x = station.pad.x;
    frame.robot.y = station.pad.y;
    frame.robot.z = station.pad.z;
    const rig = makeRig(frame);
    expect(rig.mode).toBe('station');
    expect(rig.camera.x).toBeCloseTo(station.cameraPosition.x, 4);
    rig.update(frame, DT);
    expect(rig.mode).toBe('station');
  });

  it('cuts when motion is reduced', () => {
    const { frame, rig } = atStation();
    frame.reducedMotion = true;
    advance(rig, frame, 0.6);
    expect(rig.mode).toBe('station');
    expect(rig.camera.x).toBeCloseTo(station.cameraPosition.x, 4);
  });
});

describe('poses', () => {
  it('round-trips a camera position and target', () => {
    const position = { x: 3, y: 7, z: -4 };
    const target = { x: -2, y: 1, z: 5 };
    const pose = poseFromShot(position, target, 40, 0, 0, createPose());
    const back = positionOf(pose, { x: 0, y: 0, z: 0 });
    expect(back.x).toBeCloseTo(position.x);
    expect(back.y).toBeCloseTo(position.y);
    expect(back.z).toBeCloseTo(position.z);
  });

  it('eases from a standstill to a standstill', () => {
    expect(easeFlight(0)).toBe(0);
    expect(easeFlight(1)).toBe(1);
    expect(easeFlight(0.5)).toBeCloseTo(0.5);
    expect(easeFlight(0.01)).toBeLessThan(0.001);
  });

  it('uses the hero elevation in degrees', () => {
    const frame = makeFrame();
    const rig = makeRig(frame);
    expect(rig.pose.elevation).toBeCloseTo(HERO_SHOT.elevation * DEG, 9);
  });
});
