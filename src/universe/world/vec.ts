/**
 * Minimal vector helpers.
 *
 * Everything under `src/universe/world/` is pure, with no React, DOM or three.js
 * dependency. The same geometry feeds the road meshes, the walking physics, the
 * route finder and the minimap, and it can be unit-tested in plain Node.
 *
 * World axes: +X east, +Y up, +Z south (towards the opening camera).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export const DEG = Math.PI / 180;

/** Polar placement: `bearing` in compass degrees, 0 = north (−Z), 90 = east (+X). */
export function polar(radius: number, bearing: number, y = 0): Vec3 {
  const angle = bearing * DEG;
  return { x: Math.sin(angle) * radius, y, z: -Math.cos(angle) * radius };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function distanceXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Heading for a direction, in radians. 0 faces +Z (the robot model's forward). */
export function yawOf(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Shortest signed difference `to − from`, wrapped to (−π, π]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Centripetal Catmull-Rom through `points`. Centripetal parameterisation cannot
 * cusp or loop between unevenly spaced control points, which uniform
 * Catmull-Rom does, and hand-placed road control points are always uneven.
 */
export function catmullRom(points: Vec3[], closed: boolean, samplesPerSpan = 16): Vec3[] {
  const count = points.length;
  const at = (index: number): Vec3 => {
    if (closed) return points[((index % count) + count) % count] as Vec3;
    if (index < 0) {
      const a = points[0] as Vec3;
      const b = points[1] as Vec3;
      return sub(scale(a, 2), b);
    }
    if (index >= count) {
      const a = points[count - 1] as Vec3;
      const b = points[count - 2] as Vec3;
      return sub(scale(a, 2), b);
    }
    return points[index] as Vec3;
  };

  const spans = closed ? count : count - 1;
  const out: Vec3[] = [];

  for (let span = 0; span < spans; span += 1) {
    const p0 = at(span - 1);
    const p1 = at(span);
    const p2 = at(span + 1);
    const p3 = at(span + 2);

    const t01 = Math.sqrt(distance(p0, p1)) || 1e-4;
    const t12 = Math.sqrt(distance(p1, p2)) || 1e-4;
    const t23 = Math.sqrt(distance(p2, p3)) || 1e-4;

    for (let step = 0; step < samplesPerSpan; step += 1) {
      const u = step / samplesPerSpan;

      const axis = (a: number, b: number, c: number, d: number) => {
        const m1 = (b - a) / t01 - (c - a) / (t01 + t12) + (c - b) / t12;
        const m2 = (c - b) / t12 - (d - b) / (t12 + t23) + (d - c) / t23;
        const tangent1 = m1 * t12;
        const tangent2 = m2 * t12;
        const c2 = -3 * b - 2 * tangent1 - tangent2 + 3 * c;
        const c3 = 2 * b + tangent1 + tangent2 - 2 * c;
        return b + tangent1 * u + c2 * u * u + c3 * u * u * u;
      };

      out.push({
        x: axis(p0.x, p1.x, p2.x, p3.x),
        y: axis(p0.y, p1.y, p2.y, p3.y),
        z: axis(p0.z, p1.z, p2.z, p3.z),
      });
    }
  }

  if (!closed) out.push({ ...(points[count - 1] as Vec3) });
  return out;
}

/** Resample a polyline to even spacing, keeping both endpoints exactly. */
export function resample(points: Vec3[], spacing: number): Vec3[] {
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push((lengths[i - 1] as number) + distance(points[i - 1] as Vec3, points[i] as Vec3));
  }

  const total = lengths[lengths.length - 1] as number;
  const steps = Math.max(1, Math.round(total / spacing));
  const out: Vec3[] = [];
  let cursor = 0;

  for (let step = 0; step <= steps; step += 1) {
    const target = (step / steps) * total;
    while (cursor < lengths.length - 2 && (lengths[cursor + 1] as number) < target) cursor += 1;
    const start = lengths[cursor] as number;
    const end = lengths[cursor + 1] as number;
    const t = end > start ? (target - start) / (end - start) : 0;
    out.push(lerp(points[cursor] as Vec3, points[cursor + 1] as Vec3, clamp(t, 0, 1)));
  }

  return out;
}
