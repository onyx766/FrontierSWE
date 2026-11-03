import { coreStation } from '@/data/universe';
import { WORLD, type RoadEdge, type RoadNetwork, type RoadStyle } from '@/universe/world/network';
import type { WalkSurface } from '@/universe/world/surface';
import { polar, type Vec3 } from '@/universe/world/vec';
import { buildDecals, buildHairpinDecals, buildRoadNames } from './decals';
import { buildJunctions, buildLandingGate, MAJOR_RADIUS } from './junctions';
import {
  deckCover,
  findCrossings,
  railRuns,
  runsWhere,
  stationsAlong,
  type Run,
} from './layout';
import { deckLight, hullLight, railLight, solid, stripLight, WARM } from './roadLight';
import {
  DECK_TILE,
  FLOW_TILE,
  HULL_TILE,
  type DeckFamily,
  type EdgeContext,
  type RoadBuild,
} from './roadTypes';
import { railPath, ROAD_LIFT, ROAD_SECTIONS, type LightBand } from './sections';
import {
  atFrame,
  buildHairpinMast,
  buildPortals,
  buildRingFrames,
  buildTruss,
  CLAMP_GAP,
  CLAMP_PERIOD,
  exposedRuns,
} from './structures';
import {
  buildFrames,
  MeshBuffer,
  refine,
  sweep,
  thin,
  type Frame,
  type SectionPoint,
} from './sweep';

/**
 * Everything the road layer draws, assembled from the network into one buffer per
 * material. See `roadTypes.ts` for the shape of the result.
 */

/** How far a mesh edge may stray from the true curve. Allows two-unit chords on the Ring. */
export const SMOOTH_TOLERANCE = 0.012;

function deckFamily(style: RoadStyle): DeckFamily {
  if (style === 'islandLoop' || style === 'link' || style === 'spur') return 'inlay';
  return style;
}

/** Strips that add richness up close and only noise from the opening shot. */
const DETAIL_ROLES: ReadonlySet<LightBand['role']> = new Set(['inset']);

/** Brightness at a strip's edges, relative to its centre line. */
const EDGE_FADE: Record<LightBand['role'], number> = {
  edge: 0.04,
  inset: 0.04,
  spine: 0.08,
  skirt: 0.06,
  diffuser: 0,
};

/** The hot lines the eye goes to from the opening shot hold more than a pixel of width. */
const MIN_WIDTH: Record<LightBand['role'], number> = {
  edge: 1,
  inset: 1,
  spine: 1.7,
  skirt: 1.3,
  diffuser: 2.6,
};

/** The Ring's thin orange lane marks: a long dash and a short one, repeating. */
const DASH_PERIOD = 5.4;
const DASHES: readonly [number, number][] = [
  [0.5, 2.3],
  [2.9, 3.4],
];

const PAD_CENTER: Vec3 = polar(WORLD.coreLoopRadius, coreStation.bearing, WORLD.coreLoopY);
/** The Core Loop stops short of the pad in front of the crystal, which sits on its own seat. */
const PAD_CLEARANCE = WORLD.corePadRadius - 0.2;

function deckRuns(edge: RoadEdge, frames: readonly Frame[]): Run[] {
  /* A spur is almost all under its pad: stop just past the rim, so the two barely overlap. */
  if (edge.style === 'spur') return runsWhere(frames, (frame) => frame.s <= 0.95);
  if (edge.style === 'coreLoop') {
    return runsWhere(
      frames,
      (frame) => Math.hypot(frame.x - PAD_CENTER.x, frame.z - PAD_CENTER.z) > PAD_CLEARANCE,
    );
  }
  return [{ from: 0, to: frames.length - 1 }];
}

/**
 * Strips are drawn with a depth bias to hold them off the metal, which would also
 * carry them through a junction plate lying a hair above them. So they stop at the
 * plate's rim, and the plate's own ring of light takes over.
 */
