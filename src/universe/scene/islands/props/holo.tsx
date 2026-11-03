'use client';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../../state/store';
import { getKit } from '../../kit';
import { COLORS, hdr } from '../../palette';

/**
 * The toolkit behind the hologram islands.
 *
 * Every island draws from the same few batches, each a single merged mesh, so a
 * prop that looks like dozens of objects costs about ten draw calls:
 *
 *   MetalBatch   chamfered housings in one textured, vertex-coloured material
 *   TraceBatch   thin glowing lines that never fall below about 1.5 pixels
 *   GlowBatch    soft additive sprites, lens flares and rising motes
 *   ScreenBatch  atlas-textured holographic panels with a crisp shader frame
 *   BeamBatch    additive light shafts
 *   PoolBatch    pools of light on a deck
 *
 * Thin lines are the look of this world, and thin geometry either vanishes or
 * crawls at the opening shot, where a unit is only seven pixels. So lines and
 * frames here are sized in the shader against the pixel grid: the same line is a
 * hairline from far away and a fine strip from close up.
 */

/** A point or size, written as a tuple so that layouts read as tables. */
export type V3 = readonly [number, number, number];

/** A pixel rectangle in an atlas: x, y, width, height. */
export type Region = readonly [number, number, number, number];

/* ─────────────────────────────── Shared clock ───────────────────────────── */

const shared = {
  uTime: { value: 0 },
  uViewHeight: { value: 941 },
};

/** Keeps the shaders' clock running. Frozen under reduced motion. */
export function useHoloClock(): void {
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  useFrame((state) => {
    if (!reducedMotion) shared.uTime.value = state.clock.elapsedTime;
    shared.uViewHeight.value = state.size.height * state.viewport.dpr;
  });
}

/** Build something on first use and reuse it for the life of the page, like the kit. */
export function once<T>(create: () => T): () => T {
  let value: T | undefined;
  return () => {
    value ??= create();
    return value;
  };
}

/** World size of one pixel at a view depth. */
const PIXEL_SIZE_GLSL = /* glsl */ `
  uniform float uViewHeight;
  float pixelSize(float depth) {
    return depth * 2.0 / (projectionMatrix[1][1] * uViewHeight);
  }
`;

function additive(parameters: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    ...parameters,
  });
}

