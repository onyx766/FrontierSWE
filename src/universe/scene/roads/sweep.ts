import { DEG, type Vec3 } from '@/universe/world/vec';

/**
 * Road geometry: pure maths, no three.js, no DOM.
 *
 * A road is a cross-section extruded along a centreline. The section stays in
 * the vertical plane through the road's lateral axis, so the deck is level from
 * side to side however the road climbs or turns. That is what the walking
 * physics assume: the deck top at any point on a road is exactly the height of
 * the centreline there.
 */

/** A point on the centreline with the axes the section is laid out in. */
export interface Frame {
  x: number;
  y: number;
  z: number;
  /** Unit tangent. */
  tx: number;
  ty: number;
  tz: number;
  /** Unit horizontal direction to the right of travel. */
  rx: number;
  rz: number;
  /** Unit vector at right angles to the tangent, in the vertical plane. */
  ux: number;
  uy: number;
  uz: number;
  /** Arc length from the start of the road. */
  s: number;
  /** Signed curvature, smoothed along the road. Positive turns right. */
  bend: number;
}

/** One vertex of a cross-section: `x` right of the centreline, `y` above the deck top. */
export interface SectionPoint {
  x: number;
  y: number;
  /** Height to use where the road lies flush on an island deck, if different. */
  flushY?: number;
}

/**
 * A section polyline, wound clockwise when looking along the road so that every
 * face points out of the solid. Each band of it is flat-shaded across the road
 * and smooth along it, which keeps chamfers crisp on a curve.
 */
export type SectionPath = readonly SectionPoint[];

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Tints a vertex. `lateral` is its distance right of the centreline. */
export type LightFn = (
  x: number,
  y: number,
  z: number,
  lateral: number,
  frame: Frame,
  out: Rgba,
) => void;

export interface SweepOptions {
  /** Added to every height: the per-style offset that stops overlapping decks fighting. */
  lift?: number;
  /** First and last station to build. Defaults to the whole road. */
  from?: number;
  to?: number;
  /** How much a world position lies on an island deck, 0 to 1. Blends in `flushY`. */
  flush?: (x: number, z: number) => number;
  /** Texture coordinate from a section point and its distance around the section. */
  u: (point: SectionPoint, perimeter: number) => number;
  /** Texture coordinate from the station and its distance around the section. */
  v: (frame: Frame, perimeter: number) => number;
  light?: LightFn;
  /**
   * Record each vertex's spread from the path's centre, for screen-space widening.
   * `line` strips stay visible at any range; `detail` strips vanish at long range.
   */
  spread?: 'line' | 'detail';
  /** Minimum width on screen, as a multiple of a normal strip's. Default 1. */
  minWidth?: number;
  /** Multiply the tint at the path's two ends, so a strip fades out across its width. */
  edgeFade?: number;
}

/** Growable vertex and index arrays, merged per material. */
export class MeshBuffer {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  /** Four per vertex; what they mean depends on the material. See `materials.ts`. */
  readonly lights: number[] = [];
  /**
   * Only on thin strips, four per vertex: the direction from the strip's centre to
   * this vertex, whose length scales the minimum width, and its distance. The
   * strip's shader uses them to hold it at a minimum width on screen. A negative
   * distance marks a detail strip, which narrows away at long range instead.
   */
  readonly spreads: number[] = [];
  readonly indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  get triangleCount(): number {
    return this.indices.length / 3;
  }

  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    light: Rgba,
  ): void {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.lights.push(light.r, light.g, light.b, light.a);
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d);
  }

  /** Mark everything added since the last spread as not widening with distance. */
  padSpreads(): void {
    while (this.spreads.length < this.vertexCount * 4) this.spreads.push(0, 0, 0, 0);
  }
}

export const NO_LIGHT: Readonly<Rgba> = { r: 1, g: 1, b: 1, a: 0 };

const scratchLight: Rgba = { r: 1, g: 1, b: 1, a: 0 };

/** Turning per mesh segment that still reads as a curve rather than as a polygon. */
const MAX_TURN = 3.5 * DEG;
const MAX_SUBDIVISION = 14;
/** How far an offset may reach into a bend, as a fraction of the bend's radius. */
const INNER_REACH = 0.94;
/** Distance along the road over which a tight bend's limit is eased in. */
const BEND_EASE = 1.4;

