import { islands } from '@/data/universe';
import { scaled, solid, STEEL_BLUE, VIOLET, WARM } from './roadLight';
import type { EdgeContext } from './roadTypes';
import { stationAt } from './structures';
import { sweep, type Frame, type Rgba } from './sweep';

/**
 * Painted road markings. They are additive, so black in the atlas leaves the deck
 * untouched, and they cost one draw call however many there are. Hazard bars warn
 * of junctions, chevrons give the direction of travel and warn of a hairpin, and
 * each island's name is painted across the Ring ahead of it, so that in a network
 * this tangled the road itself says where it leads.
 */

/** A rectangle of the decal atlas, in texture coordinates. */
export interface DecalCell {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export const DECAL_CELLS = {
  hazard: { u0: 0, u1: 1, v0: 0, v1: 0.125 },
  chevrons: { u0: 0, u1: 1, v0: 0.125, v1: 0.375 },
} as const satisfies Record<string, DecalCell>;

/** The name cells fill the rest of the atlas, one row per island. */
const NAMES_FROM = 0.375;

export function nameCell(index: number): DecalCell {
  const row = (1 - NAMES_FROM) / islands.length;
  return { u0: 0, u1: 1, v0: NAMES_FROM + index * row, v1: NAMES_FROM + (index + 1) * row };
}

/** What is painted for each island: its plate label on one line. */
export const ROAD_NAMES: readonly string[] = islands.map((island) =>
  island.label.replace('\n', ' '),
);

/** Height above the deck. Enough to clear lane strips, too little to see. */
const DECAL_RISE = 0.012;

function stamp(
  { frames, build, lift }: Pick<EdgeContext, 'frames' | 'build' | 'lift'>,
  fromS: number,
  toS: number,
  halfWidth: number,
  cell: DecalCell,
  tint: Rgba,
  /** Leave the middle of the road clear, out to this offset. */
  gap = 0,
  /** Which way the artwork faces, for artwork that has a right way up. */
  turn: 'along' | 'towards' | 'none' = 'none',
): void {
  const from = stationAt(frames, fromS);
  const to = stationAt(frames, toS);
  if (to <= from) return;

  const spanStart = (frames[from] as Frame).s;
  const spanEnd = (frames[to] as Frame).s;
  const spans: readonly (readonly number[])[] =
    gap > 0
      ? [
          [-halfWidth, -gap],
          [gap, halfWidth],
        ]
      : [[-halfWidth, -halfWidth / 2, 0, halfWidth / 2, halfWidth]];

  for (const span of spans) {
    sweep(
      build.decals,
      frames,
      span.map((x) => ({ x, y: DECAL_RISE })),
      {
        lift,
        from,
        to,
        u: (point) => {
          const across = (point.x / halfWidth + 1) / 2;
          return cell.u0 + (turn === 'towards' ? 1 - across : across) * (cell.u1 - cell.u0);
        },
        v: (frame) => {
          const along = (frame.s - spanStart) / (spanEnd - spanStart);
          return cell.v0 + (turn === 'along' ? 1 - along : along) * (cell.v1 - cell.v0);
        },
        light: solid(tint, 1),
      },
    );
  }
}

/**
 * Hazard blocks at the road's edges, `distance` from each end of it. They leave
 * the walking line clear, and mark the width of the road as it enters a junction.
 */
function hazardBars(
  context: EdgeContext,
  distance: number,
  halfWidth: number,
  tint: Rgba,
  length = 0.7,
): void {
  const end = (context.frames[context.frames.length - 1] as Frame).s;
  const inset = halfWidth * 0.58;

  for (const from of [distance, end - distance - length]) {
    stamp(context, from, from + length, halfWidth, DECAL_CELLS.hazard, tint, inset);
  }
}

export function buildDecals(context: EdgeContext): void {
  const { style, frames } = context;
  const end = (frames[frames.length - 1] as Frame).s;
  const amber = scaled(WARM, 0.5);

  switch (style) {
    case 'ring':
      hazardBars(context, 4.3, 2.08, amber);
      for (const s of [end * 0.36, end * 0.64]) {
        stamp(context, s, s + 2.2, 0.68, DECAL_CELLS.chevrons, scaled(WARM, 0.55));
      }
      break;
    case 'spoke':
      hazardBars(context, 4.4, 1.86, amber);
      break;
    case 'coreLoop':
      hazardBars(context, 4.2, 1.5, scaled(STEEL_BLUE, 0.3));
      break;
    default:
      break;
  }
}

/**
 * Where a stretch of Ring leads, painted across it for a visitor walking either way:
 * the next island near its end, reading along the road, and the last one near its
 * start, turned to face the other way round the Ring.
 */
export function buildRoadNames(context: EdgeContext): void {
  const { edge, frames } = context;
  const ahead = islands.findIndex((island) => edge.to === `ring-${island.id}`);
  const behind = islands.findIndex((island) => edge.from === `ring-${island.id}`);
  if (ahead < 0 || behind < 0) return;

  const end = (frames[frames.length - 1] as Frame).s;
  const tint = scaled(STEEL_BLUE, 1);
  const length = 1.7;
  const inset = 17;

  stamp(context, end - inset - length, end - inset, 1.98, nameCell(ahead), tint, 0, 'along');
  stamp(context, inset, inset + length, 1.98, nameCell(behind), tint, 0, 'towards');
}

/** The approach to a Helix hairpin: chevrons on the deck, closing up towards the tip. */
export function buildHairpinDecals(context: EdgeContext, tipS: number): void {
  const tint = scaled(VIOLET, 0.7);
  for (const distance of [14, 9.6, 6.2]) {
    stamp(context, tipS - distance, tipS - distance + 2.1, 1.1, DECAL_CELLS.chevrons, tint);
    stamp(context, tipS + distance - 2.1, tipS + distance, 1.1, DECAL_CELLS.chevrons, tint);
  }
}
