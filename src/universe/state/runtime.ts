import type { RoadStyle } from '../world/network';

/**
 * Per-frame state. Plain mutable objects, deliberately outside React: the robot
 * moves sixty times a second, and routing that through a store would re-render
 * the HUD on every frame. Anything that needs this reads it inside `useFrame`
 * or its own timer. State that should re-render UI belongs in `store.ts`.
 */

export interface RobotState {
  /** Ground position under the robot's feet. */
  x: number;
  y: number;
  z: number;
  /** Height above the ground while jumping. */
  lift: number;
  /** Heading in radians. 0 faces +Z. */
  yaw: number;
  /** Current speed in units per second. */
  speed: number;
  /** The kind of road underfoot, or null on a deck. */
  road: RoadStyle | null;
  /** Unit x/z direction of the road underfoot. Zero on a deck. */
  roadTangentX: number;
  roadTangentZ: number;
}

export interface InputState {
  /** Desired movement relative to the camera, each −1 to 1. +y is away from it. */
  moveX: number;
  moveY: number;
  /** Written by the on-screen joystick and combined with the keyboard. */
  touchX: number;
  touchY: number;
  run: boolean;
  /** Set when jump is pressed, cleared by the controller when consumed. */
  jump: boolean;
}

export interface ViewState {
  /** True while the visitor is dragging to orbit. */
  dragging: boolean;
  /** Camera position, for anything that fades with distance. */
  x: number;
  y: number;
  z: number;
}

export const runtime: { robot: RobotState; input: InputState; view: ViewState } = {
  robot: {
    x: 0,
    y: 0,
    z: 0,
    lift: 0,
    yaw: Math.PI,
    speed: 0,
    road: null,
    roadTangentX: 0,
    roadTangentZ: 0,
  },
  input: { moveX: 0, moveY: 0, touchX: 0, touchY: 0, run: false, jump: false },
  view: { dragging: false, x: 0, y: 0, z: 0 },
};
