import { runtime } from '../../state/runtime';
import { START_STATION_ID, world } from '../../world/world';

/**
 * Where the robot stands when the scene mounts.
 *
 * `runtime` is module state, so after client-side navigation the robot is still
 * where the visitor left it, and that is exactly right: reading a case study and
 * coming back returns them to the same spot. A reload clears the module, so the
 * position is also kept for the session.
 */

const SAVE_KEY = 'universe:robot';

interface SavedPosition {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

function isOnSurface(x: number, y: number, z: number): boolean {
  return world.surface.contains(x, y, z);
}

function readSaved(): SavedPosition | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(SAVE_KEY) ?? 'null') as unknown;
    if (typeof saved !== 'object' || saved === null) return null;

    const { x, y, z, yaw } = saved as Partial<SavedPosition>;
    const isNumber = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value);
    if (!isNumber(x) || !isNumber(y) || !isNumber(z) || !isNumber(yaw)) return null;

    /* A saved spot may predate a change to the roads. */
    return isOnSurface(x, y, z) ? { x, y, z, yaw } : null;
  } catch {
    return null;
  }
}

export function saveRobotPosition(): void {
  const { x, y, z, yaw } = runtime.robot;
  try {
    window.sessionStorage.setItem(SAVE_KEY, JSON.stringify({ x, y, z, yaw }));
  } catch {
    /* Private mode or a full quota: a reload just starts from the beginning. */
  }
}

/** Put the robot in the world, unless it is already in it. */
export function placeRobot(): void {
  const { robot } = runtime;
  if (isOnSurface(robot.x, robot.y, robot.z)) return;

  const saved = readSaved();
  if (saved) {
    robot.x = saved.x;
    robot.y = saved.y;
    robot.z = saved.z;
    robot.yaw = saved.yaw;
    return;
  }

  /* On the pad before the crystal, facing the opening camera. */
  const { pad } = world.station(START_STATION_ID);
  robot.x = pad.x;
  robot.y = pad.y;
  robot.z = pad.z;
  robot.yaw = 0;
}
