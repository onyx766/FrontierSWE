import { ROAD_WIDTH, type RoadStyle } from '@/universe/world/network';
import type { SectionPath, SectionPoint } from './sweep';

/**
 * The cross-section of each road family. `x` is right of the centreline and `y`
 * above the deck top. The families deliberately differ in silhouette: the Ring
 * is a heavy box girder with inset channels, a Spoke a beam with a hot spine, the
 * Core Loop a slim ceramic band, the Helix a thin fish-belly ribbon on a truss.
 *
 * Everything outside `width / 2 - 0.55` is out of the robot's reach, which is
 * where the channels, curbs and rails live.
 */

/** A thin glowing band and what drives its colour. */
export interface LightBand {
  path: SectionPath;
  role: 'edge' | 'inset' | 'spine' | 'skirt' | 'diffuser';
}

export interface RoadSection {
  /** Faces carrying the style's deck textures. */
  deck: SectionPath[];
  /** Faces carrying the hull textures that stay visible over an island deck. */
  channels: SectionPath[];
  /**
   * The chamfers and side faces, built where exposed. Light strips run on these, so
   * they use the same stations as the strips, or a coarser chord would bury them.
   */
  sides: SectionPath[];
  /** Everything below the sides, built where exposed with as few stations as will do. */
  hull: SectionPath[];
  lights: LightBand[];
  /** Lateral offset of the rail posts, or null for a road with no rails. */
  railOffset: number | null;
  railHeight: number;
  /** Offset of the deepest structural members, for clamps and trusses. */
  keelHalfWidth: number;
  keelDepth: number;
}

/**
 * Small per-style height offsets. Roads overlap at every junction and lie on the
 * island decks, so coplanar faces would fight. The order here is the stacking
 * order, and the walking surface does not notice a few hundredths of a unit.
 */
export const ROAD_LIFT: Record<RoadStyle, number> = {
  coreLoop: 0.004,
  spur: 0.014,
  islandLoop: 0.02,
  link: 0.024,
  helix: 0.03,
  ring: 0.034,
  spoke: 0.038,
};

export const MINOR_PLATE_LIFT = 0.042;
export const MAJOR_PLATE_LIFT = 0.05;

/** Reflect a path across the centreline, keeping its winding. */
function mirror(path: SectionPath): SectionPath {
  return [...path].reverse().map((point): SectionPoint => ({ ...point, x: -point.x }));
}

function both(path: SectionPath): SectionPath[] {
  return [path, mirror(path)];
}

/** A strip with a centre line, so that it can be bright down the middle and soft at its edges. */
function strip(a: SectionPoint, b: SectionPoint): SectionPath {
  const middle: SectionPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (a.flushY !== undefined && b.flushY !== undefined) middle.flushY = (a.flushY + b.flushY) / 2;
  return [a, middle, b];
}

function bothLights(a: SectionPoint, b: SectionPoint, role: LightBand['role']): LightBand[] {
  return both(strip(a, b)).map((mirrored) => ({ path: mirrored, role }));
}

function flatRun(...xs: number[]): SectionPath {
  return xs.map((x) => ({ x, y: 0 }));
}

/**
 * The road's outer solid, split at `split` into the sides and the belly. The belly
 * is meshed more coarsely, so each part overlaps the next a little: on a curve the
 * polygons differ by a hair, and a lip is what shows there, not the sky.
 */
function hullOutline(
  half: readonly [number, number][],
  split: number,
): Pick<RoadSection, 'sides' | 'hull'> {
  const points: SectionPoint[] = half.map(([x, y]) => ({ x, y }));
  const [first] = points;
  if (!first) throw new Error('Empty hull outline');

  const side = points.slice(0, split + 1);
  const belly = points.slice(split);
  const tuck: SectionPoint = { x: (belly[0] as SectionPoint).x - 0.1, y: (belly[0] as SectionPoint).y + 0.02 };

  return {
    sides: both(side),
    hull: [[tuck, ...belly, ...mirror([tuck, ...belly])]],
  };
}

function ringSection(): RoadSection {
  const half = ROAD_WIDTH.ring / 2;
  const channelIn = half - 0.58;
  const channelOut = half - 0.26;
  const floor = -0.11;
  /* Over an island the road is flush, so its channels must stay above the deck. */
  const floorFlush = -0.02;

  const channel: SectionPath = [
    { x: channelIn, y: 0 },
    { x: channelIn, y: floor, flushY: floorFlush },
    { x: channelOut, y: floor, flushY: floorFlush },
    { x: channelOut, y: 0 },
  ];

  return {
    deck: [
      flatRun(-channelIn, -1.42, -0.71, 0, 0.71, 1.42, channelIn),
      ...both(flatRun(channelOut, half)),
    ],
    channels: both(channel),
    ...hullOutline(
      [
        [half, 0],
        [half + 0.1, -0.1],
        [half + 0.1, -0.36],
        [half - 0.2, -0.44],
        [half - 0.95, -0.8],
      ],
      2,
    ),
    lights: [
      ...bothLights(
        { x: channelIn + 0.135, y: floor + 0.012, flushY: floorFlush + 0.008 },
        { x: channelOut - 0.135, y: floor + 0.012, flushY: floorFlush + 0.008 },
        'inset',
      ),
      ...bothLights(
        { x: half + 0.036, y: -0.03 },
        { x: half + 0.064, y: -0.058 },
        'edge',
      ),
      ...bothLights(
        { x: half + 0.105, y: -0.15 },
        { x: half + 0.105, y: -0.31 },
        'diffuser',
      ),
      ...bothLights(
        { x: half + 0.109, y: -0.205 },
        { x: half + 0.109, y: -0.255 },
        'skirt',
      ),
    ],
    railOffset: half - 0.13,
    railHeight: 0.62,
    keelHalfWidth: half - 0.95,
    keelDepth: 0.8,
  };
}

