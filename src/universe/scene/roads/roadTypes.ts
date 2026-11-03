import {
  ROAD_WIDTH,
  type RoadEdge,
  type RoadNetwork,
  type RoadStyle,
} from '@/universe/world/network';
import type { WalkSurface } from '@/universe/world/surface';
import type { RoadSection } from './sections';
import type { Frame, MeshBuffer } from './sweep';

/**
 * What the road layer draws: one merged buffer per material, plus the placements
 * of the few things that are instanced. Pure data with no GPU objects, so it can
 * be checked in plain Node.
 *
 * Meaning of the four `lights` values per vertex:
 *   lit materials (decks, hull, plates)  rgb tints the emissive mask, a is how
 *                                        much of that colour pools on the metal
 *   unlit materials (lights, decals)     rgb is the HDR colour itself
 */

export type DeckFamily = 'ring' | 'spoke' | 'coreLoop' | 'helix' | 'inlay';

export const DECK_FAMILIES: readonly DeckFamily[] = [
  'ring',
  'spoke',
  'coreLoop',
  'helix',
  'inlay',
];

/** Size of one deck texture tile, in world units. */
export const DECK_TILE: Record<DeckFamily, { across: number; along: number }> = {
  ring: { across: ROAD_WIDTH.ring, along: 10.8 },
  spoke: { across: ROAD_WIDTH.spoke, along: 7.6 },
  coreLoop: { across: ROAD_WIDTH.coreLoop, along: 8.4 },
  helix: { across: ROAD_WIDTH.helix, along: 6.8 },
  inlay: { across: ROAD_WIDTH.islandLoop, along: 6 },
};

/** World units per repeat of the hull texture. */
export const HULL_TILE = 6;
/** World units per repeat of the flowing pulse in the light strips. */
export const FLOW_TILE = 26;

export interface PostPlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  height: number;
}

export interface GlowPlacement {
  x: number;
  y: number;
  z: number;
  size: number;
  color: [number, number, number];
}

export interface RoadBuild {
  decks: Record<DeckFamily, MeshBuffer>;
  hull: MeshBuffer;
  lights: MeshBuffer;
  decals: MeshBuffer;
  plates: MeshBuffer;
  posts: PostPlacement[];
  glows: GlowPlacement[];
}

/** Everything the assembly steps need to know about the road being built. */
export interface EdgeContext {
  edge: RoadEdge;
  style: RoadStyle;
  /** Every station: for anything that must land at an exact distance along the road. */
  frames: Frame[];
  /** Enough stations to keep a curve smooth to the eye: decks, strips and rails. */
  smooth: Frame[];
  /** The fewest that will do: hull sides that the eye never follows closely. */
  coarse: Frame[];
  section: RoadSection;
  lift: number;
  build: RoadBuild;
  network: RoadNetwork;
  surface: Pick<WalkSurface, 'contains'>;
}
