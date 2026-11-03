import type { RobotState } from '../../state/runtime';
import { WORLD } from '../../world/network';
import type { StationAnchor } from '../../world/stations';
import type { SurfaceQuery, WalkSurface } from '../../world/surface';
import { distanceXZ, yawOf, type Vec3 } from '../../world/vec';
import { damp, dampAngle, smoothstep, type Flat } from './steering';

/**
 * The robot's body: how a wish to move becomes motion on the walking surface.
 * Position only ever comes from `surface.move`, so nothing here can take the
 * robot off the road. Pure, so the tests can drive it over the real network.
 */

export const WALK_SPEED = 6.5;
export const RUN_SPEED = 11.5;

/** Response to the stick, per second. Stopping is firmer than starting. */
const ACCELERATE = 7;
const DECELERATE = 11;
/** Heading response while moving, and while turning on the spot to face something. */
const TURN_RATE = 11;
const FACE_RATE = 5;
/** Smooths the measured speed, which is what the walk cycle is keyed to. */
const SPEED_RATE = 16;

/** A hop of about 1.1 units that lasts as long as the Jump clip. */
const JUMP_VELOCITY = 6.6;
const GRAVITY = 19.5;

export interface Walker {
  velocityX: number;
  velocityZ: number;
  liftVelocity: number;
}

export function createWalker(): Walker {
  return { velocityX: 0, velocityZ: 0, liftVelocity: 0 };
}

export interface WalkOrder {
  /** Unit direction of travel; ignored when `speed` is zero. */
  directionX: number;
  directionZ: number;
  speed: number;
  /** Heading to turn to while standing still, or null to keep the current one. */
  facing: number | null;
  jump: boolean;
}

export function createOrder(): WalkOrder {
  return { directionX: 0, directionZ: 0, speed: 0, facing: null, jump: false };
}

/** Advance the robot by one frame. Returns what the surface said about where it landed. */
export function stepWalker(
  robot: RobotState,
  walker: Walker,
  order: WalkOrder,
  surface: WalkSurface,
  dt: number,
): SurfaceQuery {
  const wantX = order.directionX * order.speed;
  const wantZ = order.directionZ * order.speed;
  const speeding = order.speed >= Math.hypot(walker.velocityX, walker.velocityZ);
  const response = speeding ? ACCELERATE : DECELERATE;
  walker.velocityX = damp(walker.velocityX, wantX, response, dt);
  walker.velocityZ = damp(walker.velocityZ, wantZ, response, dt);

  const fromX = robot.x;
  const fromZ = robot.z;
  const hit = surface.move(robot, walker.velocityX * dt, walker.velocityZ * dt);
  robot.x = hit.x;
  robot.y = hit.y;
  robot.z = hit.z;
  robot.road = hit.edge?.style ?? null;
  robot.roadTangentX = hit.tangentX ?? 0;
  robot.roadTangentZ = hit.tangentZ ?? 0;

  /* Measured, not commanded: pushing against a rail is standing still. */
  const moved = Math.hypot(robot.x - fromX, robot.z - fromZ);
  robot.speed = damp(robot.speed, moved / dt, SPEED_RATE, dt);

  if (order.speed > 0) {
    robot.yaw = dampAngle(robot.yaw, yawOf(order.directionX, order.directionZ), TURN_RATE, dt);
  } else if (order.facing !== null && robot.speed < 1) {
    robot.yaw = dampAngle(robot.yaw, order.facing, FACE_RATE, dt);
  }

  if (order.jump && robot.lift === 0) walker.liftVelocity = JUMP_VELOCITY;
  if (robot.lift > 0 || walker.liftVelocity > 0) {
    walker.liftVelocity -= GRAVITY * dt;
    robot.lift = Math.max(0, robot.lift + walker.liftVelocity * dt);
    if (robot.lift === 0) walker.liftVelocity = 0;
  }

  return hit;
}

/* ──────────────────────────────── Autopilot ─────────────────────────────── */

/** How far ahead along the route the robot aims. Rounds corners instead of hitting them. */
const AIM_AHEAD = 2.4;
/** How far ahead it looks for a corner to slow down for. */
const CORNER_AHEAD = 7;
/** Slowest fraction of full speed, taken in the tightest corners. */
const CORNER_SPEED = 0.6;
/** Braking into the pad, in units per second squared. */
const BRAKE = 16;
/** Near enough to the pad's centre to call it arrived. */
const ARRIVED = 0.16;
/** How many route segments the robot can pass between frames. */
const SEARCH_SEGMENTS = 6;

