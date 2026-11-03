import type { StationAnchor } from '../../world/stations';

/**
 * The hologram's size. Pure, because framing is a contract with the station
 * camera: `__tests__/holoFraming.test.ts` holds every station to it.
 */

/** Panel size before `holoScale`. A station with no model to show needs less width. */
export const PANEL = {
  height: 3.4,
  widthWithModel: 5.9,
  widthTextOnly: 4.4,
  radius: 0.15,
} as const;

/** Tallest the panel can be while still clearing the robot's head in the station shot. */
const ISLAND_SCALE = 1.3;
/** The stop at the crystal is seen from about 1.6 times as far as an island stop. */
const CORE_SCALE = 1.95;

export function holoScale(anchor: Pick<StationAnchor, 'islandId'>): number {
  return anchor.islandId === null ? CORE_SCALE : ISLAND_SCALE;
}

/** Below this aspect the station shot is too narrow for the full panel. */
const FULL_SIZE_ASPECT = 1.28;
const SMALLEST_FIT = 0.33;

/**
 * Extra scale for a narrow screen. A phone's bottom sheet carries the words, so
 * there the panel is scenery: better whole and small than cropped by the frame.
 */
export function narrowFit(aspect: number): number {
  return Math.max(SMALLEST_FIT, Math.min(1, aspect / FULL_SIZE_ASPECT));
}
