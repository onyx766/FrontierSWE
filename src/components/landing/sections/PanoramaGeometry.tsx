/**
 * Geometry for the final call-to-action panorama. Mountain ranges and cloud
 * banks are generated from fixed seeds rather than drawn by hand: the shapes
 * are identical on every render (nothing can mismatch on hydration) and are
 * tuned by numbers instead of by editing long paths. Only server components
 * import this, so none of it ships to the browser.
 */
import { createRng, fixed } from '@/lib/rng';

export type Point = readonly [number, number];

/** One decimal keeps the markup short; the art is never scaled far above 1×. */
const round = (value: number) => fixed(value, 1);

/** A count of tenths as the shortest SVG number: 5, -3.2, .5, -.5. */
function tenths(value: number): string {
  const text = String(value / 10);
  if (text.startsWith('0.')) return text.slice(1);
  if (text.startsWith('-0.')) return `-${text.slice(2)}`;
  return text;
}

/**
 * Path data as relative moves on a 0.1 grid: about half the bytes of absolute
 * coordinates (this art is server-rendered markup, so bytes matter), and
 * differencing already-rounded positions means rounding never drifts.
 */
export function pathFrom(points: readonly Point[], close = true): string {
  const first = points[0];
  if (!first) return '';
  let px = Math.round(first[0] * 10);
  let py = Math.round(first[1] * 10);
  let d = `M${tenths(px)} ${tenths(py)}`;
  if (points.length > 1) {
    let moves = '';
    for (const [x, y] of points.slice(1)) {
      const qx = Math.round(x * 10);
      const qy = Math.round(y * 10);
      for (const token of [tenths(qx - px), tenths(qy - py)]) {
        moves += moves && !token.startsWith('-') ? ` ${token}` : token;
      }
      px = qx;
      py = qy;
    }
    d += `l${moves}`;
  }
  return close ? `${d}z` : d;
}

/** Smoothly interpolated value noise in [-1, 1], sampled on [0, cells]. */
function valueNoise(rng: () => number, cells: number): (t: number) => number {
  const lattice = Array.from({ length: cells + 2 }, () => rng() * 2 - 1);
  return (t) => {
    const clamped = Math.min(cells, Math.max(0, t));
    const i = Math.floor(clamped);
    const f = clamped - i;
    const s = f * f * (3 - 2 * f);
    const a = lattice[i] ?? 0;
    const b = lattice[i + 1] ?? 0;
    return a + (b - a) * s;
  };
}

/* ─────────────────────────────── Mountains ──────────────────────────────── */

export interface Peak {
  /** Summit position along the range, in viewBox units. */
  x: number;
  /** Height above the foothills. */
  h: number;
  /** Half-width at the foot. */
  w: number;
  /** Profile exponent: above 1 gives a sharp summit with flaring skirts. */
  k?: number;
  /** -1…1: leans the summit, stretching one flank and steepening the other. */
  lean?: number;
  /** Carries a snow cap. */
  snow?: boolean;
}

export interface RangeOptions {
  seed: number;
  width: number;
  height: number;
  /** Foothill height above the bottom edge. */
  base: number;
  peaks: Peak[];
  /** Ridge noise amplitude, in viewBox units. */
  rough: number;
  /** Snow line, as a fraction of each summit's height below the summit. */
  snowLine?: number;
}

export interface RangeGeometry {
  /** The whole range, closed along the bottom edge. */
  silhouette: string;
  /** Sun-facing (right-hand) flanks, one per summit. */
  lit: string[];
  snow: string[];
  /** Open crest lines of the lit flanks, for a thin rim of light. */
  rims: string[];
  /** Highest point of the ridge, for anchoring gradients. */
  top: number;
}

