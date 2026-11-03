import type { RobotState } from '../../state/runtime';
import type { RoadNetwork } from '../../world/network';
import type { SurfaceQuery, WalkSurface } from '../../world/surface';
import type { Vec3 } from '../../world/vec';
import {
  assistAlongRoad,
  cameraRelative,
  chainRoads,
  deckHeight,
  deckSlope,
  readRoad,
  updateRoadTrack,
  type Flat,
  type RoadChains,
  type RoadReading,
  type RoadTrack,
  type Stick,
} from './steering';
import {
  createOrder,
  createWalker,
  RouteFollower,
  RUN_SPEED,
  steerAlongRoute,
  stepWalker,
  WALK_SPEED,
  type Walker,
  type WalkOrder,
} from './walker';

/**
 * One frame of the robot's will: the stick or the autopilot decides where to go,
 * the walker moves it, and the road underfoot is read for the camera. Holds no
 * React or three.js, so the tests can drive exactly what the visitor drives.
 */

/** Below this the stick is resting, not steering. */
export const STICK_DEADZONE = 0.05;
/** A joystick pushed this far is a run; there is no Shift key on a phone. */
const TOUCH_RUN = 0.92;
/**
 * How far ahead along the road the robot's feet and the camera each look, in
 * units. The chicanes on the spokes reverse every five units or so, and looking
 * further than that sees the next bend and turns the wrong way.
 */
const FEET_AHEAD = 1.8;
const VIEW_AHEAD = 3;
/** How long the autopilot may make no headway before its route is declared stuck. */
const STALL_SECONDS = 1.6;
const STALL_PROGRESS = 0.4;

export interface DriveInput {
  stick: Stick;
  run: boolean;
  jump: boolean;
  /** The stick's touch component alone: full deflection runs. */
  touchMagnitude: number;
  /** Camera azimuth the stick is relative to. */
  basisAzimuth: number;
  /** Heading to turn to when standing still, or null. */
  facing: number | null;
}

/** How the robot is moving, as the chase camera needs to know it. */
export interface Motion {
  velocityX: number;
  velocityZ: number;
  speed: number;
  autopilot: boolean;
  /** Height of the deck underfoot. `robot.y` is the physics height, which is rougher. */
  groundY: number;
  /** How that deck climbs, per unit of x and of z. */
  slope: Flat;
  /** True when `road` describes the road underfoot. */
  onRoad: boolean;
  road: RoadReading;
}

export function createMotion(): Motion {
  return {
    velocityX: 0,
    velocityZ: 0,
    speed: 0,
    autopilot: false,
    groundY: 0,
    slope: { x: 0, z: 0 },
    onRoad: false,
    road: { hereX: 0, hereZ: 0, aheadX: 0, aheadZ: 0, offset: 0 },
  };
}

export class Driver {
  readonly walker: Walker = createWalker();
  readonly motion: Motion = createMotion();

  private readonly chains: RoadChains;
  private readonly order: WalkOrder = createOrder();
  private readonly track: RoadTrack = { edge: null, index: 0 };
  private readonly feet: RoadReading = { hereX: 0, hereZ: 0, aheadX: 0, aheadZ: 0, offset: 0 };
  private readonly wish: Flat = { x: 0, z: 0 };
  private follower: RouteFollower | null = null;
  private stallClock = 0;
  private stallFrom = 0;

  /** True on the frame the autopilot reaches the end of its route. */
  arrived = false;
  /** True on the frame the autopilot gives up making headway. */
  stalled = false;

  constructor(network: RoadNetwork) {
    this.chains = chainRoads(network.edges);
  }

  /** Walk this polyline. It replaces any route already being walked. */
  follow(points: Vec3[]): void {
    this.follower = new RouteFollower(points);
    this.stallClock = 0;
    this.stallFrom = 0;
  }

  /** Drop the route. The robot slows to a stop where it is. */
  stopFollowing(): void {
    this.follower = null;
  }

  tick(robot: RobotState, input: DriveInput, surface: WalkSurface, dt: number): SurfaceQuery {
    const { order, wish, feet, motion, walker } = this;
    const steering = input.stick.magnitude > STICK_DEADZONE;
    const running = input.run || input.touchMagnitude >= TOUCH_RUN;

    this.arrived = false;
    this.stalled = false;
    order.jump = input.jump;
    order.facing = null;

    if (steering) {
      cameraRelative(input.stick.x, input.stick.y, input.basisAzimuth, wish);
      const length = Math.hypot(wish.x, wish.z) || 1;
      wish.x /= length;
      wish.z /= length;

      if (readRoad(this.track, robot.x, robot.z, wish.x, wish.z, FEET_AHEAD, feet)) {
        assistAlongRoad(wish.x, wish.z, feet, wish);
      }

      order.directionX = wish.x;
      order.directionZ = wish.z;
      order.speed = (running ? RUN_SPEED : WALK_SPEED) * input.stick.magnitude;
    } else if (this.follower) {
      if (steerAlongRoute(this.follower, robot, RUN_SPEED, order)) {
        this.follower = null;
        this.arrived = true;
      } else {
        this.watchForStall(this.follower, dt);
      }
    } else {
      order.speed = 0;
      order.facing = input.facing;
    }

    const hit = stepWalker(robot, walker, order, surface, dt);
    updateRoadTrack(this.track, hit.edge, robot.x, robot.z, this.chains);

    motion.velocityX = walker.velocityX;
    motion.velocityZ = walker.velocityZ;
    motion.speed = robot.speed;
    motion.autopilot = this.follower !== null && !steering;
    motion.groundY = deckHeight(this.track, robot.x, robot.z, robot.y);
    deckSlope(this.track, motion.slope);

    /* The autopilot may run towards the camera, which must then swing behind it.
       Under the stick the camera keeps looking the way it looks, so that walking
       backwards does not spin the view round. */
    const towardX = motion.autopilot ? order.directionX : -Math.sin(input.basisAzimuth);
    const towardZ = motion.autopilot ? order.directionZ : -Math.cos(input.basisAzimuth);
    motion.onRoad = readRoad(
      this.track,
      robot.x,
      robot.z,
      towardX,
      towardZ,
      VIEW_AHEAD,
      motion.road,
    );

    return hit;
  }

  private watchForStall(follower: RouteFollower, dt: number): void {
    this.stallClock += dt;
    if (this.stallClock < STALL_SECONDS) return;
    this.stalled = follower.along - this.stallFrom < STALL_PROGRESS;
    this.stallClock = 0;
    this.stallFrom = follower.along;
  }
}