function turnBetween(a: Vec3, b: Vec3, c: Vec3): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const vz = c.z - b.z;
  const dot = ux * vx + uy * vy + uz * vz;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return Math.atan2(Math.hypot(cx, cy, cz), dot);
}

/**
 * Add points where a road bends sharply. The centreline is sampled a unit apart,
 * which is fine for the physics but shows as facets on a hairpin. A Hermite
 * spline through the samples rounds them off and passes through every original
 * point, so the deck stays exactly at the centreline's height there.
 */
export function refine(points: readonly Vec3[], maxTurn = MAX_TURN): Vec3[] {
  const count = points.length;
  if (count < 3) return points.map((point) => ({ ...point }));

  const at = (index: number) => points[index] as Vec3;
  const turns = points.map((point, index) => {
    if (index === 0 || index === count - 1) return 0;
    return turnBetween(at(index - 1), point, at(index + 1));
  });
  const tangent = (index: number): Vec3 => {
    const a = at(Math.max(0, index - 1));
    const b = at(Math.min(count - 1, index + 1));
    const scale = index === 0 || index === count - 1 ? 1 : 0.5;
    return { x: (b.x - a.x) * scale, y: (b.y - a.y) * scale, z: (b.z - a.z) * scale };
  };

  const out: Vec3[] = [];
  for (let span = 0; span < count - 1; span += 1) {
    const p0 = at(span);
    const p1 = at(span + 1);
    const m0 = tangent(span);
    const m1 = tangent(span + 1);
    const turn = Math.max(turns[span] as number, turns[span + 1] as number);
    const steps = Math.min(MAX_SUBDIVISION, Math.max(1, Math.ceil(turn / maxTurn)));

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      out.push({
        x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
        y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
        z: h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z,
      });
    }
  }
  out.push({ ...at(count - 1) });
  return out;
}

/**
 * Drop the points of a centreline that a straight chord would pass within
 * `tolerance` of, up to `maxStep` long. A mesh does not need a vertex every unit on
 * a gentle curve, so this is where most of the road budget comes back. Every point
 * that survives is an original one, so the deck height stays exact at each vertex.
 *
 * The turn across a chord is limited as well as its deviation, because a rail stands
 * out from the centreline: what is a tiny kink at the middle of the road is a large
 * one at its edge, on the outside of a tight bend.
 */
export function thin(
  points: readonly Vec3[],
  tolerance: number,
  maxStep: number,
  maxTurn = 1.2 * MAX_TURN,
): Vec3[] {
  const count = points.length;
  if (count < 3) return points.map((point) => ({ ...point }));

  const out: Vec3[] = [{ ...(points[0] as Vec3) }];
  let start = 0;

  while (start < count - 1) {
    let end = start + 1;

    for (let candidate = end + 1; candidate < count; candidate += 1) {
      const a = points[start] as Vec3;
      const b = points[candidate] as Vec3;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dy, dz);
      if (length > maxStep) break;
      if (turnBetween(a, points[start + 1] as Vec3, b) > maxTurn) break;

      let fits = true;
      for (let between = start + 1; between < candidate; between += 1) {
        const p = points[between] as Vec3;
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / (length * length);
        const offset = Math.hypot(
          p.x - a.x - dx * t,
          p.y - a.y - dy * t,
          p.z - a.z - dz * t,
        );
        if (offset > tolerance) {
          fits = false;
          break;
        }
      }
      if (!fits) break;
      end = candidate;
    }

    out.push({ ...(points[end] as Vec3) });
    start = end;
  }

  return out;
}

/** Spread each station's curvature to its neighbours, so a limit eases in rather than steps. */
function easeBends(frames: Frame[]): void {
  const raw = frames.map((frame) => frame.bend);
  frames.forEach((frame, index) => {
    let strongest = 0;
    for (const direction of [-1, 1]) {
      for (let k = index; k >= 0 && k < frames.length; k += direction) {
        const distance = Math.abs((frames[k] as Frame).s - frame.s);
        if (distance > BEND_EASE) break;
        const weighted = (raw[k] as number) * (1 - distance / BEND_EASE) ** 2;
        if (Math.abs(weighted) > Math.abs(strongest)) strongest = weighted;
      }
    }
    frame.bend = strongest;
  });
}