export function mountainRange(o: RangeOptions): RangeGeometry {
  const rng = createRng(o.seed);
  const coarse = valueNoise(rng, 18);
  const medium = valueNoise(rng, 60);
  const fine = valueNoise(rng, 180);
  const grain = valueNoise(rng, 420);
  const tallest = Math.max(1, ...o.peaks.map((peak) => peak.h));
  // About 4px on screen at desktop scale: fine enough for a crisp ridge.
  const step = 7;
  const start = -2 * step;

  const ridge: Point[] = [];
  for (let x = start; x <= o.width + 2 * step; x += step) {
    let lift = 0;
    for (const peak of o.peaks) {
      const lean = peak.lean ?? 0;
      const half = x < peak.x ? peak.w * (1 - lean * 0.45) : peak.w * (1 + lean * 0.45);
      const t = Math.abs(x - peak.x) / half;
      if (t < 1) lift = Math.max(lift, peak.h * (1 - t) ** (peak.k ?? 1.5));
    }
    const u = Math.min(1, Math.max(0, x / o.width));
    const noise =
      coarse(u * 18) * 0.8 + medium(u * 60) * 0.55 + fine(u * 180) * 0.3 + grain(u * 420) * 0.14;
    // Rough on the summits, smoother in the valleys where the cloud settles.
    const amplitude = o.rough * (0.25 + 0.75 * (lift / tallest));
    ridge.push([x, o.height - o.base - lift - noise * amplitude]);
  }

  const last = ridge.length - 1;
  const at = (index: number): Point => ridge[Math.min(last, Math.max(0, index))] ?? [0, 0];
  const indexOf = (x: number) => Math.round((x - start) / step);

  const lit: string[] = [];
  const snow: string[] = [];
  const rims: string[] = [];

  for (const peak of o.peaks) {
    // The true summit: the highest ridge point near the nominal centre.
    let apex = Math.max(0, indexOf(peak.x - peak.w * 0.3));
    const scanEnd = Math.min(last, indexOf(peak.x + peak.w * 0.3));
    for (let i = apex; i <= scanEnd; i += 1) if (at(i)[1] < at(apex)[1]) apex = i;
    const [ax, ay] = at(apex);

    // The sun sits to the right, so each summit's right-hand flank is lit, down
    // the crest to the valley floor and back up a jagged spine.
    let valley = apex;
    for (let i = apex + 1; i <= last; i += 1) {
      const [x, y] = at(i);
      if (x > peak.x + peak.w * 1.4) break;
      if (y > at(valley)[1]) valley = i;
      else if (y < at(valley)[1] - peak.h * 0.12) break; // climbing the next summit
    }
    const [vx] = at(valley);
    const run = Math.max(step * 2, vx - ax);
    const rise = o.height - ay;
    const foot = ax + run * (0.3 + rng() * 0.2);
    lit.push(pathFrom([...ridge.slice(apex, valley + 1), [vx, o.height], [foot, o.height], ...spine(foot, ax, ay, run)]));
    const crest = ridge.slice(apex, valley + 1);
    if (crest.length > 2) rims.push(pathFrom(crest, false));

    // Two ribs on the shaded flank catch a sliver of light each.
    for (const along of [0.3 + rng() * 0.12, 0.58 + rng() * 0.14]) {
      const from = indexOf(ax - peak.w * along);
      const to = Math.min(apex - 1, from + Math.max(2, Math.round((peak.w * 0.12) / step)));
      if (from <= 0 || to <= from) continue;
      const [fx, fy] = at(from);
      const ribFoot = fx + rise * (0.18 + rng() * 0.12);
      lit.push(
        pathFrom([
          ...ridge.slice(from, to + 1),
          ...spine(ribFoot, at(to)[0], at(to)[1], peak.w * 0.12).reverse(),
          [ribFoot, o.height],
          [ribFoot - peak.w * 0.05, o.height],
          ...spine(ribFoot - peak.w * 0.05, fx, fy, peak.w * 0.1),
        ]),
      );
    }

    if (!peak.snow) continue;
    const depth = peak.h * (o.snowLine ?? 0.24);
    const line = ay + depth;
    let left = apex;
    while (left > 0 && at(left - 1)[1] < line) left -= 1;
    let right = apex;
    while (right < last && at(right + 1)[1] < line) right += 1;
    const span = at(right)[0] - at(left)[0];
    if (span < step * 3) continue;
    const edge: Point[] = [];
    // Ragged lower edge near the snow line, with the odd blunt tongue of snow
    // running a little further down a gully.
    let x = at(right)[0] - 3;
    let tongue = 0;
    while (x > at(left)[0] + 3) {
      if (tongue === 0 && rng() < 0.16) tongue = 2 + Math.floor(rng() * 2);
      const reach = tongue > 0 ? 1.12 + rng() * 0.28 : 0.78 + rng() * 0.22;
      edge.push([x, ay + depth * reach]);
      if (tongue > 0) tongue -= 1;
      x -= 4 + rng() * 5;
    }
    snow.push(pathFrom([...ridge.slice(left, right + 1), ...edge]));
  }

  /** A jagged line from a foot on the bottom edge up toward (tx, ty). */
  function spine(footX: number, tx: number, ty: number, run: number): Point[] {
    const points: Point[] = [];
    const segments = 12;
    for (let s = 1; s < segments; s += 1) {
      const t = s / segments;
      const wobble = (rng() - 0.5) * run * 0.16 * (1 - t * 0.6);
      points.push([footX + (tx - footX) * t + wobble, o.height + (ty - o.height) * t]);
    }
    return points;
  }

  const top = round(Math.min(...ridge.map(([, y]) => y)));
  // Closed far below the frame: parallax can lift a range by tens of pixels,
  // and its foot must never show as a flat edge in a valley of the range in
  // front. The SVG lets it overflow; the gradient's last colour fills it.
  const floor = o.height * 2;
  const silhouette = pathFrom([[at(0)[0], floor], ...ridge, [at(last)[0], floor]]);
  return { silhouette, lit, snow, rims, top };
}