function clearOfPlates(frames: readonly Frame[], network: RoadNetwork, runs: readonly Run[]): Run[] {
  const majors = network.junctions.filter((junction) => junction.kind === 'major');
  const reach = MAJOR_RADIUS + 0.1;
  return runs.flatMap((run) =>
    runsWhere(frames, (frame, index) => {
      if (index < run.from || index > run.to) return false;
      return majors.every(
        ({ position }) => Math.hypot(frame.x - position.x, frame.z - position.z) > reach,
      );
    }),
  );
}

function sweepDeck({ edge, style, smooth, section, lift, build }: EdgeContext, runs: Run[]): void {
  const family = deckFamily(style);
  const tile = DECK_TILE[family];
  const half = edge.width / 2;
  const light = deckLight(edge);

  for (const run of runs) {
    for (const path of section.deck) {
      sweep(build.decks[family], smooth, path, {
        lift,
        from: run.from,
        to: run.to,
        flush: deckCover,
        u: (point) => (point.x + half) / (half * 2),
        v: (frame) => frame.s / tile.along,
        light,
      });
    }
  }
}

function sweepHull(context: EdgeContext, deck: readonly Run[]): void {
  const { edge, smooth, coarse, section, lift, build } = context;
  const options = {
    lift,
    flush: deckCover,
    u: (_point: SectionPoint, perimeter: number) => perimeter / HULL_TILE,
    v: (frame: Frame) => frame.s / HULL_TILE,
    light: hullLight(edge),
  };

  for (const run of deck) {
    for (const path of section.channels) {
      sweep(build.hull, smooth, path, { ...options, from: run.from, to: run.to });
    }
  }
  for (const run of exposedRuns(smooth, edge.width / 2 + 0.2)) {
    for (const path of section.sides) {
      sweep(build.hull, smooth, path, { ...options, from: run.from, to: run.to });
    }
  }
  for (const run of exposedRuns(coarse, edge.width / 2 + 0.2)) {
    for (const path of section.hull) {
      sweep(build.hull, coarse, path, { ...options, from: run.from, to: run.to });
    }
  }
}

/** Lateral extreme of a section path, which says the side of the road it is on. */
function pathReach(path: readonly SectionPoint[]): number {
  return path.reduce((reach, point) => (Math.abs(point.x) > Math.abs(reach) ? point.x : reach), 0);
}

function sweepLights(context: EdgeContext, deck: readonly Run[]): void {
  const { edge, frames, smooth, section, lift, build, network } = context;
  const exposed = exposedRuns(smooth, edge.width / 2 + 0.2);
  const onDeck = clearOfPlates(smooth, network, deck);

  for (const band of section.lights) {
    const options = {
      lift,
      flush: deckCover,
      u: (_point: SectionPoint, perimeter: number) => perimeter,
      v: (frame: Frame) => frame.s / FLOW_TILE,
      light: stripLight(edge, band.role),
      spread: DETAIL_ROLES.has(band.role) ? ('detail' as const) : ('line' as const),
      edgeFade: EDGE_FADE[band.role],
      minWidth: MIN_WIDTH[band.role],
    };

    const segmented = edge.style === 'ring' && (band.role === 'skirt' || band.role === 'diffuser');
    if (!segmented) {
      for (const run of band.role === 'skirt' ? exposed : onDeck) {
        sweep(build.lights, smooth, band.path, { ...options, from: run.from, to: run.to });
      }
      continue;
    }

    /* The Ring's side bars break at each clamp, and only run where this side is clear of a deck. */
    const reach = pathReach(band.path);
    const bars = runsWhere(
      frames,
      (frame) => {
        const point = atFrame(frame, reach, 0);
        return deckCover(point.x, point.z) === 0 && frame.s % CLAMP_PERIOD > CLAMP_GAP;
      },
      1.5,
    );
    for (const bar of bars) {
      sweep(build.lights, frames, band.path, { ...options, from: bar.from, to: bar.to });
    }
  }
}

