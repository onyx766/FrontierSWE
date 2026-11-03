import { describe, expect, it } from 'vitest';
import { tourOrder } from '@/data/universe';
import type { RobotState } from '../../../state/runtime';
import { ringHeight, WORLD, type RoadEdge } from '../../../world/network';
import { DEG, distance, distanceXZ, polar, type Vec3 } from '../../../world/vec';
import { START_STATION_ID, world } from '../../../world/world';
import { Driver, type DriveInput } from '../driver';
import { Rig, type RigFrame } from '../rig';
import { RUN_SPEED, stationAt, stepWalker, WALK_SPEED, createOrder, createWalker } from '../walker';

/**
 * These walk the real road network through the same driver and camera rig that
 * the visitor uses, one frame at a time, so "holding W follows the road" is
 * checked on the real curves rather than asserted of a formula.
 */

const DT = 1 / 60;

function robotAt(point: Vec3, yaw = 0): RobotState {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    lift: 0,
    yaw,
    speed: 0,
    road: null,
    roadTangentX: 0,
    roadTangentZ: 0,
  };
}

/** A driver and a chase camera over one robot, advanced together as the page does. */
function session(robot: RobotState) {
  const driver = new Driver(world.network);
  const frame: RigFrame = {
    phase: 'explore',
    station: null,
    aspect: 16 / 9,
    narrow: false,
    reducedMotion: false,
    robot,
    motion: driver.motion,
    steering: false,
    dragging: false,
  };
  const rig = new Rig(frame, world.surface, world.network.blockers);
  const input: DriveInput = {
    stick: { x: 0, y: 0, magnitude: 0 },
    run: false,
    jump: false,
    touchMagnitude: 0,
    basisAzimuth: 0,
    facing: null,
  };

  return {
    driver,
    rig,
    input,
    frame,
    hold(stickX: number, stickY: number, run = false) {
      input.stick.x = stickX;
      input.stick.y = stickY;
      input.stick.magnitude = Math.min(Math.hypot(stickX, stickY), 1);
      input.run = run;
    },
    step() {
      input.basisAzimuth = rig.basisAzimuth;
      driver.tick(robot, input, world.surface, DT);
      frame.steering = input.stick.magnitude > 0.05;
      rig.update(frame, DT);
    },
  };
}

const edge = (id: string) => world.network.edges.find((road) => road.id === id) as RoadEdge;

