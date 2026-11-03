import type { Phase } from '../../state/store';
import type { StationAnchor } from '../../world/stations';
import { WORLD } from '../../world/network';
import { distanceXZ, type Vec3 } from '../../world/vec';

/** Which station has the visitor's attention. Pure, so that the rules can be tested. */

interface FocusState {
  active: string | null;
  near: string | null;
  dismissed: boolean;
  travel: string | null;
  phase: Phase;
}

/** How far from a pad, along the ground, the robot can read its beacon. */
export const BEACON_RANGE = 15;
/** Roads pass over and under one another; a pad on another level is not nearby. */
const BEACON_HEIGHT_RANGE = 3;

/**
 * The station whose hologram should be up. An open briefing always shows it. A
 * pad underfoot shows it too, unless the visitor dismissed it, or this is the
 * opening shot, or the robot is only passing over on the way to somewhere else.
 * `dismissed` also covers the pad the robot starts on, which would otherwise
 * flash up the moment the visitor first steps off it.
 */
export function shownStation({
  active,
  near,
  dismissed,
  travel,
  phase,
}: FocusState): string | null {
  if (active) return active;
  return phase === 'explore' && travel === null && !dismissed ? near : null;
}

/**
 * The pad to name on the beacon: the one under the pointer, else the closest the
 * robot could walk to, ignoring any behind it as seen from the camera, such as the
 * pad it just stepped off. Nothing while a hologram is up, as it already says.
 */
export function beaconStation(
  stations: StationAnchor[],
  robot: Vec3,
  camera: Vec3,
  hovered: string | null,
  focus: FocusState,
): string | null {
  if (focus.phase === 'loading' || shownStation(focus) !== null) return null;
  if (hovered !== null) return hovered;
  if (focus.phase !== 'explore' || focus.near !== null) return null;

  let closest: string | null = null;
  let closestDistance = BEACON_RANGE;

  for (const station of stations) {
    const reach = distanceXZ(robot, station.pad);
    const radius = station.islandId === null ? WORLD.corePadRadius : WORLD.padRadius;
    if (reach < radius || reach >= closestDistance) continue;
    if (Math.abs(robot.y - station.pad.y) > BEACON_HEIGHT_RANGE) continue;

    const ahead =
      (station.pad.x - robot.x) * (robot.x - camera.x) +
      (station.pad.z - robot.z) * (robot.z - camera.z);
    if (ahead < 0) continue;

    closest = station.id;
    closestDistance = reach;
  }

  return closest;
}
