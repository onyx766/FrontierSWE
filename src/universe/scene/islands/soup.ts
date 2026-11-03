import type { Vec3 } from '../../world/vec';

/**
 * A growable triangle list for one material. Everything on the islands that
 * shares a material ends up in one soup, and so in one draw call, however many
 * rocks, clamps and rim bands went into it.
 *
 * Pure data with no three.js dependency, so island geometry can be unit-tested
 * in plain Node.
 */

export type Rgb = readonly [number, number, number];

export const BLACK: Rgb = [0, 0, 0];

export function normalOf(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const size = Math.hypot(x, y, z) || 1;
  return { x: x / size, y: y / size, z: z / size };
}

export class TriangleSoup {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colors: number[] = [];
  readonly glows: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(
    position: Vec3,
    normal: Vec3,
    u: number,
    v: number,
    color: Rgb,
    glow: Rgb = BLACK,
  ): void {
    this.positions.push(position.x, position.y, position.z);
    this.normals.push(normal.x, normal.y, normal.z);
    this.uvs.push(u, v);
    this.colors.push(color[0], color[1], color[2]);
    this.glows.push(glow[0], glow[1], glow[2]);
  }

  /**
   * A flat triangle, textured by projecting along its dominant axis. Each
   * triangle gets its own projection, so that a steep facet never shows the
   * stretching a single wrap around the rock would give it.
   */
  facet(a: Vec3, b: Vec3, c: Vec3, tile: number, color: Rgb): void {
    const normal = normalOf(a, b, c);
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);

    for (const point of [a, b, c]) {
      let u = point.x;
      let v = point.y;
      if (ay >= ax && ay >= az) {
        v = point.z;
      } else if (ax >= az) {
        u = point.z;
      }
      this.vertex(point, normal, u / tile, v / tile, color);
    }
  }

  /** Copy another soup into this one, moved by `offset`. */
  append(other: TriangleSoup, offset: Vec3): void {
    const { positions, normals, uvs, colors, glows } = other;
    for (let index = 0; index < positions.length; index += 3) {
      this.positions.push(
        (positions[index] as number) + offset.x,
        (positions[index + 1] as number) + offset.y,
        (positions[index + 2] as number) + offset.z,
      );
    }
    for (const value of normals) this.normals.push(value);
    for (const value of uvs) this.uvs.push(value);
    for (const value of colors) this.colors.push(value);
    for (const value of glows) this.glows.push(value);
  }
}