function compose(at: V3, yaw = 0, pitch = 0, roll = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(at[0], at[1], at[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
}

function withBounds(geometry: THREE.BufferGeometry, margin: number): THREE.BufferGeometry {
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += margin;
  return geometry;
}

/* ────────────────────────────── Prop metal ──────────────────────────────── */

const METAL_TILE_PIXELS = 1024;
const METAL_CELL = 128;
/** World units covered by one repeat of the metal texture. */
const METAL_TILE_UNITS = 7;

function bakeTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function plateCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  return [canvas, context];
}

/** Sizes of plate tried at each free cell, largest first. */
const PLATE_SHAPES: readonly (readonly [number, number])[] = [
  [4, 2],
  [2, 4],
  [2, 2],
  [3, 1],
  [1, 3],
  [2, 1],
  [1, 2],
  [1, 1],
];

/**
 * Lay the tile out as a random packing of machined plates, then paint each one
 * into three maps at once, so that a seam darkens, roughens and recesses in the
 * same place. Plates stay inside the tile, which is what makes it repeat cleanly.
 */
function paintMetalMaps() {
  const rng = createRng(0x4d45544c);
  const [albedoCanvas, albedo] = plateCanvas(METAL_TILE_PIXELS);
  const [dataCanvas, data] = plateCanvas(METAL_TILE_PIXELS);
  const [lightsCanvas, lights] = plateCanvas(METAL_TILE_PIXELS);

  albedo.fillStyle = '#d8dbe0';
  albedo.fillRect(0, 0, METAL_TILE_PIXELS, METAL_TILE_PIXELS);
  /* R height, G roughness, B metalness, read by the bump, roughness and metalness maps. */
  data.fillStyle = 'rgb(128,120,180)';
  data.fillRect(0, 0, METAL_TILE_PIXELS, METAL_TILE_PIXELS);
  lights.fillStyle = '#000';
  lights.fillRect(0, 0, METAL_TILE_PIXELS, METAL_TILE_PIXELS);

  const cells = METAL_TILE_PIXELS / METAL_CELL;
  const taken = new Array<boolean>(cells * cells).fill(false);
  const free = (cx: number, cy: number, w: number, h: number) => {
    if (cx + w > cells || cy + h > cells) return false;
    for (let y = cy; y < cy + h; y += 1) {
      for (let x = cx; x < cx + w; x += 1) if (taken[y * cells + x]) return false;
    }
    return true;
  };

  for (let cy = 0; cy < cells; cy += 1) {
    for (let cx = 0; cx < cells; cx += 1) {
      if (taken[cy * cells + cx]) continue;
      const start = Math.floor(rng() * 4);
      const [w, h] =
        PLATE_SHAPES.slice(start).find(([pw, ph]) => free(cx, cy, pw, ph)) ?? ([1, 1] as const);
      for (let y = cy; y < cy + h; y += 1) {
        for (let x = cx; x < cx + w; x += 1) taken[y * cells + x] = true;
      }
      paintPlate(
        albedo,
        data,
        lights,
        rng,
        cx * METAL_CELL,
        cy * METAL_CELL,
        w * METAL_CELL,
        h * METAL_CELL,
      );
    }
  }

  /* Wear: fine scratches catch the light, and read as lower roughness. */
  for (let i = 0; i < 260; i += 1) {
    const x = rng() * METAL_TILE_PIXELS;
    const y = rng() * METAL_TILE_PIXELS;
    const angle = rng() * Math.PI;
    const length = rngBetween(rng, 8, 70);
    albedo.strokeStyle = `rgba(255,255,255,${rngBetween(rng, 0.04, 0.16)})`;
    albedo.lineWidth = 1;
    albedo.beginPath();
    albedo.moveTo(x, y);
    albedo.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    albedo.stroke();
  }

  return {
    albedo: bakeTexture(albedoCanvas, true),
    data: bakeTexture(dataCanvas, false),
    lights: bakeTexture(lightsCanvas, true),
  };
}

function paintPlate(
  albedo: CanvasRenderingContext2D,
  data: CanvasRenderingContext2D,
  lights: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const tone = Math.round(rngBetween(rng, 186, 244));
  const height = Math.round(rngBetween(rng, 110, 170));
  const rough = Math.round(rngBetween(rng, 84, 160));
  const metal = Math.round(rngBetween(rng, 165, 205));

  albedo.fillStyle = `rgb(${tone},${tone},${tone + 3})`;
  albedo.fillRect(x, y, w, h);
  data.fillStyle = `rgb(${height},${rough},${metal})`;
  data.fillRect(x, y, w, h);

  /* The seam: a dark recess with a lit lip on its upper edge. */
  albedo.strokeStyle = '#14161b';
  albedo.lineWidth = 3;
  albedo.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  albedo.strokeStyle = 'rgba(255,255,255,0.28)';
  albedo.lineWidth = 1;
  albedo.beginPath();
  albedo.moveTo(x + 4, y + 4.5);
  albedo.lineTo(x + w - 4, y + 4.5);
  albedo.stroke();
  data.strokeStyle = 'rgb(16,214,110)';
  data.lineWidth = 4;
  data.strokeRect(x + 2, y + 2, w - 4, h - 4);

  const feature = rng();
  if (w >= METAL_CELL * 2 && feature < 0.3) {
    paintVents(albedo, data, rng, x, y, w, h);
  } else if (feature < 0.55) {
    /* A shallow inset panel. */
    const inset = 18;
    albedo.strokeStyle = 'rgba(10,12,16,0.75)';
    albedo.lineWidth = 2;
    albedo.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    data.fillStyle = `rgb(${height - 34},${rough + 26},${metal - 15})`;
    data.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  } else if (feature < 0.7) {
    /* Stencilled service marks. */
    albedo.fillStyle = 'rgba(244,247,255,0.5)';
    for (let i = 0; i < 4; i += 1) {
      albedo.fillRect(x + 16, y + 18 + i * 7, rngBetween(rng, 14, Math.min(60, w - 32)), 3);
    }
  }

  /* Rivets at the corners of anything large. */
  if (w * h > METAL_CELL * METAL_CELL) {
    const inset = 11;
    for (const [rx, ry] of [
      [x + inset, y + inset],
      [x + w - inset, y + inset],
      [x + inset, y + h - inset],
      [x + w - inset, y + h - inset],
    ] as const) {
      albedo.fillStyle = '#0f1115';
      albedo.beginPath();
      albedo.arc(rx, ry, 4.5, 0, Math.PI * 2);
      albedo.fill();
      albedo.fillStyle = '#f2f4f8';
      albedo.beginPath();
      albedo.arc(rx - 0.6, ry - 0.6, 2.6, 0, Math.PI * 2);
      albedo.fill();
      data.fillStyle = 'rgb(236,70,250)';
      data.beginPath();
      data.arc(rx, ry, 3.6, 0, Math.PI * 2);
      data.fill();
    }
  }

  /* A few indicator lamps, sparse enough to read as equipment rather than noise. */
  if (rng() < 0.42) {
    const count = 3 + Math.floor(rng() * 5);
    const lx = x + rngBetween(rng, 14, Math.max(16, w - 70));
    const ly = y + h - rngBetween(rng, 14, 26);
    const hue = rng();
    lights.fillStyle = hue < 0.62 ? '#58a8ff' : hue < 0.86 ? '#9d6dff' : '#ffb35c';
    for (let i = 0; i < count; i += 1) {
      if (rng() > 0.78) continue;
      lights.fillRect(lx + i * 9, ly, 6, 3);
    }
  }
}

function paintVents(
  albedo: CanvasRenderingContext2D,
  data: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const slots = 5 + Math.floor(rng() * 5);
  const margin = 26;
  const pitch = (h - margin * 2) / slots;
  for (let i = 0; i < slots; i += 1) {
    const sy = y + margin + i * pitch;
    albedo.fillStyle = '#090a0d';
    albedo.fillRect(x + margin, sy, w - margin * 2, pitch * 0.48);
    data.fillStyle = 'rgb(18,200,120)';
    data.fillRect(x + margin, sy, w - margin * 2, pitch * 0.48);
  }
}

/** The hologram islands' shared structural material, derived from the kit's dark metal. */
export const getPropMetal = once(() => {
  const { albedo, data, lights } = paintMetalMaps();
  const material = getKit().metalDark.clone();
  material.color.set('#ffffff');
  material.vertexColors = true;
  material.map = albedo;
  material.bumpMap = data;
  material.bumpScale = 1.6;
  material.roughnessMap = data;
  material.roughness = 1;
  material.metalnessMap = data;
  material.metalness = 1;
  material.emissive.set('#ffffff');
  material.emissiveMap = lights;
  material.emissiveIntensity = 3.4;
  return material;
});

/* ────────────────────────────── MetalBatch ──────────────────────────────── */

/** Lighter than the kit's solid metals, because the albedo map darkens these again. */
const TONES = {
  deep: COLORS.metalDark,
  dark: COLORS.metal,
  mid: '#46526a',
  light: '#77859e',
} as const;

export type MetalTone = keyof typeof TONES;

interface PartOptions {
  tone?: MetalTone;
  yaw?: number;
  pitch?: number;
  roll?: number;
}

interface BoxOptions extends PartOptions {
  chamfer?: number;
}

interface RevolveOptions {
  tone?: MetalTone;
  /** Degrees around the axis, 0 towards +Z, increasing towards +X. Default a full turn. */
  from?: number;
  to?: number;
  segments?: number;
  /** Close the ends of a partial sweep. */
  caps?: boolean;
}

/** Adjacent profile facets closer than this are shaded as one smooth curve. */
const SMOOTH_PROFILE_DEGREES = 32;

/** Accumulates chamfered, textured solids into one mesh. */
export class MetalBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly rng: () => number;
  private readonly normalScratch = new THREE.Vector3();
  private readonly pointScratch = new THREE.Vector3();

  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  private emit(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    u: number,
    v: number,
    color: THREE.Color,
    matrix: THREE.Matrix4,
  ) {
    const p = this.pointScratch.copy(point).applyMatrix4(matrix);
    const n = this.normalScratch.copy(normal).transformDirection(matrix);
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    this.colors.push(color.r, color.g, color.b);
  }

  /** A flat convex polygon facing away from `outward`. Textured from its dominant plane. */
  private polygon(
    points: THREE.Vector3[],
    outward: THREE.Vector3,
    color: THREE.Color,
    matrix: THREE.Matrix4,
    offsetU: number,
    offsetV: number,
  ) {
    const [a, b, c] = points as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    const ordered = normal.dot(outward) < 0 ? [...points].reverse() : points;
    if (normal.dot(outward) < 0) normal.negate();

    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    const project = (p: THREE.Vector3): [number, number] => {
      if (absY >= absX && absY >= absZ) return [p.x, p.z];
      return absX >= absZ ? [p.z, p.y] : [p.x, p.y];
    };

    for (let i = 1; i < ordered.length - 1; i += 1) {
      for (const point of [ordered[0], ordered[i], ordered[i + 1]] as THREE.Vector3[]) {
        const [u, v] = project(point);
        this.emit(
          point,
          normal,
          u / METAL_TILE_UNITS + offsetU,
          v / METAL_TILE_UNITS + offsetV,
          color,
          matrix,
        );
      }
    }
  }

  /** A box with chamfered edges, so that its corners catch a thin line of light. */
  box(size: V3, at: V3, options: BoxOptions = {}): this {
    const half = [size[0] / 2, size[1] / 2, size[2] / 2] as [number, number, number];
    const chamfer = Math.min(options.chamfer ?? 0.09, Math.min(...half) * 0.6);
    const matrix = compose(at, options.yaw, options.pitch, options.roll);
    const color = new THREE.Color(TONES[options.tone ?? 'dark']);
    const offsetU = this.rng();
    const offsetV = this.rng();

    const point = (axis: number, value: number, a: number, b: number) => {
      const coordinates = [0, 0, 0];
      coordinates[axis] = value;
      coordinates[(axis + 1) % 3] = a;
      coordinates[(axis + 2) % 3] = b;
      return new THREE.Vector3(coordinates[0], coordinates[1], coordinates[2]);
    };
    const add = (points: THREE.Vector3[]) => {
      const outward = points
        .reduce((sum, p) => sum.add(p), new THREE.Vector3())
        .divideScalar(points.length);
      this.polygon(points, outward, color, matrix, offsetU, offsetV);
    };

    for (let axis = 0; axis < 3; axis += 1) {
      const h = half[axis] as number;
      const ha = half[(axis + 1) % 3] as number;
      const hb = half[(axis + 2) % 3] as number;
      const ia = ha - chamfer;
      const ib = hb - chamfer;
      const it = h - chamfer;
      for (const s of [-1, 1]) {
        add([
          point(axis, s * h, -ia, -ib),
          point(axis, s * h, ia, -ib),
          point(axis, s * h, ia, ib),
          point(axis, s * h, -ia, ib),
        ]);
        /* The chamfer towards the next axis's faces, then the corners, once each. */
        for (const t of [-1, 1]) {
          add([
            point(axis, s * h, t * ia, -ib),
            point(axis, s * h, t * ia, ib),
            point(axis, s * it, t * ha, ib),
            point(axis, s * it, t * ha, -ib),
          ]);
          if (axis > 0) continue;
          for (const r of [-1, 1]) {
            add([
              point(axis, s * h, t * ia, r * ib),
              point(axis, s * it, t * ha, r * ib),
              point(axis, s * it, t * ia, r * hb),
            ]);
          }
        }
      }
    }
    return this;
  }

  /**
   * Sweep a profile of [radius, height] pairs around a vertical axis. Run the
   * profile upward along the outside, so normals point away from the axis.
   */
  revolve(profile: readonly (readonly [number, number])[], at: V3, options: RevolveOptions = {}): this {
    const from = THREE.MathUtils.degToRad(options.from ?? 0);
    const to = THREE.MathUtils.degToRad(options.to ?? 360);
    const segments = options.segments ?? Math.max(6, Math.ceil(((to - from) / (Math.PI * 2)) * 72));
    const color = new THREE.Color(TONES[options.tone ?? 'dark']);
    const matrix = compose(at);
    const offsetU = this.rng();

    const facets = profile.slice(1).map((end, index) => {
      const start = profile[index] as readonly [number, number];
      const dr = end[0] - start[0];
      const dy = end[1] - start[1];
      const length = Math.hypot(dr, dy) || 1;
      return { start, end, normalR: dy / length, normalY: -dr / length, length };
    });

    const blended = (index: number, side: -1 | 1) => {
      const facet = facets[index] as (typeof facets)[number];
      const neighbour = facets[index + side];
      if (!neighbour) return [facet.normalR, facet.normalY] as const;
      const cosine = facet.normalR * neighbour.normalR + facet.normalY * neighbour.normalY;
      if (cosine < Math.cos(THREE.MathUtils.degToRad(SMOOTH_PROFILE_DEGREES))) {
        return [facet.normalR, facet.normalY] as const;
      }
      const r = facet.normalR + neighbour.normalR;
      const y = facet.normalY + neighbour.normalY;
      const length = Math.hypot(r, y) || 1;
      return [r / length, y / length] as const;
    };

    const onAxis = (r: number, y: number, angle: number) =>
      new THREE.Vector3(r * Math.sin(angle), y, r * Math.cos(angle));
    const normalAt = (nr: number, ny: number, angle: number) =>
      new THREE.Vector3(nr * Math.sin(angle), ny, nr * Math.cos(angle));

    let travelled = 0;
    facets.forEach((facet, index) => {
      const [nr0, ny0] = blended(index, -1);
      const [nr1, ny1] = blended(index, 1);
      const radius = (facet.start[0] + facet.end[0]) / 2;
      const v0 = travelled / METAL_TILE_UNITS;
      const v1 = (travelled + facet.length) / METAL_TILE_UNITS;

      for (let s = 0; s < segments; s += 1) {
        const a0 = from + ((to - from) * s) / segments;
        const a1 = from + ((to - from) * (s + 1)) / segments;
        const u0 = (a0 * radius) / METAL_TILE_UNITS + offsetU;
        const u1 = (a1 * radius) / METAL_TILE_UNITS + offsetU;
        const corners = [
          [facet.start, a0, nr0, ny0, u0, v0],
          [facet.start, a1, nr0, ny0, u1, v0],
          [facet.end, a1, nr1, ny1, u1, v1],
          [facet.end, a0, nr1, ny1, u0, v1],
        ] as const;
        for (const corner of [corners[0], corners[1], corners[2], corners[0], corners[2], corners[3]]) {
          const [ring, angle, nr, ny, u, v] = corner;
          this.emit(onAxis(ring[0], ring[1], angle), normalAt(nr, ny, angle), u, v, color, matrix);
        }
      }
      travelled += facet.length;
    });

    if (options.caps) {
      const contour = profile.map(([r, y]) => new THREE.Vector2(r, y));
      const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const [angle, side] of [
        [from, -1],
        [to, 1],
      ] as const) {
        const tangent = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(side);
        for (const triangle of triangles) {
          const points = triangle.map((i) => {
            const [r, y] = profile[i] as readonly [number, number];
            return onAxis(r, y, angle);
          });
          this.polygon(points, tangent, color, matrix, offsetU, 0);
        }
      }
    }
    return this;
  }

  /**
   * Extrude a section of [z, y] pairs along X, for sloped desks and fins. The
   * section must be convex or at least star-shaped about its centre.
   */
  prism(section: readonly (readonly [number, number])[], length: number, at: V3, options: PartOptions = {}): this {
    const matrix = compose(at, options.yaw, options.pitch, options.roll);
    const color = new THREE.Color(TONES[options.tone ?? 'dark']);
    const offsetU = this.rng();
    const offsetV = this.rng();
    const half = length / 2;
    const centre = section
      .reduce((sum, [z, y]) => sum.add(new THREE.Vector2(z, y)), new THREE.Vector2())
      .divideScalar(section.length);

    section.forEach(([z0, y0], index) => {
      const [z1, y1] = section[(index + 1) % section.length] as readonly [number, number];
      const outward = new THREE.Vector3(0, (y0 + y1) / 2 - centre.y, (z0 + z1) / 2 - centre.x);
      this.polygon(
        [
          new THREE.Vector3(-half, y0, z0),
          new THREE.Vector3(half, y0, z0),
          new THREE.Vector3(half, y1, z1),
          new THREE.Vector3(-half, y1, z1),
        ],
        outward,
        color,
        matrix,
        offsetU,
        offsetV,
      );
    });

    const contour = section.map(([z, y]) => new THREE.Vector2(z, y));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const side of [-1, 1]) {
      for (const triangle of triangles) {
        const points = triangle.map((i) => {
          const [z, y] = section[i] as readonly [number, number];
          return new THREE.Vector3(side * half, y, z);
        });
        this.polygon(points, new THREE.Vector3(side, 0, 0), color, matrix, offsetU, offsetV);
      }
    }
    return this;
  }

  /** A cable or conduit along a smooth path. */
  tube(path: readonly V3[], radius: number, tone: MetalTone = 'deep', radial = 6): this {
    const curve = new THREE.CatmullRomCurve3(path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geometry = new THREE.TubeGeometry(curve, path.length * 6, radius, radial, false);
    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const color = new THREE.Color(TONES[tone]);
    const identity = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    if (index) {
      for (let i = 0; i < index.count; i += 1) {
        const vertex = index.getX(i);
        p.fromBufferAttribute(position, vertex);
        n.fromBufferAttribute(normal, vertex);
        this.emit(p, n, uv.getX(vertex) * 2, uv.getY(vertex) * 0.2, color, identity);
      }
    }
    geometry.dispose();
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    return withBounds(geometry, 0);
  }
}