describe('holding forward', () => {
  /** Walk `seconds` of held W from the middle of a road, facing along it. */
  function holdForward(start: Vec3, next: Vec3, seconds: number, run = false) {
    const yaw = Math.atan2(next.x - start.x, next.z - start.z);
    const robot = robotAt(start, yaw);
    const drive = session(robot);
    drive.hold(0, 1, run);

    let travelled = 0;
    let slowest = Infinity;
    let widest = 0;
    let previous = { ...start };

    for (let frame = 0; frame < seconds * 60; frame += 1) {
      drive.step();
      const step = Math.hypot(robot.x - previous.x, robot.z - previous.z);
      travelled += step;
      if (frame > 60) slowest = Math.min(slowest, step / DT);
      if (robot.road === 'ring') {
        widest = Math.max(widest, Math.abs(Math.hypot(robot.x, robot.z) - WORLD.ringRadius));
      }
      previous = { x: robot.x, y: robot.y, z: robot.z };
    }

    return { robot, travelled, slowest, widest };
  }

  it('carries the robot all the way round the Ring without touching the rail', () => {
    const start = polar(WORLD.ringRadius, 28, ringHeight(28));
    const next = polar(WORLD.ringRadius, 29, ringHeight(29));
    const seconds = (2 * Math.PI * WORLD.ringRadius) / WALK_SPEED + 4;
    const { travelled, slowest, widest } = holdForward(start, next, seconds);

    expect(travelled).toBeGreaterThan(2 * Math.PI * WORLD.ringRadius);
    expect(slowest).toBeGreaterThan(WALK_SPEED * 0.8);
    expect(widest).toBeLessThan(1.6);
  });

  it('keeps pace at a full run round the Ring', () => {
    const start = polar(WORLD.ringRadius, 28, ringHeight(28));
    const next = polar(WORLD.ringRadius, 29, ringHeight(29));
    const { slowest } = holdForward(start, next, 40, true);
    expect(slowest).toBeGreaterThan(RUN_SPEED * 0.8);
  });

  it.each(world.network.edges.filter((road) => road.style === 'helix').map((road) => road.id))(
    'follows %s through its hairpin, at a walk and at a run',
    (id) => {
      const road = edge(id);
      /* Join after the road has left the island deck. */
      const startIndex = road.points.findIndex(
        (point) =>
          world.surface.resolve(point.x, point.z, point.y)?.edge?.id === id && point.y > 0.8,
      );
      const start = road.points[startIndex] as Vec3;
      const next = road.points[startIndex + 1] as Vec3;
      const end = road.points[road.points.length - 12] as Vec3;

      for (const run of [false, true]) {
        const robot = robotAt(start, Math.atan2(next.x - start.x, next.z - start.z));
        const drive = session(robot);
        drive.hold(0, 1, run);

        let reached = false;
        for (let frame = 0; frame < 60 * 30 && !reached; frame += 1) {
          drive.step();
          reached = distance(robot, end) < 4;
        }
        expect(reached, `${id}, ${run ? 'run' : 'walk'}, stopped at ${JSON.stringify(robot)}`).toBe(
          true,
        );
      }
    },
  );

  it.each(world.network.edges.filter((road) => road.style === 'spoke').map((road) => road.id))(
    'follows the S-curve of %s',
    (id) => {
      const road = edge(id);
      const start = road.points[3] as Vec3;
      const next = road.points[4] as Vec3;
      const end = road.points[road.points.length - 3] as Vec3;
      const robot = robotAt(start, Math.atan2(next.x - start.x, next.z - start.z));
      const drive = session(robot);
      drive.hold(0, 1);

      let reached = false;
      let slowest = Infinity;
      for (let frame = 0; frame < 60 * 8 && !reached; frame += 1) {
        drive.step();
        reached = distance(robot, end) < 3;
        if (frame > 45) slowest = Math.min(slowest, robot.speed);
      }
      expect(reached, JSON.stringify(robot)).toBe(true);
      /* Rubbing along the rail is what would pull the speed down. */
      expect(slowest, id).toBeGreaterThan(WALK_SPEED * 0.85);
    },
  );

  it('sends the robot down the spoke from the opening pose, not into the crystal', () => {
    const pad = world.station(START_STATION_ID).pad;
    const robot = robotAt(pad, 0);
    const drive = session(robot);
    drive.hold(0, 1);
    for (let frame = 0; frame < 60 * 4; frame += 1) drive.step();
    expect(robot.z).toBeGreaterThan(pad.z + 12);
  });

  it('takes the first bend without touching the rail, as the very first thing anyone does', () => {
    const pad = world.station(START_STATION_ID).pad;
    const robot = robotAt(pad, 0);
    const drive = session(robot);
    drive.hold(0, 1);

    let slowest = Infinity;
    let widest = 0;
    for (let frame = 0; frame < 60 * 3.2; frame += 1) {
      drive.step();
      if (frame > 45) slowest = Math.min(slowest, robot.speed);
      if (robot.road === 'spoke') widest = Math.max(widest, Math.abs(drive.driver.motion.road.offset));
    }
    expect(slowest).toBeGreaterThan(WALK_SPEED * 0.85);
    expect(widest).toBeLessThan(1.3);
  });
});