function spokeSection(): RoadSection {
  const half = ROAD_WIDTH.spoke / 2;
  const spine = 0.3;
  const floor = -0.075;

  return {
    deck: [flatRun(-half, -1.12, -spine), flatRun(spine, 1.12, half)],
    channels: [
      [
        { x: -spine, y: 0 },
        { x: -spine, y: floor },
        { x: spine, y: floor },
        { x: spine, y: 0 },
      ],
    ],
    ...hullOutline(
      [
        [half, 0],
        [half + 0.09, -0.09],
        [half + 0.09, -0.27],
        [half - 0.3, -0.34],
        [half - 0.82, -0.62],
      ],
      2,
    ),
    lights: [
      {
        path: strip({ x: -spine + 0.03, y: floor + 0.012 }, { x: spine - 0.03, y: floor + 0.012 }),
        role: 'diffuser',
      },
      {
        path: strip({ x: -0.07, y: floor + 0.018 }, { x: 0.07, y: floor + 0.018 }),
        role: 'spine',
      },
      ...bothLights(
        { x: half + 0.032, y: -0.03 },
        { x: half + 0.058, y: -0.056 },
        'edge',
      ),
    ],
    railOffset: half - 0.12,
    railHeight: 0.55,
    keelHalfWidth: half - 0.82,
    keelDepth: 0.62,
  };
}

function coreLoopSection(): RoadSection {
  const half = ROAD_WIDTH.coreLoop / 2;
  return {
    deck: [flatRun(-half, -1.68, -0.84, 0, 0.84, 1.68, half)],
    channels: [],
    ...hullOutline(
      [
        [half, 0],
        [half + 0.07, -0.07],
        [half + 0.07, -0.2],
        [half - 0.32, -0.28],
        [half - 0.75, -0.46],
      ],
      2,
    ),
    lights: [
      ...bothLights(
        { x: half + 0.026, y: -0.025 },
        { x: half + 0.05, y: -0.05 },
        'edge',
      ),
      ...bothLights(
        { x: half - 0.32, y: 0.006 },
        { x: half - 0.28, y: 0.006 },
        'inset',
      ),
    ],
    railOffset: half - 0.12,
    railHeight: 0.5,
    keelHalfWidth: half - 0.75,
    keelDepth: 0.46,
  };
}

function helixSection(): RoadSection {
  const half = ROAD_WIDTH.helix / 2;
  return {
    deck: [flatRun(-half, -1.28, -0.64, 0, 0.64, 1.28, half)],
    channels: [],
    ...hullOutline(
      [
        [half, 0],
        [half + 0.08, -0.08],
        [half + 0.08, -0.2],
        [half - 0.3, -0.36],
        [half - 0.85, -0.55],
      ],
      2,
    ),
    lights: [
      ...bothLights(
        { x: half + 0.028, y: -0.026 },
        { x: half + 0.052, y: -0.05 },
        'edge',
      ),
      ...bothLights(
        { x: half - 0.285, y: 0.006 },
        { x: half - 0.25, y: 0.006 },
        'inset',
      ),
      ...bothLights(
        { x: half + 0.088, y: -0.125 },
        { x: half + 0.088, y: -0.16 },
        'skirt',
      ),
    ],
    railOffset: half - 0.12,
    railHeight: 0.58,
    keelHalfWidth: half - 0.85,
    keelDepth: 0.55,
  };
}

function inlaySection(style: 'islandLoop' | 'link' | 'spur'): RoadSection {
  const half = ROAD_WIDTH[style] / 2;
  return {
    deck: [
      [
        { x: -half - 0.05, y: -0.02 },
        { x: -half, y: 0 },
      ],
      flatRun(-half, half),
      [
        { x: half, y: 0 },
        { x: half + 0.05, y: -0.02 },
      ],
    ],
    channels: [],
    sides: [],
    hull: [],
    lights: [],
    railOffset: null,
    railHeight: 0,
    keelHalfWidth: 0,
    keelDepth: 0,
  };
}

export const ROAD_SECTIONS: Record<RoadStyle, RoadSection> = {
  ring: ringSection(),
  spoke: spokeSection(),
  coreLoop: coreLoopSection(),
  helix: helixSection(),
  islandLoop: inlaySection('islandLoop'),
  link: inlaySection('link'),
  spur: inlaySection('spur'),
};

/** A slim three-sided tube along the rail posts. Its apex faces up, so it reads from any height. */
export function railPath(x: number, height: number, radius = 0.013): SectionPath {
  return [
    { x, y: height + radius },
    { x: x + radius, y: height - radius * 0.6 },
    { x: x - radius, y: height - radius * 0.6 },
    { x, y: height + radius },
  ];
}