/* ────────────────────────────── TraceBatch ──────────────────────────────── */

export interface TraceStyle {
  color: string;
  /** HDR multiplier. */
  intensity?: number;
  /** World width. The shader keeps it at least about 1.5 pixels wide. */
  width?: number;
  /** Comets per second along the line. Omit for a steady line. */
  flow?: number;
  /** Spacing of the comets, in world units. */
  dash?: number;
  /** Brightness at a point along the line, 0–1, for lines that fade out. */
  shade?: (point: THREE.Vector3) => number;
}

/** Two axes spanning the plane of a circle. */
export interface ArcPlane {
  u: V3;
  v: V3;
}

/** The deck's plane. Angle 0 is +Z, and angles turn towards +X. */
export const FLAT: ArcPlane = { u: [0, 0, 1], v: [1, 0, 0] };
/** Upright, facing +Z. Angle 0 is +X, and angles turn towards +Y. */
export const FACING: ArcPlane = { u: [1, 0, 0], v: [0, 1, 0] };

const DEGREES_PER_SEGMENT = 3;

/** Camera-facing ribbons, batched into one draw call. */
export class TraceBatch {
  private readonly positions: number[] = [];
  private readonly tangents: number[] = [];
  private readonly ribbons: number[] = [];
  private readonly colors: number[] = [];
  private readonly flows: number[] = [];
  private readonly indices: number[] = [];