describe('feet on the deck', () => {
  it('keeps to the true deck height on every Helix ramp, where physics height runs high', () => {
    for (const road of world.network.edges.filter((entry) => entry.style === 'helix')) {
      const clear = road.points.filter((point) => point.y > 0.8 || point.y < -0.5);
      const start = clear[0] as Vec3;
      const next = clear[1] as Vec3;
      const robot = robotAt(start, Math.atan2(next.x - start.x, next.z - start.z));
      const drive = session(robot);
      drive.hold(0, 1);

      let worstPhysics = 0;
      for (let frame = 0; frame < 60 * 7; frame += 1) {
        drive.step();
        if (robot.road !== 'helix') continue;

        let nearest = road.points[0] as Vec3;
        for (const point of road.points) {
          if (distanceXZ(point, robot) < distanceXZ(nearest, robot)) nearest = point;
        }
        if (distanceXZ(nearest, robot) > 0.6) continue;

        expect(Math.abs(drive.driver.motion.groundY - nearest.y), road.id).toBeLessThan(0.3);
        worstPhysics = Math.max(worstPhysics, robot.y - nearest.y);
      }
      expect(worstPhysics, `${road.id} is the problem still there?`).toBeGreaterThan(0.1);
    }
  });

  it('rises smoothly up a ramp, without the steps of the physics height', () => {
    const road = edge('helix-ai-core');
    const clear = road.points.filter((point) => point.y > 0.8 || point.y < -0.5);
    const start = clear[0] as Vec3;
    const next = clear[1] as Vec3;
    const robot = robotAt(start, Math.atan2(next.x - start.x, next.z - start.z));
    const drive = session(robot);
    drive.hold(0, 1);

    let largestStep = 0;
    let previous = Infinity;
    for (let frame = 0; frame < 60 * 7; frame += 1) {
      drive.step();
      const height = drive.driver.motion.groundY;
      /* Clear of the hairpin, whose tip really does drop this fast on the inside line. */
      if (frame > 30 && robot.road === 'helix' && Math.hypot(robot.x, robot.z) > 38) {
        largestStep = Math.max(largestStep, Math.abs(height - previous));
      }
      previous = height;
    }
    expect(largestStep).toBeLessThan(0.08);
  });
});

describe('leaving the road on purpose', () => {
  it('lets a turn at a junction take the robot off the Ring', () => {
    /* On the Ring just west of the Data Vault junction, walking east, turn south. */
    const start = polar(WORLD.ringRadius, 192, 0);
    const robot = robotAt(start, Math.PI / 2);
    const drive = session(robot);
    drive.hold(0, 1);
    for (let frame = 0; frame < 30; frame += 1) drive.step();

    const held = drive.rig.basisAzimuth;
    drive.hold(1, 0);
    for (let frame = 0; frame < 60; frame += 1) drive.step();

    expect(held).toBeDefined();
    expect(Math.hypot(robot.x, robot.z)).toBeGreaterThan(WORLD.ringRadius + 3);
  });
});

describe('the robot cannot leave the world', () => {
  it('stays on a surface while mashing random directions everywhere', () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (const station of world.stations) {
      const robot = robotAt(station.pad);
      const drive = session(robot);
      for (let frame = 0; frame < 900; frame += 1) {
        if (frame % 40 === 0) {
          const angle = random() * Math.PI * 2;
          drive.hold(Math.cos(angle), Math.sin(angle), random() > 0.5);
        }
        drive.step();
        expect(world.surface.contains(robot.x, robot.y, robot.z), station.id).toBe(true);
      }
    }
  });
});

