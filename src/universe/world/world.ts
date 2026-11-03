import { buildBriefing, type Briefing } from './beats';
import { buildRoadNetwork, networkExtent, type RoadNetwork } from './network';
import { findRoute, type Route } from './route';
import { buildStationAnchors, type StationAnchor } from './stations';
import { WalkSurface } from './surface';
import type { Vec3 } from './vec';

/**
 * The assembled world. Built once and shared: it is pure data derived from
 * `src/data/`, so there is nothing to re-create between renders.
 */

export interface World {
  network: RoadNetwork;
  surface: WalkSurface;
  stations: StationAnchor[];
  /** Radius that contains every road and island deck. */
  extent: number;
  /** Lazily built, because long copy is only needed once a visitor arrives. */
  briefing(stationId: string): Briefing;
  station(stationId: string): StationAnchor;
  routeTo(from: Vec3, stationId: string): Route;
}

function createWorld(): World {
  const network = buildRoadNetwork();
  const surface = new WalkSurface(network);
  const stations = buildStationAnchors();
  const byId = new Map(stations.map((station) => [station.id, station]));
  const briefings = new Map<string, Briefing>();

  const station = (stationId: string): StationAnchor => {
    const anchor = byId.get(stationId);
    if (!anchor) throw new Error(`Unknown station "${stationId}"`);
    return anchor;
  };

  return {
    network,
    surface,
    stations,
    extent: networkExtent(network),
    station,
    briefing(stationId) {
      const cached = briefings.get(stationId);
      if (cached) return cached;
      const built = buildBriefing(station(stationId).content);
      briefings.set(stationId, built);
      return built;
    },
    routeTo(from, stationId) {
      return findRoute(network, from, station(stationId).junction);
    },
  };
}

export const world: World = createWorld();

/** Where the robot begins: on the pad in front of the crystal. */
export const START_STATION_ID = 'welcome';

/** The reference composition's pixel size. Frame coordinates are relative to this. */
export const REFERENCE_FRAME = { width: 1672, height: 941 } as const;

/**
 * The opening shot, solved numerically so that the Ring's extremes land on the
 * reference image: x 555–1275, y 245–640 at 1672×941. Of the lenses that fit
 * exactly, 28° also lands all six islands closest to their reference positions.
 * `shiftX` and `shiftY` are a lens shift, in fractions of the frame.
 */
export const HERO_SHOT = {
  fov: 28,
  elevation: 32.79,
  azimuth: 0,
  distance: 244.2,
  target: { x: 0, y: 0, z: 0 },
  shiftX: 0.0472,
  shiftY: 0.063,
} as const;
