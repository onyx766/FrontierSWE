import { ROAD_WIDTH } from '@/universe/world/network';
import type { Vec3 } from '@/universe/world/vec';
import {
  deckCover,
  isElevated,
  ringDeckAt,
  runsWhere,
  stationsAlong,
  trussDepthAt,
  type Crossing,
  type Run,
} from './layout';
import { helixLight, scaled, COOL } from './roadLight';
import { HULL_TILE, FLOW_TILE, type EdgeContext } from './roadTypes';
import {
  addBeam,
  addCable,
  addRevolve,
  limitLateral,
  type Frame,
  type RevolvePoint,
  type Rgba,
} from './sweep';

/**
 * The heavy engineering under and around the roads. Everything here is merged into
 * the hull or light buffers, and all of it stands outside the walkable width: a
 * road's walkable half-width is `width / 2 - 0.55`.
 */

/** World position of a point in a road's section. */
export function atFrame(frame: Frame, lateral: number, height: number, lift = 0): Vec3 {
  const offset = limitLateral(lateral, frame);
  return {
    x: frame.x + frame.rx * offset,
    y: frame.y + height + lift,
    z: frame.z + frame.rz * offset,
  };
}

/** The station nearest a distance along the road. */
export function stationAt(frames: readonly Frame[], s: number): number {
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((frames[middle] as Frame).s < s) low = middle;
    else high = middle;
  }
  const below = Math.abs((frames[low] as Frame).s - s);
  const above = Math.abs((frames[high] as Frame).s - s);
  return below < above ? low : high;
}

function offsetAlong(point: Vec3, frame: Frame, distance: number): Vec3 {
  return {
    x: point.x + frame.tx * distance,
    y: point.y + frame.ty * distance,
    z: point.z + frame.tz * distance,
  };
}

/** Runs of a road that are exposed: not wholly swallowed by an island platform. */
export function exposedRuns(frames: readonly Frame[], halfWidth: number): Run[] {
  return runsWhere(frames, (frame) => {
    const left = atFrame(frame, -halfWidth, 0);
    const right = atFrame(frame, halfWidth, 0);
    return deckCover(left.x, left.z) < 1 || deckCover(right.x, right.z) < 1;
  });
}

/** Spaced clamps break the Ring's side strips, as in the reference's segmented light bars. */
export const CLAMP_PERIOD = 9;
export const CLAMP_GAP = 1.9;

/** Saddles and under-frames at each break in the Ring's side strips. */
export function buildRingFrames(context: EdgeContext, exposed: readonly Run[]): void {
  const { frames, section, lift, build } = context;
  const half = ROAD_WIDTH.ring / 2;
  const tint = scaled(COOL, 1, 0.5);
  const options = { tile: HULL_TILE, caps: true, light: tint };

  for (const run of exposed) {
    const first = (frames[run.from] as Frame).s;
    const last = (frames[run.to] as Frame).s;
    const start = Math.ceil(first / CLAMP_PERIOD) * CLAMP_PERIOD;

    for (let s = start; s < last; s += CLAMP_PERIOD) {
      const frame = frames[stationAt(frames, s + CLAMP_GAP / 2 - CLAMP_PERIOD / 2)] as Frame;
      if (frame.s < first || frame.s > last) continue;

      for (const side of [-1, 1]) {
        const out = atFrame(frame, (half + 0.22) * side, 0);
        if (deckCover(out.x, out.z) > 0) continue;

        const center = atFrame(frame, (half + 0.2) * side, -0.24, lift);

        /* The saddle itself, and a heavier lug at each end. */
        addBeam(build.hull, offsetAlong(center, frame, -0.78), offsetAlong(center, frame, 0.78), 0.16, 0.42, options);
        for (const end of [-0.74, 0.74]) {
          const lug = offsetAlong(center, frame, end);
          addBeam(build.hull, offsetAlong(lug, frame, -0.11), offsetAlong(lug, frame, 0.11), 0.27, 0.56, options);
        }

        /* A rib from the saddle down to the girder's belly. */
        const rib = atFrame(frame, (half + 0.05) * side, -0.42, lift);
        const belly = atFrame(frame, (section.keelHalfWidth + 0.1) * side, -section.keelDepth - 0.06, lift);
        addBeam(build.hull, rib, belly, 0.3, 0.12, options);
      }

      const left = atFrame(frame, -section.keelHalfWidth - 0.28, -section.keelDepth - 0.05, lift);
      const right = atFrame(frame, section.keelHalfWidth + 0.28, -section.keelDepth - 0.05, lift);
      addBeam(build.hull, left, right, 0.42, 0.13, options);
    }
  }
}

function lightAt(tint: ReturnType<typeof helixLight>, frame: Frame): Rgba {
  const out: Rgba = { r: 1, g: 1, b: 1, a: 0 };
  tint(frame.x, frame.y, frame.z, 0, frame, out);
  return out;
}

