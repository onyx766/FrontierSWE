import type { Phase } from '../../state/store';
import type { RobotState } from '../../state/runtime';
import type { Blocker } from '../../world/network';
import type { StationAnchor } from '../../world/stations';
import type { WalkSurface } from '../../world/surface';
import { angleDelta, clamp, DEG, type Vec3 } from '../../world/vec';
import { HERO_SHOT } from '../../world/world';
import { heroFit } from '../heroCamera';
import type { Motion } from './driver';
import { damp, dampAngle, smoothstep } from './steering';

/**
 * The one camera. Every view is the same thing: spherical coordinates around a
 * target, plus a lens and a lens shift. A change of view is therefore a single
 * blend between two poses rather than a hand-over between controllers, and it
 * can start from wherever the camera happens to be.
 *
 *   overview   the opening shot, which the visitor can orbit and zoom
 *   chase      third person, behind the robot and following the road
 *   station    the framed shot of a station while it is being explained
 *
 * Pure, with no three.js objects: `CameraRig.tsx` copies the result to the camera.
 */

export type RigMode = 'overview' | 'chase' | 'station';

export interface RigPose {
  /** What the camera looks at. */
  x: number;
  y: number;
  z: number;
  /** Where the camera sits around the target. 0 is south of it, looking north. */
  azimuth: number;
  elevation: number;
  distance: number;
  fov: number;
  shiftX: number;
  shiftY: number;
}

export function createPose(): RigPose {
  return { x: 0, y: 0, z: 0, azimuth: 0, elevation: 0, distance: 1, fov: 28, shiftX: 0, shiftY: 0 };
}

export function positionOf(pose: RigPose, out: Vec3): Vec3 {
  const flat = pose.distance * Math.cos(pose.elevation);
  out.x = pose.x + flat * Math.sin(pose.azimuth);
  out.y = pose.y + pose.distance * Math.sin(pose.elevation);
  out.z = pose.z + flat * Math.cos(pose.azimuth);
  return out;
}

/** The pose that puts a camera at `position` looking at `target`. */
export function poseFromShot(
  position: Vec3,
  target: Vec3,
  fov: number,
  shiftX: number,
  shiftY: number,
  out: RigPose,
): RigPose {
  const dx = position.x - target.x;
  const dy = position.y - target.y;
  const dz = position.z - target.z;
  const distance = Math.hypot(dx, dy, dz);
  out.x = target.x;
  out.y = target.y;
  out.z = target.z;
  out.azimuth = Math.atan2(dx, dz);
  out.elevation = Math.asin(dy / distance);
  out.distance = distance;
  out.fov = fov;
  out.shiftX = shiftX;
  out.shiftY = shiftY;
  return out;
}

function copyPose(to: RigPose, from: RigPose): void {
  Object.assign(to, from);
}

