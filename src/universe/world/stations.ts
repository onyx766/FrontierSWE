import {
  coreStation,
  islands,
  type IslandContent,
  type IslandId,
  type StationContent,
} from '@/data/universe';
import { islandCenter, islandPoint, junctionIds, padJunctionId, WORLD } from './network';
import { polar, vec, yawOf, type Vec3 } from './vec';

/**
 * Where each station physically is. Derived from `src/data/universe.ts`, so
 * adding a station there also creates its pad, its road and its camera shot.
 */

export interface StationAnchor {
  id: string;
  title: string;
  content: StationContent;
  /** The island it stands on, or null for the stop at the crystal. */
  islandId: IslandId | null;
  /** Junction that routes finish on. */
  junction: string;
  /** Where the robot stands. Deck height. */
  pad: Vec3;
  /** Robot yaw while explaining, facing the hologram. */
  facing: number;
  /** Centre of the hologram. */
  holo: Vec3;
  /** Yaw of the hologram, so that its +Z face looks back at the pad. */
  holoYaw: number;
  /** Station camera position and aim. Clear of the island's props. */
  cameraPosition: Vec3;
  cameraTarget: Vec3;
}

const HOLO_ORBIT = 17.4;
/** High enough that the hologram clears the robot's head from the station camera. */
const HOLO_HEIGHT = 3.95;
/**
 * Degrees the hologram stands off the pad's own line, away from the camera. Facing
 * the pad from there also turns it towards the camera, so it is seen less obliquely.
 */
const HOLO_SWEEP = 3.5;
/** Degrees around the island from the pad to the camera. */
const CAMERA_SWEEP = 32;

function islandAnchor(island: IslandContent, station: StationContent): StationAnchor {
  const pad = islandPoint(island, station.angle, WORLD.padOrbit, 0);
  const holoBase = islandPoint(island, station.angle - HOLO_SWEEP, HOLO_ORBIT, HOLO_HEIGHT);

  const facing = yawOf(holoBase.x - pad.x, holoBase.z - pad.z);

  /*
   * Stand back along the loop road, which is always clear of the central props.
   * Always round the same way, so that every stop frames alike: the robot on the
   * left, the hologram beside it, and both clear of the briefing panel on the right.
   */
  const cameraPosition = islandPoint(
    island,
    station.angle + CAMERA_SWEEP,
    WORLD.islandLoopRadius,
    3.3,
  );

  return {
    id: station.id,
    title: station.title,
    content: station,
    islandId: island.id,
    junction: padJunctionId(station.id),
    pad,
    facing,
    holo: holoBase,
    holoYaw: facing + Math.PI,
    cameraPosition,
    cameraTarget: islandPoint(island, station.angle, 15.2, 2.8),
  };
}

function coreAnchor(): StationAnchor {
  const { bearing } = coreStation;
  const y = WORLD.coreLoopY;
  const pad = polar(WORLD.coreLoopRadius, bearing, y);
  const holo = polar(WORLD.coreLoopRadius - 5.5, bearing + HOLO_SWEEP, y + 5.15);
  const facing = yawOf(holo.x - pad.x, holo.z - pad.z);
  const island = islands.find((entry) => entry.bearing === bearing);

  return {
    id: coreStation.id,
    title: coreStation.title,
    content: coreStation,
    islandId: null,
    junction: island ? junctionIds(island.id).hub : padJunctionId(coreStation.id),
    pad,
    facing,
    holo,
    holoYaw: facing + Math.PI,
    cameraPosition: polar(WORLD.coreLoopRadius + 10.5, bearing - 13, y + 3.4),
    cameraTarget: polar(WORLD.coreLoopRadius - 2, bearing, y + 2.4),
  };
}

export function buildStationAnchors(): StationAnchor[] {
  return [
    coreAnchor(),
    ...islands.flatMap((island) =>
      island.stations.map((station) => islandAnchor(island, station)),
    ),
  ];
}

/** Hot-spot for the station beam and marker above an island. */
export function islandLabelPosition(island: IslandContent): Vec3 {
  const center = islandCenter(island);
  return vec(center.x, 3, center.z);
}
