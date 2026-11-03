import type { IslandAccent } from '@/data/universe';
import type { RoadStyle } from '../world/network';

/**
 * The universe palette as plain strings, for inline SVG.
 *
 * `scene/palette.ts` is the source of these values, but it imports three.js for
 * its `hdr()` helper and the HUD is in the first-load bundle, so it cannot be
 * imported from here. Keep the two in step.
 */

export const ACCENT_HEX: Record<IslandAccent, string> = {
  violet: '#8a5cff',
  blue: '#3f9dff',
  orange: '#ff9238',
  cyan: '#58d8ff',
};

/** Map colour and stroke width, in screen pixels, of each road family. */
export const ROAD_STROKE: Record<RoadStyle, { color: string; width: number }> = {
  ring: { color: '#8fc2ff', width: 2.2 },
  coreLoop: { color: '#58a8ff', width: 1.5 },
  spoke: { color: '#ff9f55', width: 1.5 },
  helix: { color: '#b98aff', width: 1.3 },
  islandLoop: { color: '#6d7f9e', width: 1 },
  link: { color: '#6d7f9e', width: 1 },
  spur: { color: '#6d7f9e', width: 0.8 },
};