/** Progress along a route. Only moves forward, so a route that crosses itself is safe. */
export class RouteFollower {
  private readonly lengths: number[] = [0];
  private segment = 0;
  /** Arc length reached so far. */
  along = 0;
  readonly total: number;

  constructor(private readonly points: Vec3[]) {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1] as Vec3;
      const b = points[i] as Vec3;
      this.lengths.push((this.lengths[i - 1] as number) + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.total = this.lengths[this.lengths.length - 1] as number;
  }

  /** Project the robot onto the nearby stretch of route. */
  advance(x: number, z: number): void {
    const last = Math.min(this.segment + SEARCH_SEGMENTS, this.points.length - 2);
    let best = Infinity;
    let bestAlong = this.along;
    let bestSegment = this.segment;

    for (let i = this.segment; i <= last; i += 1) {
      const a = this.points[i] as Vec3;
      const b = this.points[i + 1] as Vec3;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lengthSq = abx * abx + abz * abz;
      if (lengthSq < 1e-9) continue;

      const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / lengthSq));
      const reach = (a.x + abx * t - x) ** 2 + (a.z + abz * t - z) ** 2;
      if (reach < best) {
        best = reach;
        bestSegment = i;
        bestAlong = (this.lengths[i] as number) + Math.sqrt(lengthSq) * t;
      }
    }

    if (bestAlong > this.along) {
      this.along = bestAlong;
      this.segment = bestSegment;
    }
  }

  /** The route's point `ahead` units past the robot. */
  pointAhead(ahead: number, out: Flat): Flat {
    const wanted = Math.min(this.along + ahead, this.total);
    let i = this.segment;
    while (i < this.points.length - 2 && (this.lengths[i + 1] as number) < wanted) i += 1;

    const a = this.points[i] as Vec3;
    const b = this.points[Math.min(i + 1, this.points.length - 1)] as Vec3;
    const start = this.lengths[i] as number;
    const span = (this.lengths[Math.min(i + 1, this.points.length - 1)] as number) - start;
    const t = span > 0 ? (wanted - start) / span : 1;
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }
}

const aim: Flat = { x: 0, z: 0 };
const corner: Flat = { x: 0, z: 0 };

/**
 * Steer along a route: aim a little way ahead, ease off for corners, brake onto
 * the pad. Returns true once the robot has arrived.
 */
export function steerAlongRoute(
  follower: RouteFollower,
  robot: RobotState,
  topSpeed: number,
  order: WalkOrder,
): boolean {
  follower.advance(robot.x, robot.z);
  follower.pointAhead(AIM_AHEAD, aim);

  const toAimX = aim.x - robot.x;
  const toAimZ = aim.z - robot.z;
  const aimDistance = Math.hypot(toAimX, toAimZ);
  const remaining = Math.max(follower.total - follower.along, 0);

  if (remaining < AIM_AHEAD && aimDistance < ARRIVED) {
    order.speed = 0;
    return true;
  }

  order.directionX = toAimX / (aimDistance || 1);
  order.directionZ = toAimZ / (aimDistance || 1);

  follower.pointAhead(CORNER_AHEAD, corner);
  const cornerX = corner.x - aim.x;
  const cornerZ = corner.z - aim.z;
  const cornerLength = Math.hypot(cornerX, cornerZ) || 1;
  const straightness = (order.directionX * cornerX + order.directionZ * cornerZ) / cornerLength;
  const easing = CORNER_SPEED + (1 - CORNER_SPEED) * smoothstep(-0.2, 0.85, straightness);
  const cornering = topSpeed * easing;

  const braking = 1.2 + Math.sqrt(2 * BRAKE * (remaining + aimDistance * 0.5));
  order.speed = Math.min(cornering, remaining < AIM_AHEAD ? 1.2 + aimDistance * 5 : braking);
  return false;
}

/* ───────────────────────────────── Pads ─────────────────────────────────── */

/** Height difference within which a pad counts: a bridge passing above is not a visit. */
const PAD_HEIGHT = 1.5;

export function padRadiusOf(station: StationAnchor): number {
  return station.islandId === null ? WORLD.corePadRadius : WORLD.padRadius;
}

/** The station whose pad contains this point, or null. */
export function stationAt(
  stations: readonly StationAnchor[],
  position: { x: number; y: number; z: number },
): StationAnchor | null {
  for (const station of stations) {
    if (
      Math.abs(station.pad.y - position.y) < PAD_HEIGHT &&
      distanceXZ(station.pad, position) < padRadiusOf(station)
    ) {
      return station;
    }
  }
  return null;
}