/** The Helix's exposed space truss: a keel chord hung from the deck by zig-zag struts. */
export function buildTruss(context: EdgeContext, crossings: readonly Crossing[]): void {
  const { frames, section, lift, build } = context;
  const nominal = 0.85;
  const hullTint = helixLight(1, 0.42);
  const lineTint = helixLight(1.7, 0);

  for (const run of runsWhere(frames, isElevated, 6)) {
    const nodes = stationsAlong(frames, run, 1.25);
    let chordBefore: Vec3 | null = null;

    nodes.forEach((station, index) => {
      const frame = frames[station] as Frame;
      const depth = trussDepthAt(frame, nominal, crossings, frames);
      if (depth <= 0.12) {
        chordBefore = null;
        return;
      }

      const keel = section.keelDepth;
      const chord = atFrame(frame, 0, -keel - depth, lift);
      const light = lightAt(hullTint, frame);

      if (chordBefore) {
        addBeam(build.hull, chordBefore, chord, 0.13, 0.13, { tile: HULL_TILE, light });
        addBeam(
          build.lights,
          { ...chordBefore, y: chordBefore.y - 0.08 },
          { ...chord, y: chord.y - 0.08 },
          0.03,
          0.018,
          { tile: FLOW_TILE, light: lightAt(lineTint, frame) },
        );
        build.lights.padSpreads();
      }
      chordBefore = chord;

      /* Every other node carries four struts up to the corners of the deck's keel. */
      if (index % 2 === 1) {
        for (const step of [-1, 1]) {
          const neighbour = frames[nodes[index + step] ?? station] as Frame;
          for (const side of [-1, 1]) {
            const top = atFrame(neighbour, section.keelHalfWidth * side, -keel + 0.03, lift);
            addBeam(build.hull, top, chord, 0.07, 0.07, { tile: HULL_TILE, light });
          }
        }
      }
    });
  }
}

/** Height of a bridge's pylons above the Helix deck. */
const PYLON_RISE = 3.15;

/**
 * Portal frames either side of a crossing.
 *
 * Over the Ring, two pairs of columns stand clear of its edges and carry the Helix
 * on cross-girders. They rise past the deck as pylons, and a fan of cables stays
 * the span, so a bridge reads as one from anywhere. Below the deck they are braced
 * across the faces the Ring does not pass through, and tied together under its keel.
 *
 * Under the Ring, the same cage hangs the Helix from a pair of headers beneath the
 * Ring's keel, braced along the Helix's sides, the one face the road does not cross.
 */
export function buildPortals(context: EdgeContext, crossings: readonly Crossing[]): void {
  const { frames, section, lift, build } = context;
  const half = ROAD_WIDTH.helix / 2;
  const reach = half + 0.32;
  const hullTint = helixLight(1, 0.5);

  for (const crossing of crossings) {
    const outer = frames[crossing.outer] as Frame;
    const inner = frames[crossing.inner] as Frame;
    const over = crossing.kind === 'over';
    const light = lightAt(hullTint, outer);

    const beam = (a: Vec3, b: Vec3, size: number, taper = 1) => {
      addBeam(build.hull, a, b, size, size, { tile: HULL_TILE, caps: true, taper, light });
    };

    const columns = [outer, inner].map((frame) =>
      [-1, 1].map((side) => {
        const plan = atFrame(frame, reach * side, 0);
        const ring = ringDeckAt(plan.x, plan.z);
        return {
          frame,
          foot: { ...plan, y: over ? ring - 1.04 : frame.y - section.keelDepth - 0.14 + lift },
          head: { ...plan, y: over ? frame.y + PYLON_RISE + lift : ring - 1.04 },
        };
      }),
    ) as [
      [Column, Column],
      [Column, Column],
    ];

    for (const [left, right] of columns) {
      beam(left.foot, left.head, 0.36, 0.56);
      beam(right.foot, right.head, 0.36, 0.56);

      const girder = over ? left.frame.y - section.keelDepth - 0.12 + lift : left.foot.y;
      beam({ ...left.foot, y: girder }, { ...right.foot, y: girder }, 0.3);

      if (over) {
        /* Portal tie across the top of the pylons, and an X below the deck. */
        beam(left.head, right.head, 0.17);
        const under = girder - 0.1;
        beam(left.foot, { ...right.foot, y: under }, 0.12);
        beam(right.foot, { ...left.foot, y: under }, 0.12);

        /* A light across the tie, so the bridge marks itself from the Ring. */
        addBeam(
          build.lights,
          { ...left.head, y: left.head.y - 0.1 },
          { ...right.head, y: right.head.y - 0.1 },
          0.05,
          0.04,
          { tile: FLOW_TILE, light: scaled(light, 3.4) },
        );
        build.lights.padSpreads();
      }
    }

    const [outerPair, innerPair] = columns;
    for (const side of [0, 1] as const) {
      const a = outerPair[side];
      const b = innerPair[side];
      if (over) {
        beam(a.foot, b.foot, 0.28);
      } else {
        beam(a.head, b.head, 0.28);
        beam(a.foot, b.head, 0.11);
        beam(b.foot, a.head, 0.11);
      }
    }

    if (over) buildStays(context, crossing, columns);

    for (const pair of columns) {
      for (const column of pair) {
        const lamp = over ? column.head : column.foot;
        build.glows.push({
          x: lamp.x,
          y: lamp.y,
          z: lamp.z,
          size: 2.6,
          color: [light.r * 0.2, light.g * 0.2, light.b * 0.2],
        });
      }
    }
  }
}