/** Axes at every point of a centreline. */
export function buildFrames(points: readonly Vec3[]): Frame[] {
  const count = points.length;
  let s = 0;
  const frames: Frame[] = [];

  for (let index = 0; index < count; index += 1) {
    const point = points[index] as Vec3;
    const before = points[Math.max(0, index - 1)] as Vec3;
    const after = points[Math.min(count - 1, index + 1)] as Vec3;

    if (index > 0) s += Math.hypot(point.x - before.x, point.y - before.y, point.z - before.z);

    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const dz = after.z - before.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    const tx = dx / length;
    const ty = dy / length;
    const tz = dz / length;

    const flat = Math.hypot(tx, tz) || 1;
    const rx = -tz / flat;
    const rz = tx / flat;

    /* The world's up with its component along the tangent removed. */
    const along = ty;
    const ux = -along * tx;
    const uy = 1 - along * ty;
    const uz = -along * tz;
    const upLength = Math.hypot(ux, uy, uz) || 1;

    frames.push({
      x: point.x,
      y: point.y,
      z: point.z,
      tx,
      ty,
      tz,
      rx,
      rz,
      ux: ux / upLength,
      uy: uy / upLength,
      uz: uz / upLength,
      s,
      bend: 0,
    });
  }

  for (let index = 1; index < count - 1; index += 1) {
    const previous = frames[index - 1] as Frame;
    const current = frames[index] as Frame;
    const next = frames[index + 1] as Frame;
    const cross = previous.tx * next.tz - previous.tz * next.tx;
    const dot = previous.tx * next.tx + previous.tz * next.tz;
    const run = next.s - previous.s;
    current.bend = run > 1e-6 ? Math.atan2(cross, dot) / run : 0;
  }
  if (count >= 3) {
    (frames[0] as Frame).bend = (frames[1] as Frame).bend;
    (frames[count - 1] as Frame).bend = (frames[count - 2] as Frame).bend;
  }

  easeBends(frames);
  return frames;
}

/**
 * Keep an offset short of the centre of a tight bend. Beyond the centre of
 * curvature an offset curve runs backwards, and the deck would fold over itself
 * on the inside of a hairpin. The robot is kept far enough from the edge that
 * trimming the inside of the very tightest bends never takes floor from it.
 */
export function limitLateral(lateral: number, frame: Frame): number {
  if (lateral * frame.bend <= 0) return lateral;
  const limit = INNER_REACH / Math.abs(frame.bend);
  return Math.abs(lateral) <= limit ? lateral : Math.sign(lateral) * limit;
}

/** Extrude a section path along stations of a road, appending to `out`. */
export function sweep(
  out: MeshBuffer,
  frames: readonly Frame[],
  path: SectionPath,
  options: SweepOptions,
): void {
  const { lift = 0, flush, light, spread, edgeFade, minWidth = 1 } = options;
  const from = options.from ?? 0;
  const to = options.to ?? frames.length - 1;
  const stations = to - from + 1;
  if (stations < 2) return;

  const centerX = path.reduce((sum, point) => sum + point.x, 0) / path.length;
  const centerY = path.reduce((sum, point) => sum + point.y, 0) / path.length;

  let perimeter = 0;

  for (let band = 0; band < path.length - 1; band += 1) {
    const a = path[band] as SectionPoint;
    const b = path[band + 1] as SectionPoint;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const base = out.vertexCount;

    for (let station = from; station <= to; station += 1) {
      const frame = frames[station] as Frame;
      const normalX = frame.rx * nx + frame.ux * ny;
      const normalY = frame.uy * ny;
      const normalZ = frame.rz * nx + frame.uz * ny;

      for (let end = 0; end < 2; end += 1) {
        const point = end === 0 ? a : b;
        const lateral = limitLateral(point.x, frame);
        const x = frame.x + frame.rx * lateral;
        const z = frame.z + frame.rz * lateral;

        let height = point.y;
        if (flush && point.flushY !== undefined) {
          height += (point.flushY - point.y) * flush(x, z);
        }
        const y = frame.y + height + lift;

        let tint: Rgba = NO_LIGHT as Rgba;
        if (light) {
          light(x, y, z, lateral, frame, scratchLight);
          tint = scratchLight;
          const index = band + end;
          if (edgeFade !== undefined && (index === 0 || index === path.length - 1)) {
            tint.r *= edgeFade;
            tint.g *= edgeFade;
            tint.b *= edgeFade;
          }
        }

        const around = end === 0 ? perimeter : perimeter + length;
        out.vertex(
          x,
          y,
          z,
          normalX,
          normalY,
          normalZ,
          options.u(point, around),
          options.v(frame, around),
          tint,
        );

        if (spread) {
          const offsetX = point.x - centerX;
          const offsetY = point.y - centerY;
          const reach = Math.hypot(offsetX, offsetY) || 1;
          out.spreads.push(
            ((frame.rx * offsetX) / reach) * minWidth,
            (offsetY / reach) * minWidth,
            ((frame.rz * offsetX) / reach) * minWidth,
            spread === 'detail' ? -reach : reach,
          );
        }
      }
    }

    for (let station = 0; station < stations - 1; station += 1) {
      const a0 = base + station * 2;
      const b0 = a0 + 1;
      const a1 = a0 + 2;
      const b1 = a0 + 3;
      out.quad(a0, b0, b1, a1);
    }

    perimeter += length;
  }
}