describe('autopilot', () => {
  /** Run the autopilot until it arrives. Returns seconds taken, or null if it never does. */
  function travel(robot: RobotState, stationId: string, limit = 90) {
    const drive = session(robot);
    drive.driver.follow(world.routeTo(robot, stationId).points);

    for (let frame = 0; frame < limit * 60; frame += 1) {
      drive.step();
      if (drive.driver.stalled) throw new Error(`stalled at ${JSON.stringify(robot)}`);
      if (drive.driver.arrived) return { seconds: frame * DT, drive };
    }
    return null;
  }

  it('reaches every station from the start of the walk and stops on its pad', () => {
    const start = world.station(START_STATION_ID).pad;
    for (const station of world.stations) {
      const robot = robotAt(start);
      const result = travel(robot, station.id);
      expect(result, station.id).not.toBeNull();
      expect(distanceXZ(robot, station.pad), station.id).toBeLessThan(0.3);
      expect(Math.abs(robot.y - station.pad.y), station.id).toBeLessThan(0.2);
    }
  });

  it('reaches every station from every other station', () => {
    for (const from of world.stations) {
      for (const to of world.stations) {
        if (from === to) continue;
        const robot = robotAt(from.pad);
        expect(travel(robot, to.id), `${from.id} to ${to.id}`).not.toBeNull();
        expect(stationAt(world.stations, robot)?.id, `${from.id} to ${to.id}`).toBe(to.id);
      }
    }
  });

  it('reaches a station from anywhere on any road, over or under a crossing', () => {
    const targets = ['welcome', 'rag-knowledge-service', 'capability-matrix'];
    for (const road of world.network.edges) {
      const start = road.points[road.points.length >> 1] as Vec3;
      for (const target of targets) {
        const hit = world.surface.snap(start);
        if (!hit) throw new Error(`nothing under ${road.id}`);
        const robot = robotAt({ x: hit.x, y: hit.y, z: hit.z });
        expect(travel(robot, target), `${road.id} to ${target}`).not.toBeNull();
      }
    }
  });

  it('reaches a station from anywhere on an island deck', () => {
    for (const station of world.stations.filter((entry) => entry.islandId !== null)) {
      for (let angle = 0; angle < 360; angle += 40) {
        const blocker = world.network.blockers.find(
          (entry) => entry.id === `props-${station.islandId}`,
        );
        if (!blocker) throw new Error('no blocker');
        const start = {
          x: blocker.x + Math.cos(angle * DEG) * 12,
          y: 0,
          z: blocker.z + Math.sin(angle * DEG) * 12,
        };
        const robot = robotAt(start);
        expect(travel(robot, 'welcome'), `${station.id} at ${angle}`).not.toBeNull();
      }
    }
  });

  it('walks the whole tour', () => {
    const robot = robotAt(world.station(START_STATION_ID).pad);
    for (const id of tourOrder) {
      expect(travel(robot, id), id).not.toBeNull();
    }
  });

  it('arrives at once when already on the pad', () => {
    const start = world.station(START_STATION_ID);
    const result = travel(robotAt(start.pad), start.id);
    expect(result?.seconds).toBeLessThan(0.1);
  });

  it('takes a route of a single point', () => {
    const drive = session(robotAt(world.station(START_STATION_ID).pad));
    drive.driver.follow([world.station(START_STATION_ID).pad]);
    drive.step();
    expect(drive.driver.arrived).toBe(true);
  });

  it('gives way to the stick', () => {
    const robot = robotAt(world.station(START_STATION_ID).pad);
    const drive = session(robot);
    drive.driver.follow(world.routeTo(robot, 'agent-orchestration-platform').points);
    for (let frame = 0; frame < 30; frame += 1) drive.step();

    drive.hold(0, 1);
    drive.step();
    expect(drive.driver.motion.autopilot).toBe(false);
  });

  it('declares a route stalled when it cannot make headway', () => {
    const robot = robotAt(world.station(START_STATION_ID).pad);
    const drive = session(robot);
    const pad = world.station(START_STATION_ID).pad;
    /* A route straight through the crystal: the surface will not let it through. */
    drive.driver.follow([pad, { x: pad.x, y: pad.y, z: pad.z - 30 }]);

    let stalled = false;
    for (let frame = 0; frame < 60 * 5 && !stalled; frame += 1) {
      drive.step();
      stalled = drive.driver.stalled;
    }
    expect(stalled).toBe(true);
  });
});