  line(points: readonly THREE.Vector3[], style: TraceStyle, closed = false): this {
    const color = hdr(style.color, style.intensity ?? 3);
    const halfWidth = (style.width ?? 0.05) / 2;
    const dash = style.dash ?? 3;
    const count = points.length + (closed ? 1 : 0);
    const at = (i: number) => points[(i + points.length) % points.length] as THREE.Vector3;
    const tangent = new THREE.Vector3();
    const base = this.positions.length / 3;
    let run = 0;

    for (let i = 0; i < count; i += 1) {
      const point = at(i);
      const previous = closed || i > 0 ? at(i - 1) : point;
      const next = closed || i < count - 1 ? at(i + 1) : point;
      tangent.subVectors(next, previous).normalize();
      if (i > 0) run += point.distanceTo(at(i - 1));
      const shade = style.shade?.(point) ?? 1;

      for (const side of [-1, 1]) {
        this.positions.push(point.x, point.y, point.z);
        this.tangents.push(tangent.x, tangent.y, tangent.z);
        this.ribbons.push(side, halfWidth);
        this.colors.push(color.r * shade, color.g * shade, color.b * shade);
        this.flows.push(run / dash, style.flow ?? 0);
      }
      if (i < count - 1) {
        const a = base + i * 2;
        this.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    return this;
  }

  segment(from: V3, to: V3, style: TraceStyle): this {
    return this.line(
      [new THREE.Vector3(...from), new THREE.Vector3(...to)],
      style,
    );
  }

  /** Part of a circle. Angles are degrees in the plane, from `plane.u` towards `plane.v`. */
  arc(center: V3, radius: number, from: number, to: number, style: TraceStyle, plane = FLAT): this {
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / DEGREES_PER_SEGMENT));
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= steps; step += 1) {
      points.push(circlePoint(center, radius, from + ((to - from) * step) / steps, plane));
    }
    return this.line(points, style);
  }

  ring(center: V3, radius: number, style: TraceStyle, plane = FLAT): this {
    const steps = Math.ceil(360 / DEGREES_PER_SEGMENT);
    const points: THREE.Vector3[] = [];
    for (let step = 0; step < steps; step += 1) {
      points.push(circlePoint(center, radius, (360 * step) / steps, plane));
    }
    return this.line(points, style, true);
  }

  /** Short radial marks around a circle. */
  ticks(center: V3, radius: number, length: number, count: number, style: TraceStyle, plane = FLAT): this {
    for (let i = 0; i < count; i += 1) {
      const angle = (360 * i) / count;
      this.line(
        [circlePoint(center, radius, angle, plane), circlePoint(center, radius + length, angle, plane)],
        style,
      );
    }
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('aTangent', new THREE.Float32BufferAttribute(this.tangents, 3));
    geometry.setAttribute('aRibbon', new THREE.Float32BufferAttribute(this.ribbons, 2));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(this.flows, 2));
    geometry.setIndex(this.indices);
    return withBounds(geometry, 0.5);
  }
}

/** A point on a circle in a plane. */
export function circlePoint(center: V3, radius: number, degrees: number, plane: ArcPlane): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(degrees);
  const cos = Math.cos(angle) * radius;
  const sin = Math.sin(angle) * radius;
  return new THREE.Vector3(
    center[0] + plane.u[0] * cos + plane.v[0] * sin,
    center[1] + plane.u[1] * cos + plane.v[1] * sin,
    center[2] + plane.u[2] * cos + plane.v[2] * sin,
  );
}