export interface BeamOptions {
  /** Which way the beam's height runs. Defaults to world up, or +X for a vertical beam. */
  up?: Vec3;
  /** Close the ends. Thin struts that disappear into something do not need it. */
  caps?: boolean;
  /** Width and height at `b`, as a fraction of those at `a`. Default 1. */
  taper?: number;
  /** Size of a texture tile in world units. */
  tile: number;
  light?: Readonly<Rgba>;
}

/** A straight rectangular member from `a` to `b`. */
export function addBeam(
  out: MeshBuffer,
  a: Vec3,
  b: Vec3,
  width: number,
  height: number,
  options: BeamOptions,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-6) return;
  const tx = dx / length;
  const ty = dy / length;
  const tz = dz / length;

  const hint = options.up ?? (Math.abs(ty) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 });

  /* side = tangent × hint, up = side × tangent. */
  let sx = ty * hint.z - tz * hint.y;
  let sy = tz * hint.x - tx * hint.z;
  let sz = tx * hint.y - ty * hint.x;
  const sideLength = Math.hypot(sx, sy, sz) || 1;
  sx /= sideLength;
  sy /= sideLength;
  sz /= sideLength;
  const ux = sy * tz - sz * ty;
  const uy = sz * tx - sx * tz;
  const uz = sx * ty - sy * tx;

  const taper = options.taper ?? 1;
  const light = (options.light ?? NO_LIGHT) as Rgba;
  const { tile } = options;

  const corner = (end: Vec3, scale: number, across: number, up: number): Vec3 => ({
    x: end.x + (sx * across * width + ux * up * height) * 0.5 * scale,
    y: end.y + (sy * across * width + uy * up * height) * 0.5 * scale,
    z: end.z + (sz * across * width + uz * up * height) * 0.5 * scale,
  });

  /* Faces in order: top, right, bottom, left, each outward. */
  const faces: { across: [number, number]; up: [number, number]; n: Vec3 }[] = [
    { across: [-1, 1], up: [1, 1], n: { x: ux, y: uy, z: uz } },
    { across: [1, 1], up: [1, -1], n: { x: sx, y: sy, z: sz } },
    { across: [1, -1], up: [-1, -1], n: { x: -ux, y: -uy, z: -uz } },
    { across: [-1, -1], up: [-1, 1], n: { x: -sx, y: -sy, z: -sz } },
  ];

  let v = 0;
  for (const face of faces) {
    const span = face.across[0] === face.across[1] ? height : width;
    const base = out.vertexCount;
    for (const end of [0, 1]) {
      const origin = end === 0 ? a : b;
      const scale = end === 0 ? 1 : taper;
      for (const side of [0, 1]) {
        const p = corner(
          origin,
          scale,
          face.across[side] as number,
          face.up[side] as number,
        );
        out.vertex(
          p.x,
          p.y,
          p.z,
          face.n.x,
          face.n.y,
          face.n.z,
          (end * length) / tile,
          (v + side * span) / tile,
          light,
        );
      }
    }
    out.quad(base, base + 1, base + 3, base + 2);
    v += span;
  }

  if (options.caps) {
    for (const end of [0, 1]) {
      const origin = end === 0 ? a : b;
      const scale = end === 0 ? 1 : taper;
      const n = end === 0 ? { x: -tx, y: -ty, z: -tz } : { x: tx, y: ty, z: tz };
      const base = out.vertexCount;
      const ring: [number, number][] =
        end === 0
          ? [
              [-1, 1],
              [-1, -1],
              [1, -1],
              [1, 1],
            ]
          : [
              [1, 1],
              [1, -1],
              [-1, -1],
              [-1, 1],
            ];
      for (const [across, up] of ring) {
        const p = corner(origin, scale, across, up);
        out.vertex(
          p.x,
          p.y,
          p.z,
          n.x,
          n.y,
          n.z,
          (across * width) / tile,
          (up * height) / tile,
          light,
        );
      }
      out.quad(base, base + 1, base + 2, base + 3);
    }
  }
}