/** A slow start and a slow finish, with no jolt at either end. */
export function easeFlight(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Part way between two poses. Distance mixes in log space, or a flight from 244
 * units to 8 would spend nearly all its time far away and then lunge at the end.
 * Azimuth is passed separately because the caller keeps it unwrapped.
 */
function mixPose(from: RigPose, to: RigPose, toAzimuth: number, t: number, out: RigPose): void {
  const mix = (a: number, b: number) => a + (b - a) * t;
  out.x = mix(from.x, to.x);
  out.y = mix(from.y, to.y);
  out.z = mix(from.z, to.z);
  out.azimuth = mix(from.azimuth, toAzimuth);
  out.elevation = mix(from.elevation, to.elevation);
  out.distance = Math.exp(mix(Math.log(from.distance), Math.log(to.distance)));
  out.fov = mix(from.fov, to.fov);
  out.shiftX = mix(from.shiftX, to.shiftX);
  out.shiftY = mix(from.shiftY, to.shiftY);
}

function dampPose(pose: RigPose, goal: RigPose, rate: number, dt: number): void {
  pose.x = damp(pose.x, goal.x, rate, dt);
  pose.y = damp(pose.y, goal.y, rate, dt);
  pose.z = damp(pose.z, goal.z, rate, dt);
  pose.azimuth = dampAngle(pose.azimuth, goal.azimuth, rate, dt);
  pose.elevation = damp(pose.elevation, goal.elevation, rate, dt);
  pose.distance = damp(pose.distance, goal.distance, rate, dt);
  pose.fov = damp(pose.fov, goal.fov, rate, dt);
  pose.shiftX = damp(pose.shiftX, goal.shiftX, rate, dt);
  pose.shiftY = damp(pose.shiftY, goal.shiftY, rate, dt);
}

/* ─────────────────────────────── Tuning ─────────────────────────────────── */

export const OVERVIEW_LIMITS = {
  minElevation: 12 * DEG,
  maxElevation: 70 * DEG,
  minZoom: 0.45,
  maxZoom: 1.25,
} as const;

export const CHASE_VIEW = {
  /** Height of the target above the robot's feet. */
  height: 1.5,
  distance: 8.5,
  minDistance: 5,
  maxDistance: 16,
  elevation: 16 * DEG,
  minElevation: 3 * DEG,
  maxElevation: 70 * DEG,
  fov: 50,
  /** Extra lens at a full run, for a sense of speed. */
  runFov: 6,
} as const;

export const STATION_VIEW = {
  fov: 49,
  /** Moves the subject left, clear of the briefing panel on the right. */
  shiftX: -0.16,
  /** On a phone the panel is a bottom sheet, so the subject moves up instead. */
  narrowShiftY: 0.14,
} as const;

/** Seconds per transition, keyed by the view being entered. */
const BLEND_SECONDS: Record<RigMode, number> = { overview: 1.6, chase: 1.4, station: 1.2 };
/** Leaving a station is a reaction to the visitor moving, so it must not dawdle. */
const LEAVE_STATION_SECONDS = 0.55;
const RECENTER_SECONDS = 1.2;

/** How long the robot stands before the camera frames the station. */
const SETTLE_SECONDS = 0.5;
const STILL_SPEED = 0.35;

/** Radians per pixel dragged. */
const ORBIT_SPEED = 0.0042;
/** How long a drag holds the chase camera where the visitor put it. */
const HOLD_SECONDS = 2;

const FOLLOW_RATE_XZ = 11;
const FOLLOW_RATE_Y = 7;
/** A hop should lift the view a little, not bounce it. */
const LIFT_FOLLOW = 0.3;
const ROAD_TURN_RATE = 3.4;
const DECK_TURN_RATE = 1.5;
const AUTOPILOT_TURN_RATE = 3;
/** Below this speed the robot is not going anywhere the camera should follow. */
const MIN_FOLLOW_SPEED = 0.6;
const FREE_RATE = 9;

/** Lowest the camera may go, however the visitor drags. */
const LOWEST_CAMERA = -20;
/**
 * Space to keep under a deck and above one. The surface answers with the highest
 * capsule in reach, up to half a unit above the true deck on the Ring's slopes,
 * so the space under includes that as well as the 0.8 of the deck's own structure.
 */
const ROOF_CLEARANCE = 1.7;
const FLOOR_CLEARANCE = 1.2;
/** Query heights around the camera that take in a deck at those clearances. */
const OVERHEAD_PROBES = [1.4, 0.5] as const;
const BENEATH_PROBE = 0.6;
/** Fractions of the boom, from the camera towards the robot, checked for a blocked view. */
const SIGHT_SAMPLES = [0.25, 0.5] as const;
/** A deck this far above the robot's feet is overhead, not the road it stands on. */
const OVERHEAD_RISE = 1.9;
const CLEARANCE_RATE = 14;

/** Keep the boom out of the island props. They rise about this high. */
const PROP_MARGIN = 0.4;
const PROP_TOP = 13;
const SHORTEST_BOOM = 0.34;

/* ────────────────────────────── Chase logic ─────────────────────────────── */

/** Azimuth that puts the camera directly behind travel along (x, z). */
function azimuthBehind(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

export interface ChaseAim {
  azimuth: number;
  rate: number;
}

/**
 * Where the chase camera wants to be. Returns false when it should stay put:
 * standing still, or walking back towards the camera.
 *
 * On a road it lines up with the road a little way ahead, whichever way the road
 * bends, and that is what makes holding forward feel like following it. Crossing
 * a road counts as being on a deck, otherwise stepping over the Ring would swing
 * the camera along it.
 */
export function chaseAim(azimuth: number, motion: Motion, out: ChaseAim): boolean {
  const speed = Math.hypot(motion.velocityX, motion.velocityZ);
  if (speed < MIN_FOLLOW_SPEED) return false;

  const headingX = motion.velocityX / speed;
  const headingZ = motion.velocityZ / speed;

  if (motion.onRoad) {
    const along = headingX * motion.road.hereX + headingZ * motion.road.hereZ;
    if (Math.abs(along) > 0.5) {
      out.azimuth = azimuthBehind(motion.road.aheadX, motion.road.aheadZ);
      out.rate = motion.autopilot ? AUTOPILOT_TURN_RATE : ROAD_TURN_RATE;
      return true;
    }
  }

  const facing = headingX * -Math.sin(azimuth) + headingZ * -Math.cos(azimuth);
  if (!motion.autopilot && facing < -0.3) return false;

  out.azimuth = azimuthBehind(headingX, headingZ);
  out.rate = motion.autopilot ? AUTOPILOT_TURN_RATE : DECK_TURN_RATE;
  return true;
}

/**
 * Fraction of the boom that can be used without entering a prop zone. The robot
 * cannot stand inside one, but the camera behind it can swing into one.
 */
export function boomReach(
  targetX: number,
  targetZ: number,
  cameraX: number,
  cameraZ: number,
  blockers: readonly Blocker[],
): number {
  let reach = 1;
  const dx = cameraX - targetX;
  const dz = cameraZ - targetZ;
  const a = dx * dx + dz * dz;
  if (a < 1e-6) return reach;

  for (const blocker of blockers) {
    const fx = targetX - blocker.x;
    const fz = targetZ - blocker.z;
    const radius = blocker.radius - PROP_MARGIN;
    const c = fx * fx + fz * fz - radius * radius;
    if (c <= 0) continue;

    const b = 2 * (fx * dx + fz * dz);
    const discriminant = b * b - 4 * a * c;
    if (discriminant <= 0) continue;

    const hit = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (hit > 0 && hit < reach) reach = hit;
  }

  return reach;
}

/* ──────────────────────────────── The rig ───────────────────────────────── */

export interface RigFrame {
  phase: Phase;
  /** The station being explained, or null. */
  station: StationAnchor | null;
  aspect: number;
  /** A phone-sized viewport, where the briefing is a bottom sheet. */
  narrow: boolean;
  reducedMotion: boolean;
  robot: RobotState;
  motion: Motion;
  /** True while the stick is pushed, even before the robot has started moving. */
  steering: boolean;
  dragging: boolean;
}

const aim: ChaseAim = { azimuth: 0, rate: 0 };

export class Rig {
  mode: RigMode;
  /** The pose after damping and blending, before the camera's collision fixes. */
  readonly pose: RigPose = createPose();
  /** The final camera position, clear of the decks and the props. */
  readonly camera: Vec3 = { x: 0, y: 0, z: 0 };
  /** Azimuth that stick input is relative to. Written for the next frame's driver. */
  basisAzimuth = 0;

  private readonly goal: RigPose = createPose();
  private readonly from: RigPose = createPose();
  private blend = 1;
  private blendSeconds = 1;
  /** The blend's destination azimuth, unwrapped so a half-turn cannot flip mid-flight. */
  private sweepAzimuth: number | null = null;
  private lastGoalAzimuth = 0;

  private orbitAzimuth = 0;
  private orbitElevation: number = HERO_SHOT.elevation * DEG;
  private orbitZoom = 1;

  private readonly chase = { x: 0, y: 0, z: 0 };
  private chaseAzimuth = 0;
  private chaseElevation: number = CHASE_VIEW.elevation;
  private chaseDistance: number = CHASE_VIEW.distance;
  private chaseFov: number = CHASE_VIEW.fov;

  private stationAzimuth = 0;
  private stationElevation = 0;
  private stationZoom = 1;

  private clock = 0;
  private holdUntil = 0;
  private stillFor = 0;
  private boom = 1;
  private heightFix = 0;

  constructor(
    frame: RigFrame,
    private readonly surface: WalkSurface,
    private readonly blockers: readonly Blocker[],
  ) {
    /* Back from a case study, the visitor is still at the station they left. */
    if (frame.phase !== 'explore') this.mode = 'overview';
    else this.mode = frame.station ? 'station' : 'chase';
    this.stillFor = frame.station ? SETTLE_SECONDS : 0;
    this.startChase(frame.robot, frame.robot.yaw + Math.PI);
    this.update(frame, 0);
    copyPose(this.pose, this.goal);
    positionOf(this.pose, this.camera);
  }

  /** Back to the exact opening shot, when `overview()` is asked for again. */
  recenter(reducedMotion: boolean): void {
    if (this.mode !== 'overview') return;
    this.resetOrbit();
    this.beginBlend(reducedMotion ? 0 : RECENTER_SECONDS);
  }

  /** Pointer drag, in pixels. */
  drag(dx: number, dy: number): void {
    const yaw = -dx * ORBIT_SPEED;
    const pitch = dy * ORBIT_SPEED;

    switch (this.mode) {
      case 'overview':
        this.orbitAzimuth += yaw;
        this.orbitElevation = clamp(
          this.orbitElevation + pitch,
          OVERVIEW_LIMITS.minElevation,
          OVERVIEW_LIMITS.maxElevation,
        );
        break;
      case 'chase':
        this.chaseAzimuth += yaw;
        this.chaseElevation = clamp(
          this.chaseElevation + pitch,
          CHASE_VIEW.minElevation,
          CHASE_VIEW.maxElevation,
        );
        this.holdUntil = this.clock + HOLD_SECONDS;
        break;
      case 'station':
        this.stationAzimuth += yaw;
        this.stationElevation += pitch;
        break;
    }
  }

  /** Wheel: a factor applied to the distance. */
  zoom(factor: number): void {
    switch (this.mode) {
      case 'overview':
        this.orbitZoom = clamp(
          this.orbitZoom * factor,
          OVERVIEW_LIMITS.minZoom,
          OVERVIEW_LIMITS.maxZoom,
        );
        break;
      case 'chase':
        this.chaseDistance = clamp(
          this.chaseDistance * factor,
          CHASE_VIEW.minDistance,
          CHASE_VIEW.maxDistance,
        );
        break;
      case 'station':
        this.stationZoom = clamp(this.stationZoom * factor, 0.7, 1.5);
        break;
    }
  }

  update(frame: RigFrame, dt: number): void {
    this.clock += dt;

    const moving = frame.steering || frame.robot.speed > STILL_SPEED;
    this.stillFor = moving ? 0 : this.stillFor + dt;

    const wanted = this.wantedMode(frame);
    if (wanted !== this.mode) this.enter(wanted, frame);

    switch (this.mode) {
      case 'overview':
        this.aimOverview(frame);
        break;
      case 'chase':
        this.aimChase(frame, dt);
        break;
      case 'station':
        this.aimStation(frame);
        break;
    }

    this.settlePose(dt);
    this.placeCamera(frame, dt);

    if (this.mode === 'overview') this.basisAzimuth = frame.robot.yaw + Math.PI;
    else if (this.mode === 'chase') this.basisAzimuth = this.chaseAzimuth;
    else this.basisAzimuth = this.pose.azimuth;
  }

  private wantedMode(frame: RigFrame): RigMode {
    if (frame.phase !== 'explore') return 'overview';
    return frame.station && this.stillFor >= SETTLE_SECONDS ? 'station' : 'chase';
  }

  private enter(mode: RigMode, frame: RigFrame): void {
    const previous = this.mode;
    this.mode = mode;

    if (mode === 'chase') {
      /* From the opening shot the robot's back is the natural start. Coming off a
         station, the view stays where it is so that forward means into the screen. */
      this.startChase(
        frame.robot,
        previous === 'overview' ? frame.robot.yaw + Math.PI : this.pose.azimuth,
      );
    } else if (mode === 'overview') {
      this.resetOrbit();
    } else {
      this.stationAzimuth = 0;
      this.stationElevation = 0;
      this.stationZoom = 1;
    }

    const leavingStation = previous === 'station' && mode === 'chase';
    const seconds = leavingStation ? LEAVE_STATION_SECONDS : BLEND_SECONDS[mode];
    this.beginBlend(frame.reducedMotion ? 0 : seconds);
  }

  private startChase(robot: RobotState, azimuth: number): void {
    this.chase.x = robot.x;
    this.chase.y = robot.y + CHASE_VIEW.height;
    this.chase.z = robot.z;
    this.chaseAzimuth = azimuth;
    this.chaseElevation = CHASE_VIEW.elevation;
    this.holdUntil = 0;
  }

  private resetOrbit(): void {
    this.orbitAzimuth = 0;
    this.orbitElevation = HERO_SHOT.elevation * DEG;
    this.orbitZoom = 1;
  }

  private beginBlend(seconds: number): void {
    copyPose(this.from, this.pose);
    this.blendSeconds = seconds;
    this.blend = 0;
    this.sweepAzimuth = null;
  }

  private aimOverview(frame: RigFrame): void {
    const { goal } = this;
    goal.x = HERO_SHOT.target.x;
    goal.y = HERO_SHOT.target.y;
    goal.z = HERO_SHOT.target.z;
    goal.azimuth = HERO_SHOT.azimuth * DEG + this.orbitAzimuth;
    goal.elevation = this.orbitElevation;
    goal.distance = HERO_SHOT.distance * heroFit(frame.aspect) * this.orbitZoom;
    goal.fov = HERO_SHOT.fov;
    goal.shiftX = HERO_SHOT.shiftX;
    goal.shiftY = HERO_SHOT.shiftY;
  }

  private aimChase(frame: RigFrame, dt: number): void {
    const { robot, motion } = frame;
    const { chase, goal } = this;

    chase.x = damp(chase.x, robot.x, FOLLOW_RATE_XZ, dt);
    chase.z = damp(chase.z, robot.z, FOLLOW_RATE_XZ, dt);
    chase.y = damp(
      chase.y,
      motion.groundY + CHASE_VIEW.height + robot.lift * LIFT_FOLLOW,
      FOLLOW_RATE_Y,
      dt,
    );

    if (this.clock >= this.holdUntil && !frame.dragging) {
      if (chaseAim(this.chaseAzimuth, motion, aim)) {
        this.chaseAzimuth = dampAngle(this.chaseAzimuth, aim.azimuth, aim.rate, dt);
      }
      if (robot.speed > MIN_FOLLOW_SPEED) {
        this.chaseElevation = damp(this.chaseElevation, CHASE_VIEW.elevation, 1.4, dt);
      }
    }

    const sprint = frame.reducedMotion ? 0 : smoothstep(6.5, 11, robot.speed);
    this.chaseFov = damp(this.chaseFov, CHASE_VIEW.fov + CHASE_VIEW.runFov * sprint, 3, dt);

    goal.x = chase.x;
    goal.y = chase.y;
    goal.z = chase.z;
    goal.azimuth = this.chaseAzimuth;
    goal.elevation = this.chaseElevation;
    goal.distance = this.chaseDistance;
    goal.fov = this.chaseFov;
    goal.shiftX = 0;
    goal.shiftY = 0;
  }

  private aimStation(frame: RigFrame): void {
    const { station } = frame;
    if (!station) return;

    const { goal } = this;
    poseFromShot(
      station.cameraPosition,
      station.cameraTarget,
      STATION_VIEW.fov,
      frame.narrow ? 0 : STATION_VIEW.shiftX,
      frame.narrow ? STATION_VIEW.narrowShiftY : 0,
      goal,
    );
    goal.azimuth += this.stationAzimuth;
    goal.elevation = clamp(
      goal.elevation + this.stationElevation,
      CHASE_VIEW.minElevation,
      CHASE_VIEW.maxElevation,
    );
    goal.distance *= this.stationZoom;
  }

  private settlePose(dt: number): void {
    const { pose, goal, from } = this;

    if (this.blend < 1) {
      if (this.sweepAzimuth === null) {
        this.sweepAzimuth = from.azimuth + angleDelta(from.azimuth, goal.azimuth);
      } else {
        this.sweepAzimuth += angleDelta(this.lastGoalAzimuth, goal.azimuth);
      }
      this.lastGoalAzimuth = goal.azimuth;

      /* Zero seconds is a cut: reduced motion goes straight to the new view. */
      this.blend = this.blendSeconds > 0 ? Math.min(1, this.blend + dt / this.blendSeconds) : 1;
      if (this.blend < 1) {
        mixPose(from, goal, this.sweepAzimuth, easeFlight(this.blend), pose);
        return;
      }
      copyPose(pose, goal);
      return;
    }

    if (this.mode === 'chase') copyPose(pose, goal);
    else dampPose(pose, goal, FREE_RATE, dt);
  }

  /** The camera's position, shortened and raised or lowered to stay in the clear. */
  private placeCamera(frame: RigFrame, dt: number): void {
    const { pose, camera } = this;
    positionOf(pose, camera);

    const chasing = this.mode === 'chase';

    const wantedBoom =
      chasing && camera.y < PROP_TOP
        ? Math.max(
            boomReach(pose.x, pose.z, camera.x, camera.z, this.blockers),
            SHORTEST_BOOM,
          )
        : 1;
    this.boom = damp(this.boom, wantedBoom, wantedBoom < this.boom ? 14 : 3, dt);

    camera.x = pose.x + (camera.x - pose.x) * this.boom;
    camera.y = pose.y + (camera.y - pose.y) * this.boom;
    camera.z = pose.z + (camera.z - pose.z) * this.boom;

    const wantedFix = chasing ? this.heightClearance(frame.motion.groundY) : 0;
    this.heightFix = damp(this.heightFix, wantedFix, CLEARANCE_RATE, dt);
    camera.y = Math.max(camera.y + this.heightFix, LOWEST_CAMERA);
  }

  /**
   * How far the camera must move to stay out of the decks.
   *
   * Over a deck's footprint it may only ever stay on the side it is already on:
   * deciding that from where the camera actually is, rather than where it would
   * like to be, is what stops it passing through a road at a hairpin or on the
   * way out from under the Ring. Clear of any deck, it dips under a bridge that
   * comes between it and the robot, in good time, so the view is never blocked.
   */
  private heightClearance(groundY: number): number {
    const { camera, pose, surface } = this;
    const actual = camera.y + this.heightFix;

    for (const probe of OVERHEAD_PROBES) {
      const overhead = surface.resolve(camera.x, camera.z, actual + probe);
      if (overhead?.inside && overhead.y > actual) {
        return Math.min(0, overhead.y - ROOF_CLEARANCE - camera.y);
      }
    }

    const beneath = surface.resolve(camera.x, camera.z, actual - BENEATH_PROBE);
    if (beneath?.inside) return Math.max(0, beneath.y + FLOOR_CLEARANCE - camera.y);

    let ceiling = Infinity;
    for (const along of SIGHT_SAMPLES) {
      const sightY = camera.y + (pose.y - camera.y) * along;
      const deck = surface.resolve(
        camera.x + (pose.x - camera.x) * along,
        camera.z + (pose.z - camera.z) * along,
        sightY + BENEATH_PROBE,
      );
      if (deck?.inside && deck.y > groundY + OVERHEAD_RISE) {
        ceiling = Math.min(ceiling, deck.y - ROOF_CLEARANCE);
      }
    }
    return ceiling < Infinity ? Math.min(0, ceiling - camera.y) : 0;
  }
}