/* ──────────────────────────────── Clouds ────────────────────────────────── */

export interface CloudRow {
  /** Height of the puff centres along this row. */
  y: number;
  /** Radius range. */
  r: readonly [number, number];
  /** Spacing range between puff centres. */
  gap: readonly [number, number];
  /** Vertical scatter. */
  jitter: number;
}

export interface Puff {
  cx: number;
  cy: number;
  r: number;
  /** 0…1: how far this puff's sunlit top rides up, so the shading varies. */
  lift: number;
}

/** Piecewise-linear profile through [x, dy] stops, flat beyond the ends. */
function profileAt(stops: readonly Point[], x: number): number {
  const first = stops[0];
  if (!first) return 0;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1];
    const b = stops[i];
    if (!a || !b) break;
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / Math.max(1, b[0] - a[0]);
  }
  return stops[stops.length - 1]?.[1] ?? 0;
}

/**
 * Rows of overlapping puffs. `profile` lifts (negative) or sinks the bank
 * along its length, so it can pile up where something needs hiding.
 */
export function cloudBank({
  seed,
  width,
  rows,
  profile = [],
}: {
  seed: number;
  width: number;
  rows: readonly CloudRow[];
  profile?: readonly Point[];
}): Puff[][] {
  const rng = createRng(seed);
  return rows.map((row) => {
    const puffs: Puff[] = [];
    for (let x = -row.r[1]; x < width + row.r[1]; ) {
      const r = row.r[0] + rng() * (row.r[1] - row.r[0]);
      const cy = row.y + profileAt(profile, x) + (rng() - 0.5) * row.jitter;
      puffs.push({ cx: round(x), cy: round(cy), r: round(r), lift: round(rng()) });
      x += row.gap[0] + rng() * (row.gap[1] - row.gap[0]);
    }
    return puffs;
  });
}

/* ─────────────────────────────── Sparkles ───────────────────────────────── */

export interface Sparkle {
  /** Position, as percentages of the band. */
  x: number;
  y: number;
  /** Size in px. */
  size: number;
  /** Seconds; negative so the field starts mid-cycle rather than in unison. */
  delay: number;
  duration: number;
}

export function sparkleField(
  seed: number,
  count: number,
  area: { x: readonly [number, number]; y: readonly [number, number] },
): Sparkle[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => ({
    x: round(area.x[0] + rng() * (area.x[1] - area.x[0])),
    y: round(area.y[0] + rng() * (area.y[1] - area.y[0])),
    size: round(7 + rng() * 9),
    delay: round(-rng() * 6),
    duration: round(3.4 + rng() * 3.2),
  }));
}