/**
 * A hair-thin straight line of light: two crossed ribbons, so it shows from every
 * side. It carries spreads, so it holds a width on screen. A `detail` line, like a
 * stay cable, vanishes at long range; a `line` stays, at `minWidth` times the usual.
 */
export function addCable(
  out: MeshBuffer,
  a: Vec3,
  b: Vec3,
  radius: number,
  light: Readonly<Rgba>,
  kind: 'line' | 'detail' = 'detail',
  minWidth = 1,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-6) return;

  const tx = dx / length;
  const ty = dy / length;
  const tz = dz / length;

  /* Any axis at right angles to the cable, and a second at right angles to both. */
  let sx = tz;
  let sy = 0;
  let sz = -tx;
  const sideLength = Math.hypot(sx, sz);
  if (sideLength < 1e-4) {
    sx = 1;
    sz = 0;
  } else {
    sx /= sideLength;
    sz /= sideLength;
  }
  const ux = sy * tz - sz * ty;
  const uy = sz * tx - sx * tz;
  const uz = sx * ty - sy * tx;

  out.padSpreads();
  for (const [ax, ay, az] of [
    [sx, sy, sz],
    [ux, uy, uz],
  ] as const) {
    const base = out.vertexCount;
    for (const end of [a, b]) {
      for (const sign of [-1, 1]) {
        out.vertex(
          end.x + ax * radius * sign,
          end.y + ay * radius * sign,
          end.z + az * radius * sign,
          0,
          1,
          0,
          0,
          end === a ? 0 : 1,
          light as Rgba,
        );
        out.spreads.push(
          ax * sign * minWidth,
          ay * sign * minWidth,
          az * sign * minWidth,
          kind === 'detail' ? -radius : radius,
        );
      }
    }
    out.quad(base, base + 1, base + 3, base + 2);
  }
}

/** One ring of a revolved profile. Runs from the centre outwards, then down the rim. */
export interface RevolvePoint {
  r: number;
  y: number;
}

export interface RevolveOptions {
  segments: number;
  /** Texture coordinate from an angle and a profile point. */
  uv: (angle: number, point: RevolvePoint, around: number) => [number, number];
  light?: Readonly<Rgba>;
}

/** Spin a profile around a vertical axis through `center`. */
export function addRevolve(
  out: MeshBuffer,
  center: Vec3,
  profile: readonly RevolvePoint[],
  options: RevolveOptions,
): void {
  const { segments, uv } = options;
  const light = (options.light ?? NO_LIGHT) as Rgba;
  let around = 0;

  for (let band = 0; band < profile.length - 1; band += 1) {
    const inner = profile[band] as RevolvePoint;
    const outer = profile[band + 1] as RevolvePoint;
    const dr = outer.r - inner.r;
    const dy = outer.y - inner.y;
    const length = Math.hypot(dr, dy) || 1;
    const nr = -dy / length;
    const ny = dr / length;
    const base = out.vertexCount;

    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const [point, distance] of [
        [inner, around],
        [outer, around + length],
      ] as const) {
        const [u, v] = uv(angle, point, distance);
        out.vertex(
          center.x + cos * point.r,
          center.y + point.y,
          center.z + sin * point.r,
          cos * nr,
          ny,
          sin * nr,
          u,
          v,
          light,
        );
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = base + segment * 2;
      const b0 = a0 + 1;
      const a1 = a0 + 2;
      const b1 = a0 + 3;
      out.quad(b0, a0, a1, b1);
    }

    around += length;
  }
}
