import type { RoadNetwork, RoadStyle } from '../world/network';
import type { Vec3 } from '../world/vec';

/**
 * Pure geometry behind the minimap. The map is the same network the robot walks
 * on, seen from above with north up, so world X and Z are map x and y directly.
 */

/** Half the width of the map in world units: the islands' reach plus a small margin. */
export const MAP_RADIUS = 80;

/** Bottom-to-top drawing order, so the main roads sit over the deck detail. */
const STYLE_ORDER: RoadStyle[] = [
  'spur',
  'link',
  'islandLoop',
  'coreLoop',
  'spoke',
  'helix',
  'ring',
];

const round = (value: number) => Math.round(value * 10) / 10;

/** An SVG path through `points`, in world units. */
export function polylinePath(points: readonly Pick<Vec3, 'x' | 'z'>[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.z)}`)
    .join('');
}

/** One path per road family, so the whole network is a handful of DOM nodes. */
export function roadPaths(network: RoadNetwork): { style: RoadStyle; d: string }[] {
  return STYLE_ORDER.map((style) => ({
    style,
    d: network.edges
      .filter((edge) => edge.style === style)
      .map((edge) => polylinePath(edge.points))
      .join(''),
  })).filter((road) => road.d.length > 0);
}

/** Position on the map as percentages of its box, for HTML laid over the SVG. */
export function mapPercent(point: Pick<Vec3, 'x' | 'z'>): { left: number; top: number } {
  const scale = 100 / (MAP_RADIUS * 2);
  return {
    left: (point.x + MAP_RADIUS) * scale,
    top: (point.z + MAP_RADIUS) * scale,
  };
}