export const getTraceMaterial = once(() =>
  additive({
    side: THREE.DoubleSide,
    uniforms: { uTime: shared.uTime, uViewHeight: shared.uViewHeight },
    vertexShader: /* glsl */ `
      ${PIXEL_SIZE_GLSL}
      attribute vec3 aTangent;
      attribute vec2 aRibbon;
      attribute vec3 aColor;
      attribute vec2 aFlow;
      varying vec3 vColor;
      varying float vSide;
      varying vec2 vFlow;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vec3 tangent = mat3(modelViewMatrix) * aTangent;
        vec3 across = cross(tangent, view.xyz);
        float squared = dot(across, across);
        across = squared > 1e-10 ? across / sqrt(squared) : vec3(1.0, 0.0, 0.0);

        float minimum = pixelSize(-view.z) * 0.85;
        view.xyz += across * aRibbon.x * max(aRibbon.y, minimum);

        /* A widened line gives back energy, so fine wires melt away with distance. */
        vColor = aColor * sqrt(min(1.0, aRibbon.y / minimum));
        vSide = aRibbon.x;
        vFlow = aFlow;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vColor;
      varying float vSide;
      varying vec2 vFlow;

      void main() {
        float profile = 1.0 - smoothstep(0.25, 1.0, abs(vSide));
        float energy = 1.0;
        if (vFlow.y != 0.0) {
          float comet = fract(vFlow.x - uTime * vFlow.y);
          energy = 0.16 + 2.4 * comet * comet * comet;
        }
        gl_FragColor = vec4(vColor * profile * energy, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);

/* ─────────────────────────────── GlowBatch ──────────────────────────────── */

interface GlowOptions {
  /** Strength of the four-point lens flare added to the soft core. */
  flare?: number;
  /** Rise this many units and fade, on a loop. Used for motes. */
  rise?: number;
  /** Loops per second. */
  speed?: number;
  /** Offset within the loop, 0–1. */
  phase?: number;
}

/** Soft camera-facing sprites in one draw call, unlike `Sprite`, which costs one each. */
export class GlowBatch {
  private readonly positions: number[] = [];
  private readonly corners: number[] = [];
  private readonly sizes: number[] = [];
  private readonly colors: number[] = [];
  private readonly motions: number[] = [];
  private readonly indices: number[] = [];

  /** `size` is the sprite's world radius. */
  add(at: V3, size: number, color: string, intensity = 1, options: GlowOptions = {}): this {
    const value = hdr(color, intensity);
    const base = this.positions.length / 3;
    for (const [cx, cy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      this.positions.push(at[0], at[1], at[2]);
      this.corners.push(cx, cy);
      this.sizes.push(size, options.flare ?? 0);
      this.colors.push(value.r, value.g, value.b);
      this.motions.push(options.rise ?? 0, options.speed ?? 0, options.phase ?? 0);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute(this.corners, 2));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(this.sizes, 2));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aMotion', new THREE.Float32BufferAttribute(this.motions, 3));
    geometry.setIndex(this.indices);
    return withBounds(geometry, 6);
  }
}

export const getGlowMaterial = once(() =>
  additive({
    uniforms: { uTime: shared.uTime, uViewHeight: shared.uViewHeight },
    vertexShader: /* glsl */ `
      ${PIXEL_SIZE_GLSL}
      uniform float uTime;
      attribute vec2 aCorner;
      attribute vec2 aSize;
      attribute vec3 aColor;
      attribute vec3 aMotion;
      varying vec2 vCorner;
      varying vec3 vColor;
      varying float vFlare;

      void main() {
        vec3 center = position;
        float fade = 1.0;
        if (aMotion.y != 0.0) {
          float t = fract(uTime * aMotion.y + aMotion.z);
          center.y += t * aMotion.x;
          fade = sin(t * 3.14159);
        }
        vec4 view = modelViewMatrix * vec4(center, 1.0);
        float minimum = pixelSize(-view.z) * 1.5;
        float size = max(aSize.x, minimum);
        view.xy += aCorner * size;

        vCorner = aCorner;
        vColor = aColor * fade * min(1.0, aSize.x / minimum * 0.6 + 0.4);
        vFlare = aSize.y;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vCorner;
      varying vec3 vColor;
      varying float vFlare;

      void main() {
        float radius2 = dot(vCorner, vCorner);
        float falloff = max(0.0, 1.0 - radius2);
        float soft = falloff * falloff * falloff;
        float glow = soft * (0.35 + 0.65 * exp(-radius2 * 16.0));
        float spikes = exp(-abs(vCorner.y) * 46.0) + exp(-abs(vCorner.x) * 46.0);
        float value = glow + vFlare * spikes * soft;
        gl_FragColor = vec4(vColor * value, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);

/* ────────────────────────────── ScreenBatch ─────────────────────────────── */

export interface ScreenSpec {
  region: Region;
  at: V3;
  width: number;
  height: number;
  yaw?: number;
  pitch?: number;
  /** Radius of the cylinder the panel wraps around, concave towards its viewer. Omit for flat. */
  curve?: number;
  /** HDR frame colour. Omit for a frameless panel. */
  frame?: THREE.Color;
  frameWidth?: number;
  /** Corner radius in world units. Half the height of a square gives a disc. */
  corner?: number;
  /** Multiplier on the atlas. Above about 1.5, its brightest marks begin to bloom. */
  gain?: number;
  /** Height of the gentle float. */
  bob?: number;
  /** Offsets the float and flicker so that screens do not move in step. */
  phase?: number;
  /** Brightness of the reverse side. Default 0.42. */
  back?: number;
  /** Mirror the atlas region left to right. */
  flip?: boolean;
}

const CURVE_COLUMNS = 28;

/** Holographic panels sharing one atlas. They merge, so any number costs one draw call. */
export class ScreenBatch {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly locals: number[] = [];
  private readonly frames: number[] = [];
  private readonly shapes: number[] = [];
  private readonly motions: number[] = [];
  private readonly indices: number[] = [];

  constructor(
    private readonly atlasWidth: number,
    private readonly atlasHeight: number,
  ) {}

  add(spec: ScreenSpec): this {
    const columns = spec.curve ? CURVE_COLUMNS : 1;
    const matrix = compose(spec.at, spec.yaw, spec.pitch);
    const [rx, ry, rw, rh] = spec.region;
    const halfWidth = spec.width / 2;
    const halfHeight = spec.height / 2;
    const frame = spec.frame ?? new THREE.Color(0, 0, 0);
    const base = this.positions.length / 3;
    const point = new THREE.Vector3();

    for (let column = 0; column <= columns; column += 1) {
      const across = column / columns;
      const x = (across * 2 - 1) * halfWidth;
      for (const row of [0, 1]) {
        const y = (row * 2 - 1) * halfHeight;
        if (spec.curve) {
          const angle = x / spec.curve;
          point.set(spec.curve * Math.sin(angle), y, spec.curve * (1 - Math.cos(angle)));
        } else {
          point.set(x, y, 0);
        }
        point.applyMatrix4(matrix);
        this.positions.push(point.x, point.y, point.z);
        this.uvs.push(
          (rx + (spec.flip ? 1 - across : across) * rw) / this.atlasWidth,
          1 - (ry + (1 - row) * rh) / this.atlasHeight,
        );
        this.locals.push(x, y, halfWidth, halfHeight);
        this.frames.push(frame.r, frame.g, frame.b);
        this.shapes.push(spec.corner ?? 0.22, spec.frameWidth ?? 0.05, spec.gain ?? 1.4);
        this.motions.push(spec.bob ?? 0, spec.phase ?? 0, spec.back ?? 0.42);
      }
      if (column < columns) {
        const a = base + column * 2;
        this.indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
    return this;
  }

  /** A panel that reads correctly from both sides, rather than mirrored from behind. */
  addTwoSided(spec: ScreenSpec): this {
    this.add({ ...spec, back: 0 });
    return this.add({
      ...spec,
      back: 0,
      yaw: (spec.yaw ?? 0) + Math.PI,
      curve: spec.curve ? -spec.curve : undefined,
    });
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('aLocal', new THREE.Float32BufferAttribute(this.locals, 4));
    geometry.setAttribute('aFrame', new THREE.Float32BufferAttribute(this.frames, 3));
    geometry.setAttribute('aShape', new THREE.Float32BufferAttribute(this.shapes, 3));
    geometry.setAttribute('aMotion', new THREE.Float32BufferAttribute(this.motions, 3));
    geometry.setIndex(this.indices);
    return withBounds(geometry, 0.5);
  }
}

const screenMaterials = new Map<THREE.Texture, THREE.ShaderMaterial>();

/** The panel shader for an atlas: its frame, scan lines and flicker are all in here. */
export function getScreenMaterial(atlas: THREE.Texture): THREE.ShaderMaterial {
  let material = screenMaterials.get(atlas);
  if (material) return material;

  material = additive({
    side: THREE.DoubleSide,
    uniforms: { uTime: shared.uTime, uMap: { value: atlas } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aLocal;
      attribute vec3 aFrame;
      attribute vec3 aShape;
      attribute vec3 aMotion;
      varying vec2 vUv;
      varying vec4 vLocal;
      varying vec3 vFrame;
      varying vec3 vShape;
      varying float vPhase;
      varying float vBack;

      void main() {
        vec3 moved = position;
        moved.y += sin(uTime * 0.6 + aMotion.y * 6.283) * aMotion.x;
        vUv = uv;
        vLocal = aLocal;
        vFrame = aFrame;
        vShape = aShape;
        vPhase = aMotion.y;
        vBack = aMotion.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec4 vLocal;
      varying vec3 vFrame;
      varying vec3 vShape;
      varying float vPhase;
      varying float vBack;

      float roundedBox(vec2 point, vec2 size, float radius) {
        vec2 q = abs(point) - size + radius;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      void main() {
        float corner = vShape.x;
        float lineWidth = vShape.y;
        float gain = vShape.z;

        float edge = roundedBox(vLocal.xy, vLocal.zw, corner);
        float pixel = fwidth(edge);
        float mask = 1.0 - smoothstep(-pixel, pixel * 0.5, edge);
        if (mask < 0.004) discard;

        /* The frame stays at least a pixel and a half wide however far away it is. */
        float line = max(lineWidth, pixel * 1.5);
        float frame = 1.0 - smoothstep(line * 0.5, line * 0.5 + pixel, abs(edge + line));
        frame *= sqrt(lineWidth / line);
        float haze = exp(edge / 0.42) * 0.09;

        /* Fine scan lines, faded out before they could alias. */
        float rows = vLocal.y * 30.0;
        float rowPixel = fwidth(rows);
        float scan = 1.0 - 0.14 * clamp(1.4 - rowPixel, 0.0, 1.0) * (0.5 + 0.5 * sin(rows * 6.283));

        /* A slow band of brightness sweeping down the panel. */
        float height01 = vLocal.y / vLocal.w * 0.5 + 0.5;
        float band = fract(uTime * 0.11 + vPhase - height01);
        float sweep = 1.0 + 0.5 * band * band * band * band * band * band;

        float flicker = 0.965 + 0.035 * sin(uTime * 41.0 + vPhase * 37.0) * sin(uTime * 7.3 + vPhase * 11.0);

        vec3 content = texture2D(uMap, vUv).rgb * gain * scan * sweep * flicker;
        vec3 color = content + vFrame * (frame + haze);
        color *= mask * (gl_FrontFacing ? 1.0 : vBack);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  screenMaterials.set(atlas, material);
  return material;
}

/* ─────────────────────────────── Holograms ──────────────────────────────── */

interface BodyOptions {
  /** HDR colour of the limb. */
  rim: THREE.Color;
  /** HDR colour of the contour lines and the faint fill. */
  fill: THREE.Color;
  /** Tightness of the limb. Higher hugs the silhouette. */
  power?: number;
  /** Contour lines per unit of height. Zero for none. */
  lines?: number;
  /** Faint fill across the whole surface. */
  body?: number;
  /** Local heights between which the hologram fades in from nothing. */
  fadeFrom?: number;
  fadeTo?: number;
  /** Soft spherical limit in local space: x, y, z, radius. Omit for none. */
  sphere?: THREE.Vector4;
}

/**
 * A hologram of a solid thing: a bright limb from a fresnel term, contour lines
 * in local height, and very little in between. Rendered double-sided and
 * additive, so the far side of the form is seen through the near side.
 */
export function createBodyMaterial(options: BodyOptions): THREE.ShaderMaterial {
  return additive({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime,
      uRim: { value: options.rim },
      uFill: { value: options.fill },
      uPower: { value: options.power ?? 2.6 },
      uLines: { value: options.lines ?? 3 },
      uBody: { value: options.body ?? 0.06 },
      uFade: { value: new THREE.Vector2(options.fadeFrom ?? -1e4, options.fadeTo ?? -1e4 + 1) },
      uSphere: { value: options.sphere ?? new THREE.Vector4(0, 0, 0, 1e4) },
    },
    vertexShader: /* glsl */ `
      attribute float aGlow;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vLocal;
      varying float vGlow;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vView = -view.xyz;
        vLocal = position;
        vGlow = aGlow;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uRim;
      uniform vec3 uFill;
      uniform float uPower;
      uniform float uLines;
      uniform float uBody;
      uniform vec2 uFade;
      uniform vec4 uSphere;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vLocal;
      varying float vGlow;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 toCamera = normalize(vView);
        float facing = abs(dot(normal, toCamera));
        float rim = pow(1.0 - facing, uPower);

        /* Contour lines, dissolving into an even tone before they could alias. */
        float row = vLocal.y * uLines - uTime * 0.18;
        float rowPixel = fwidth(row);
        float lineWidth = 0.05 + rowPixel;
        float line = 1.0 - smoothstep(lineWidth * 0.5, lineWidth, abs(fract(row) - 0.5));
        line *= clamp(1.4 - rowPixel * 2.0, 0.0, 1.0) * step(0.001, uLines);

        float fade = smoothstep(uFade.x, uFade.y, vLocal.y);
        fade *= 1.0 - smoothstep(uSphere.w - 0.9, uSphere.w, distance(vLocal, uSphere.xyz));
        float side = gl_FrontFacing ? 1.0 : 0.55;
        vec3 color = (uRim * rim + uFill * (uBody + vGlow + line * 0.55)) * fade * side;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

interface BustRow {
  y: number;
  halfWidth: number;
  halfDepth: number;
  forward: number;
}

/**
 * Cross-sections of a head and shoulders, from the chest to the crown. Proportions
 * follow the reference: the head 1.35 times as tall as it is wide, the neck 0.7 of
 * the head's width, and the shoulders 2.1 times it.
 */
const BUST_ROWS: readonly BustRow[] = [
  { y: 0, halfWidth: 3.95, halfDepth: 1.95, forward: 0 },
  { y: 0.9, halfWidth: 3.88, halfDepth: 2, forward: 0 },
  { y: 1.7, halfWidth: 3.55, halfDepth: 1.95, forward: 0 },
  { y: 2.3, halfWidth: 2.95, halfDepth: 1.8, forward: -0.02 },
  { y: 2.75, halfWidth: 2.2, halfDepth: 1.6, forward: -0.06 },
  { y: 3.15, halfWidth: 1.62, halfDepth: 1.42, forward: -0.1 },
  { y: 3.55, halfWidth: 1.34, halfDepth: 1.3, forward: -0.1 },
  { y: 4, halfWidth: 1.28, halfDepth: 1.3, forward: -0.04 },
  { y: 4.4, halfWidth: 1.3, halfDepth: 1.52, forward: 0.1 },
  { y: 4.8, halfWidth: 1.46, halfDepth: 1.84, forward: 0.18 },
  { y: 5.4, halfWidth: 1.66, halfDepth: 2.1, forward: 0.2 },
  { y: 6.1, halfWidth: 1.8, halfDepth: 2.3, forward: 0.16 },
  { y: 6.9, halfWidth: 1.87, halfDepth: 2.4, forward: 0.1 },
  { y: 7.7, halfWidth: 1.82, halfDepth: 2.36, forward: 0.04 },
  { y: 8.4, halfWidth: 1.6, halfDepth: 2.1, forward: 0 },
  { y: 8.95, halfWidth: 1.18, halfDepth: 1.58, forward: -0.03 },
  { y: 9.32, halfWidth: 0.6, halfDepth: 0.84, forward: -0.04 },
  { y: 9.46, halfWidth: 0.02, halfDepth: 0.02, forward: -0.04 },
];

function bell(value: number, center: number, width: number): number {
  const t = (value - center) / width;
  return Math.exp(-t * t);
}

/** Radial relief of the face: `theta` is 0 at the front, `y` is the height in the bust. */
function faceRelief(theta: number, y: number): number {
  const side = Math.abs(theta);
  const nose = 0.56 * bell(theta, 0, 0.17) * bell(y, 6.05, 0.62);
  const brow = 0.12 * bell(theta, 0, 0.8) * bell(y, 6.95, 0.26);
  const socket = -0.2 * bell(side, 0.46, 0.2) * bell(y, 6.62, 0.3);
  const lips = 0.13 * bell(theta, 0, 0.3) * bell(y, 5.42, 0.2);
  const chin = 0.26 * bell(theta, 0, 0.42) * bell(y, 4.84, 0.3);
  const ears = 0.44 * bell(side, 1.56, 0.17) * bell(y, 6.22, 0.66);
  return nose + brow + socket + lips + chin + ears;
}

const getBustProfile = once(() => ({
  widths: new THREE.CatmullRomCurve3(
    BUST_ROWS.map((row) => new THREE.Vector3(row.halfWidth, row.y, row.halfDepth)),
    false,
    'centripetal',
  ),
  forwards: new THREE.CatmullRomCurve3(
    BUST_ROWS.map((row) => new THREE.Vector3(row.forward, row.y, 0)),
    false,
    'centripetal',
  ),
}));

const bustSize = new THREE.Vector3();
const bustLean = new THREE.Vector3();

/** A point on the bust. `along` runs 0–1 from chest to crown, `theta` is 0 at the front. */
export function bustPoint(along: number, theta: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { widths, forwards } = getBustProfile();
  widths.getPoint(along, bustSize);
  forwards.getPoint(along, bustLean);

  /* Shoulders are boxier than a head, so the section sharpens towards the bottom. */
  const squareness = THREE.MathUtils.lerp(0.72, 1, THREE.MathUtils.smoothstep(bustSize.y, 2.4, 3.4));
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const relief = bustSize.y > 4 ? faceRelief(theta, bustSize.y) : 0;
  return out.set(
    Math.sign(sin) * Math.abs(sin) ** squareness * (bustSize.x + relief),
    bustSize.y,
    Math.sign(cos) * Math.abs(cos) ** squareness * (bustSize.z + relief) + bustLean.x,
  );
}

/** A head and shoulders about 9.5 units tall, facing +Z, its base at y = 0. */
export function buildBustGeometry(rings: number, around: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let step = 0; step < around; step += 1) {
      bustPoint(ring / rings, (step / around) * Math.PI * 2 - Math.PI, point);
      positions.push(point.x, point.y, point.z);
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let step = 0; step < around; step += 1) {
      const next = (step + 1) % around;
      const a = ring * around + step;
      const b = ring * around + next;
      const c = (ring + 1) * around + step;
      const d = (ring + 1) * around + next;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const getBustGeometry = once(() => buildBustGeometry(96, 72));

/* ──────────────────────────────── Beams ─────────────────────────────────── */

const BEAM_SIDES = 24;

/** Soft shafts of light. Rendered as open cones that fade towards the top and the limb. */
export class BeamBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly fades: number[] = [];
  private readonly indices: number[] = [];

  add(base: V3, radiusBottom: number, radiusTop: number, height: number, color: string, intensity = 1): this {
    const value = hdr(color, intensity);
    const start = this.positions.length / 3;
    const slope = (radiusBottom - radiusTop) / height;
    for (let side = 0; side <= BEAM_SIDES; side += 1) {
      const angle = (side / BEAM_SIDES) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      for (const row of [0, 1]) {
        const radius = row === 0 ? radiusBottom : radiusTop;
        this.positions.push(
          base[0] + sin * radius,
          base[1] + row * height,
          base[2] + cos * radius,
        );
        this.normals.push(sin, slope, cos);
        this.colors.push(value.r, value.g, value.b);
        this.fades.push(row);
      }
      if (side < BEAM_SIDES) {
        const a = start + side * 2;
        this.indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
      }
    }
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(this.fades, 1));
    geometry.setIndex(this.indices);
    return withBounds(geometry, 0.5);
  }
}

export const getBeamMaterial = once(() =>
  additive({
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aFade;
      varying vec3 vColor;
      varying float vFade;
      varying vec3 vNormal;
      varying vec3 vView;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vColor = aColor;
        vFade = aFade;
        vNormal = normalMatrix * normal;
        vView = -view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vFade;
      varying vec3 vNormal;
      varying vec3 vView;

      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float along = (1.0 - vFade) * (1.0 - vFade);
        gl_FragColor = vec4(vColor * along * facing * facing * smoothstep(0.0, 0.05, vFade), 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);

/* ──────────────────────────────── Pools ─────────────────────────────────── */

/** Flat pools of light on a surface: how an unlit hologram appears to light its surroundings. */
export class PoolBatch {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  add(at: V3, radius: number, color: string, intensity = 0.5, depth = radius): this {
    const value = hdr(color, intensity);
    const base = this.positions.length / 3;
    for (const [cx, cz] of [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ] as const) {
      this.positions.push(at[0] + cx * radius, at[1], at[2] + cz * depth);
      this.uvs.push((cx + 1) / 2, (cz + 1) / 2);
      this.colors.push(value.r, value.g, value.b);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    return withBounds(geometry, 0);
  }
}

export const getPoolMaterial = once(
  () =>
    new THREE.MeshBasicMaterial({
      map: getKit().glowTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
);

/* ─────────────────────────────── Atlases ────────────────────────────────── */

const HOLO_SANS = '"Holo Sans", system-ui, sans-serif';
export const HOLO_MONO = '"Holo Mono", ui-monospace, monospace';

const loadHoloFonts = once(() => {
  const faces = [
    new FontFace('Holo Sans', 'url(/fonts/Geist-SemiBold.ttf)'),
    new FontFace('Holo Mono', 'url(/fonts/GeistMono-Medium.ttf)'),
  ];
  return Promise.allSettled(
    faces.map(async (face) => {
      document.fonts.add(await face.load());
    }),
  );
});

/**
 * A canvas atlas painted once. Painting waits for the local fonts, so text is
 * never drawn twice; a missing font just falls back to a system face.
 */
export function createAtlas(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  const texture = new THREE.Texture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  void loadHoloFonts().then(() => {
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    paint(context);
    texture.needsUpdate = true;
  });
  return texture;
}

interface TextStyle {
  size: number;
  color: string;
  font?: string;
  align?: CanvasTextAlign;
  /** Soft halo around the letters, in pixels. */
  glow?: number;
  /** Extra space between letters, in pixels. */
  tracking?: number;
}

export function paintText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): void {
  context.save();
  context.font = `${style.size}px ${style.font ?? HOLO_SANS}`;
  context.fillStyle = style.color;
  context.textAlign = style.align ?? 'left';
  context.textBaseline = 'alphabetic';
  context.letterSpacing = `${style.tracking ?? 0}px`;
  if (style.glow) {
    context.shadowColor = style.color;
    context.shadowBlur = style.glow;
  }
  context.fillText(text, x, y);
  context.restore();
}

/** Vertical bars from a baseline. `values` run 0–1. */
export function paintBars(
  context: CanvasRenderingContext2D,
  region: Region,
  values: readonly number[],
  color: string,
  glow = 6,
): void {
  const [x, y, w, h] = region;
  const pitch = w / values.length;
  context.save();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = glow;
  values.forEach((value, index) => {
    const height = value * h;
    context.fillRect(x + index * pitch, y + h - height, pitch * 0.62, height);
  });
  context.restore();
}

/** A line chart with a soft fill beneath it. `values` run 0–1. */
export function paintSpark(
  context: CanvasRenderingContext2D,
  region: Region,
  values: readonly number[],
  color: string,
  lineWidth = 2.5,
): void {
  const [x, y, w, h] = region;
  const at = (index: number): [number, number] => [
    x + (index / (values.length - 1)) * w,
    y + h - (values[index] as number) * h,
  ];
  context.save();
  context.beginPath();
  values.forEach((_, index) => {
    const [px, py] = at(index);
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.stroke();
  context.shadowBlur = 0;
  context.lineTo(x + w, y + h);
  context.lineTo(x, y + h);
  context.closePath();
  const gradient = context.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.globalAlpha = 0.28;
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

/** Stacked short rows of text-shaped marks, for detail too small to be read. */
export function paintRows(
  context: CanvasRenderingContext2D,
  region: Region,
  rows: number,
  color: string,
  rng: () => number,
): void {
  const [x, y, w, h] = region;
  const pitch = h / rows;
  context.save();
  context.fillStyle = color;
  for (let row = 0; row < rows; row += 1) {
    let cursor = x;
    const end = x + w * rngBetween(rng, 0.45, 1);
    while (cursor < end) {
      const word = rngBetween(rng, pitch * 0.9, pitch * 3.4);
      context.fillRect(cursor, y + row * pitch, Math.min(word, end - cursor), pitch * 0.42);
      cursor += word + pitch * 0.6;
    }
  }
  context.restore();
}

/** Rows of small status lamps on dark glass, for panels let into equipment. */
export function paintLeds(
  context: CanvasRenderingContext2D,
  region: Region,
  columns: number,
  rows: number,
  palette: readonly string[],
  rng: () => number,
): void {
  const [x, y, w, h] = region;
  const pitchX = w / columns;
  const pitchY = h / rows;
  context.save();
  context.fillStyle = 'rgba(8,28,92,0.82)';
  context.fillRect(x, y, w, h);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (rng() < 0.3) continue;
      context.fillStyle = palette[Math.floor(rng() * palette.length)] ?? '#58b8ff';
      context.globalAlpha = rngBetween(rng, 0.4, 1);
      context.fillRect(
        x + (column + 0.18) * pitchX,
        y + (row + 0.3) * pitchY,
        pitchX * 0.64,
        pitchY * 0.4,
      );
    }
  }
  context.restore();
}

/** A faint alignment grid, the texture of every engineer's dashboard. */
export function paintGrid(
  context: CanvasRenderingContext2D,
  region: Region,
  step: number,
  color: string,
): void {
  const [x, y, w, h] = region;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  for (let px = x; px <= x + w; px += step) {
    context.moveTo(px + 0.5, y);
    context.lineTo(px + 0.5, y + h);
  }
  for (let py = y; py <= y + h; py += step) {
    context.moveTo(x, py + 0.5);
    context.lineTo(x + w, py + 0.5);
  }
  context.stroke();
  context.restore();
}

/** A smoothed random series in 0–1, for charts that show shape rather than data. */
export function makeSeries(seed: number, count: number, floor = 0.15, ceiling = 0.95): number[] {
  const rng = createRng(seed);
  let value = rngBetween(rng, floor, ceiling);
  return Array.from({ length: count }, () => {
    value = THREE.MathUtils.clamp(value + rngBetween(rng, -0.22, 0.24), floor, ceiling);
    return value;
  });
}
