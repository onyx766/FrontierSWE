/**
 * Plain 2D geometry on the island's ground plane (world X and Z), shared by
 * the model, which uses it to keep things from overlapping, and its tests,
 * which use it to prove they don't.
 */

export const TAU = Math.PI * 2;

/** An oriented rectangle: a building footprint. */
export interface Rect {
  x: number;
  z: number;
  /** Rotation about Y. The local x axis is (cos rot, sin rot) in world XZ. */
  rot: number;
  /** Half extent along the local x axis. */
  hw: number;
  /** Half extent along the local z axis. */
  hd: number;
}

/** The four corners, counter-clockwise, as [x, z] pairs. */
export function rectCorners(r: Rect): [number, number][] {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  return signs.map(([sx, sz]) => [
    r.x + sx * r.hw * c - sz * r.hd * s,
    r.z + sx * r.hw * s + sz * r.hd * c,
  ]);
}

/**
 * Separating-axis test for two rectangles, each grown by `margin / 2` on
 * every side, so `margin` is the gap they must keep.
 */
export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const ac = Math.cos(a.rot);
  const as = Math.sin(a.rot);
  const bc = Math.cos(b.rot);
  const bs = Math.sin(b.rot);
  const axes = [ac, as, -as, ac, bc, bs, -bs, bc];
  for (let i = 0; i < 8; i += 2) {
    const nx = axes[i] as number;
    const nz = axes[i + 1] as number;
    const ra = a.hw * Math.abs(ac * nx + as * nz) + a.hd * Math.abs(-as * nx + ac * nz);
    const rb = b.hw * Math.abs(bc * nx + bs * nz) + b.hd * Math.abs(-bs * nx + bc * nz);
    if (Math.abs(dx * nx + dz * nz) >= ra + rb + margin) return false;
  }
  return true;
}

/** Distance from a point to a rectangle; 0 when the point is inside. */
export function pointRectDistance(px: number, pz: number, r: Rect): number {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  const dx = px - r.x;
  const dz = pz - r.z;
  const lx = Math.abs(dx * c + dz * s) - r.hw;
  const lz = Math.abs(-dx * s + dz * c) - r.hd;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
}

/** Nearest any part of the rectangle comes to the island centre. */
export function rectMinRadius(r: Rect): number {
  return pointRectDistance(0, 0, r);
}

/** Furthest any part of the rectangle reaches from the island centre. */
export function rectMaxRadius(r: Rect): number {
  let max = 0;
  for (const [x, z] of rectCorners(r)) max = Math.max(max, Math.hypot(x, z));
  return max;
}

/** Radius of the circle around the rectangle's centre that contains it. */
export function rectBoundingRadius(r: Rect): number {
  return Math.hypot(r.hw, r.hd);
}

export function pointSegmentDistance(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

/** Distance to a polyline stored flat as [x0, z0, x1, z1, ...]. */
export function pointPolylineDistance(px: number, pz: number, points: readonly number[]): number {
  let best = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const d = pointSegmentDistance(
      px,
      pz,
      points[i] as number,
      points[i + 1] as number,
      points[i + 2] as number,
      points[i + 3] as number,
    );
    if (d < best) best = d;
  }
  return best;
}

/** Smallest absolute difference between two angles, in [0, PI]. */
export function angleGap(a: number, b: number): number {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return d > Math.PI ? TAU - d : d;
}