function buildLaneDashes({ frames, lift, build, network }: EdgeContext): void {
  const path = [
    { x: -0.05, y: 0.008 },
    { x: 0, y: 0.008 },
    { x: 0.05, y: 0.008 },
  ];
  const light = solid(WARM, 4);

  for (const [start, end] of DASHES) {
    const dashes = runsWhere(frames, (frame) => {
      const phase = frame.s % DASH_PERIOD;
      return phase >= start && phase <= end;
    });
    for (const run of clearOfPlates(frames, network, dashes)) {
      sweep(build.lights, frames, path, {
        lift,
        from: run.from,
        to: run.to,
        u: (_point, perimeter) => perimeter,
        v: (frame) => frame.s / FLOW_TILE,
        light,
        spread: 'line',
        edgeFade: 0,
      });
    }
  }
}

function buildRails(context: EdgeContext): void {
  const { edge, smooth, section, lift, build, surface } = context;
  if (section.railOffset === null) return;
  const light = railLight(edge);
  const metal = hullLight(edge);

  for (const side of [-1, 1]) {
    const offset = section.railOffset * side;
    for (const run of railRuns(smooth, offset, surface)) {
      sweep(build.lights, smooth, railPath(offset, section.railHeight), {
        lift,
        from: run.from,
        to: run.to,
        u: (_point, perimeter) => perimeter,
        v: (frame) => frame.s / FLOW_TILE,
        light,
        spread: 'detail',
      });

      /* A plain steel mid-rail, so the posts carry something that is not just light. */
      sweep(build.hull, smooth, railPath(offset, section.railHeight * 0.55, 0.018), {
        lift,
        from: run.from,
        to: run.to,
        u: (_point, perimeter) => perimeter / HULL_TILE,
        v: (frame) => frame.s / HULL_TILE,
        light: metal,
      });

      for (const station of stationsAlong(smooth, run, 2.2)) {
        const frame = smooth[station] as Frame;
        build.posts.push({
          ...atFrame(frame, offset, 0, lift),
          yaw: Math.atan2(frame.tx, frame.tz),
          height: section.railHeight,
        });
      }
    }
  }
}

function buildEdge(
  edge: RoadEdge,
  build: RoadBuild,
  network: RoadNetwork,
  surface: EdgeContext['surface'],
): void {
  const refined = refine(edge.points);
  const frames = buildFrames(refined);
  const smooth = buildFrames(thin(refined, SMOOTH_TOLERANCE, 2.6));
  const context: EdgeContext = {
    edge,
    style: edge.style,
    frames,
    smooth,
    coarse: buildFrames(thin(refined, 0.03, 4)),
    section: ROAD_SECTIONS[edge.style],
    lift: ROAD_LIFT[edge.style],
    build,
    network,
    surface,
  };

  const deck = deckRuns(edge, smooth);
  sweepDeck(context, deck);
  if (deckFamily(edge.style) === 'inlay') return;

  sweepHull(context, deck);
  sweepLights(context, deck);
  buildRails(context);
  buildDecals(context);

  switch (edge.style) {
    case 'ring':
      buildRingFrames(context, exposedRuns(frames, edge.width / 2 + 0.2));
      buildLaneDashes(context);
      buildRoadNames(context);
      break;
    case 'spoke':
      buildLandingGate(context);
      break;
    case 'helix': {
      const crossings = findCrossings(frames);
      buildTruss(context, crossings);
      buildPortals(context, crossings);
      buildHairpinDecals(context, buildHairpinMast(context));
      break;
    }
    default:
      break;
  }
}

export function buildRoads(
  network: RoadNetwork,
  surface: Pick<WalkSurface, 'contains'>,
): RoadBuild {
  const build: RoadBuild = {
    decks: {
      ring: new MeshBuffer(),
      spoke: new MeshBuffer(),
      coreLoop: new MeshBuffer(),
      helix: new MeshBuffer(),
      inlay: new MeshBuffer(),
    },
    hull: new MeshBuffer(),
    lights: new MeshBuffer(),
    decals: new MeshBuffer(),
    plates: new MeshBuffer(),
    posts: [],
    glows: [],
  };

  for (const edge of network.edges) buildEdge(edge, build, network, surface);
  buildJunctions(network, build);
  return build;
}