interface Column {
  frame: Frame;
  foot: Vec3;
  head: Vec3;
}

/** A fan of stays from each pylon head to the deck's edge, either side of the portal. */
function buildStays(
  context: EdgeContext,
  crossing: Crossing,
  columns: readonly (readonly [Column, Column])[],
): void {
  const { frames, lift, build } = context;
  const half = ROAD_WIDTH.helix / 2;
  const tint = helixLight(1.05, 0);
  const center = (frames[crossing.center] as Frame).s;

  for (const pair of columns) {
    pair.forEach((column, index) => {
      const side = index === 0 ? -1 : 1;
      const own = column.frame.s;
      const toSpan = Math.sign(center - own);
      for (const distance of [-4.6, -2.3, 1.75, 3.5]) {
        const frame = frames[stationAt(frames, own + distance * toSpan)] as Frame;
        const anchor = atFrame(frame, (half + 0.06) * side, -0.02, lift);
        addCable(build.lights, column.head, anchor, 0.006, lightAt(tint, frame));
      }
    });
  }
}

const hullRevolveUv = (angle: number, _point: RevolvePoint, around: number): [number, number] => [
  (angle * 2) / HULL_TILE,
  around / HULL_TILE,
];

/**
 * A hairpin as tight as these needs a reason to exist. Each turns around a slim
 * mast at its centre of curvature, with the deck's inner edge tied back to it and
 * its outer edge stayed from the mast head, so the bend reads as a spiral ramp.
 */
export function buildHairpinMast(context: EdgeContext): number {
  const { frames, lift, build } = context;
  const half = ROAD_WIDTH.helix / 2;

  let tip = 0;
  let tightest = 0;
  frames.forEach((frame, index) => {
    if (isElevated(frame) && Math.abs(frame.bend) > tightest) {
      tightest = Math.abs(frame.bend);
      tip = index;
    }
  });

  const tipFrame = frames[tip] as Frame;
  const toInside = Math.sign(tipFrame.bend);
  const standoff = (1 / tightest) * 1.02 + 0.3;
  const center: Vec3 = {
    x: tipFrame.x + tipFrame.rx * toInside * standoff,
    y: tipFrame.y,
    z: tipFrame.z + tipFrame.rz * toInside * standoff,
  };

  const low = -3.1;
  const high = 4.7;
  const tint = scaled(lightAt(helixLight(1, 0), tipFrame), 1, 0.6);
  const profile: RevolvePoint[] = [
    { r: 0.01, y: high + 0.42 },
    { r: 0.09, y: high + 0.3 },
    { r: 0.09, y: high + 0.08 },
    { r: 0.21, y: high },
    { r: 0.21, y: high - 0.14 },
    { r: 0.12, y: high - 0.22 },
    { r: 0.15, y: 1 },
    { r: 0.24, y: 0.82 },
    { r: 0.24, y: 0.62 },
    { r: 0.16, y: 0.5 },
    { r: 0.19, y: low + 0.5 },
    { r: 0.34, y: low + 0.2 },
    { r: 0.34, y: low },
    { r: 0.01, y: low - 0.2 },
  ];
  addRevolve(build.hull, center, profile, { segments: 12, uv: hullRevolveUv, light: tint });

  /* The lit collar at the mast head, seen as a small ring of light from anywhere. */
  addRevolve(
    build.lights,
    center,
    [
      { r: 0.222, y: high - 0.02 },
      { r: 0.222, y: high - 0.12 },
    ],
    {
      segments: 12,
      uv: () => [0, 0],
      light: scaled(tint, 4),
    },
  );
  build.lights.padSpreads();

  const head: Vec3 = { x: center.x, y: center.y + high - 0.05, z: center.z };
  const collar: Vec3 = { x: center.x, y: center.y + 0.72, z: center.z };
  const stayTint = helixLight(1.05, 0);

  /* Struts from the mast's mid collar to the deck's inner edge, and a fan of stays above. */
  const spread = 5.2;
  const count = 6;
  for (let step = 0; step <= count; step += 1) {
    const s = tipFrame.s - spread + (spread * 2 * step) / count;
    const frame = frames[stationAt(frames, s)] as Frame;
    const edge = atFrame(frame, (half + 0.06) * -toInside, -0.02, lift);
    if (step % 2 === 0) addCable(build.lights, head, edge, 0.006, lightAt(stayTint, frame));

    const inner = atFrame(frame, (half - 0.2) * toInside, -0.36, lift);
    addBeam(build.hull, { ...collar, y: inner.y + 0.08 }, inner, 0.09, 0.09, {
      tile: HULL_TILE,
      light: tint,
    });
  }

  build.glows.push({
    x: head.x,
    y: head.y,
    z: head.z,
    size: 2.2,
    color: [tint.r * 0.2, tint.g * 0.2, tint.b * 0.2],
  });

  return tipFrame.s;
}
