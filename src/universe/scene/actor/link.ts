import { runtime } from '../../state/runtime';
import { world } from '../../world/world';
import { Driver } from './driver';
import type { Stick } from './steering';

/**
 * What the robot's controller and the camera rig tell each other. The driver's
 * stick is relative to the camera, and the camera follows the robot, so each
 * reads what the other wrote: the rig on this frame, the driver on the next.
 */
export interface ActorLink {
  driver: Driver;
  /** The combined keyboard and joystick input of this frame. */
  stick: Stick;
  /** True while the stick is pushed. */
  steering: boolean;
  /** Azimuth the stick is relative to. Written by the rig. */
  basisAzimuth: number;
  /** Set by the keyboard when the opening shot is asked for while already on it. */
  recenter: boolean;
}

/** Call once the robot has been placed. */
export function createActorLink(): ActorLink {
  const driver = new Driver(world.network);
  driver.motion.groundY = runtime.robot.y;

  return {
    driver,
    stick: { x: 0, y: 0, magnitude: 0 },
    steering: false,
    basisAzimuth: 0,
    recenter: false,
  };
}
