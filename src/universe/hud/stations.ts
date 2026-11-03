import { domainHref } from '@/data/site';
import {
  coreStation,
  hudCopy,
  islands,
  type IslandAccent,
  type IslandContent,
  type StationContent,
} from '@/data/universe';
import { islandCenter, WORLD } from '../world/network';
import { distanceXZ } from '../world/vec';

/** The stations as the mission log and the map show them: grouped by island. */

export interface StationGroup {
  id: string;
  label: string;
  /** Null for the stop at the crystal, which belongs to no island. */
  accent: IslandAccent | null;
  stations: StationContent[];
}

export const stationGroups: StationGroup[] = [
  { id: 'core', label: hudCopy.log.coreGroup, accent: null, stations: [coreStation] },
  ...islands.map((island) => ({
    id: island.id,
    label: island.label.replace('\n', ' '),
    accent: island.accent,
    stations: island.stations,
  })),
];

export const stationCount = stationGroups.reduce((sum, group) => sum + group.stations.length, 0);

/** The island whose platform is under this point, if any. */
export function islandAt(point: { x: number; z: number }): IslandContent | null {
  return (
    islands.find((island) => distanceXZ(islandCenter(island), point) < WORLD.islandRadius) ?? null
  );
}

/**
 * The page that covers a station's subject. Rows in the mission log are real
 * links to it, so the same list works without JavaScript, without WebGL, and
 * for crawlers. With the world running, a click walks there instead.
 */
export function stationHref({ subject }: StationContent): string {
  switch (subject.type) {
    case 'project':
      return `/projects/${subject.slug}`;
    case 'domain':
      return domainHref(subject.domain);
    case 'welcome':
      return '/start-project';
    case 'services':
      return '/services';
    case 'career':
    case 'capabilities':
      return '/experience';
    case 'about':
    case 'principles':
      return '/about';
  }
}