describe('the walker', () => {
  it('walks and runs at the promised speeds', () => {
    const start = polar(WORLD.ringRadius, 200, 0);
    for (const [run, speed] of [
      [false, WALK_SPEED],
      [true, RUN_SPEED],
    ] as const) {
      const robot = robotAt(start, Math.PI / 2);
      const drive = session(robot);
      drive.hold(0, 1, run);
      for (let frame = 0; frame < 120; frame += 1) drive.step();
      expect(robot.speed).toBeGreaterThan(speed * 0.9);
      expect(robot.speed).toBeLessThan(speed * 1.05);
    }
  });

  it('eases up to speed and eases back to a stop', () => {
    const start = polar(WORLD.ringRadius, 200, 0);
    const robot = robotAt(start, Math.PI / 2);
    const drive = session(robot);
    drive.hold(0, 1);
    drive.step();
    expect(robot.speed).toBeLessThan(WALK_SPEED * 0.3);

    for (let frame = 0; frame < 120; frame += 1) drive.step();
    drive.hold(0, 0);
    drive.step();
    expect(robot.speed).toBeGreaterThan(WALK_SPEED * 0.5);

    for (let frame = 0; frame < 90; frame += 1) drive.step();
    expect(robot.speed).toBeLessThan(0.05);
  });

  it('reports standing still when pushing against the edge of the road', () => {
    /* Looking straight out across the Ring, with forward held into the edge. */
    const outward = Math.atan2(Math.sin(200 * DEG), -Math.cos(200 * DEG));
    const robot = robotAt(polar(WORLD.ringRadius, 200, 0), outward);
    const drive = session(robot);
    drive.hold(0, 1);
    for (let frame = 0; frame < 120; frame += 1) drive.step();
    expect(robot.speed).toBeLessThan(0.6);
  });

  it('turns to the given facing when told to stand and explain', () => {
    const robot = robotAt(world.station(START_STATION_ID).pad, 0);
    const drive = session(robot);
    drive.input.facing = 2;
    for (let frame = 0; frame < 120; frame += 1) drive.step();
    expect(robot.yaw).toBeCloseTo(2, 2);
  });

  it('hops and lands without touching the ground height', () => {
    const start = world.station(START_STATION_ID).pad;
    const robot = robotAt(start);
    const walker = createWalker();
    const order = createOrder();
    order.jump = true;

    let peak = 0;
    let frames = 0;
    stepWalker(robot, walker, order, world.surface, DT);
    order.jump = false;
    const ground = robot.y;

    while (robot.lift > 0 && frames < 200) {
      stepWalker(robot, walker, order, world.surface, DT);
      peak = Math.max(peak, robot.lift);
      frames += 1;
      expect(robot.y).toBe(ground);
    }

    expect(peak).toBeGreaterThan(0.9);
    expect(peak).toBeLessThan(1.4);
    expect(frames * DT).toBeGreaterThan(0.5);
    expect(frames * DT).toBeLessThan(0.9);
    expect(robot.lift).toBe(0);
  });
});

describe('pads', () => {
  it('finds the pad under the robot', () => {
    for (const station of world.stations) {
      expect(stationAt(world.stations, station.pad)?.id).toBe(station.id);
    }
  });

  it('ignores a pad far above or below', () => {
    const { pad } = world.station('domain-ai-systems');
    expect(stationAt(world.stations, { ...pad, y: pad.y + 4 })).toBeNull();
  });

  it('gives the crystal stop its larger radius', () => {
    const { pad } = world.station(START_STATION_ID);
    expect(stationAt(world.stations, { ...pad, z: pad.z + WORLD.corePadRadius - 0.1 })?.id).toBe(
      START_STATION_ID,
    );
    expect(stationAt(world.stations, { ...pad, z: pad.z + WORLD.corePadRadius + 0.1 })).toBeNull();
  });

  it('finds nothing on the open road', () => {
    expect(stationAt(world.stations, polar(WORLD.ringRadius, 30, 1.4))).toBeNull();
  });
});
