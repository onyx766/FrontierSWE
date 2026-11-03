import { world } from '../world/world';
import { runtime } from './runtime';

/**
 * Opening the world at one station, e.g. from a project's "View in 3D" link on
 * the plain site: `/world?at=<station-id>` (see `worldHref` in `@/data/universe`).
 *
 * The robot is placed on that station's pad before the scene mounts, and the
 * scene's own placement keeps any robot that is already on the surface. Once the
 * scene is ready the store's `arriveAt` opens the briefing, and the camera rig
 * flies from the opening shot down to the station.
 */

/** The id, if it names a station that exists. */
export function knownStation(id: string | null | undefined): string | null {
  if (!id) return null;
  return world.stations.some((station) => station.id === id) ? id : null;
}

/** The requested station, if the query names one that exists. */
export function requestedStation(search: string, param: string): string | null {
  return knownStation(new URLSearchParams(search).get(param));
}

/** Stand the robot on the station's pad, facing its hologram. */
export function placeRobotAtStation(stationId: string): void {
  const { pad, facing } = world.station(stationId);
  const ground = world.surface.snap(pad);
  const { robot } = runtime;
  robot.x = pad.x;
  robot.z = pad.z;
  robot.y = ground?.y ?? pad.y;
  robot.yaw = facing;
  robot.lift = 0;
  robot.speed = 0;
}
