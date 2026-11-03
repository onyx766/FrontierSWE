'use client';

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng, rngBetween } from '@/lib/rng';
import { getKit } from '../../kit';
import { COLORS } from '../../palette';

/**
 * Shared kit for the machinery on the Backend Engine, Data Vault and Experience
 * Archive: bevel-shaded geometry that merges into a handful of draw calls, the
 * one baked server-rack atlas all three islands draw from, and the additive
 * glow materials. GPU resources are built on first use and live for the page,
 * like `getKit()`, so returning from a case study does not rebake anything.
 */

/* ──────────────────────────────── Geometry ──────────────────────────────── */

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface BoxFaces {
  front: UvRect;
  back: UvRect;
  left: UvRect;
  right: UvRect;
  top: UvRect;
  bottom: UvRect;
  /** Where the chamfers sample: a patch of lighter, worn metal. */
  edge: UvRect;
}

type Axis = 0 | 1 | 2;
type Triple = [number, number, number];

interface SoupVertex {
  position: Triple;
  normal: Triple;
  uv: [number, number];
}

/** Collects triangles, flipping any that would wind against their own normals. */
class TriangleSoup {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];

  triangle(a: SoupVertex, b: SoupVertex, c: SoupVertex) {
    const [ax, ay, az] = a.position;
    const ux = b.position[0] - ax;
    const uy = b.position[1] - ay;
    const uz = b.position[2] - az;
    const vx = c.position[0] - ax;
    const vy = c.position[1] - ay;
    const vz = c.position[2] - az;
    const facing =
      (uy * vz - uz * vy) * (a.normal[0] + b.normal[0] + c.normal[0]) +
      (uz * vx - ux * vz) * (a.normal[1] + b.normal[1] + c.normal[1]) +
      (ux * vy - uy * vx) * (a.normal[2] + b.normal[2] + c.normal[2]);

    for (const vertex of facing >= 0 ? [a, b, c] : [a, c, b]) {
      this.positions.push(...vertex.position);
      this.normals.push(...vertex.normal);
      this.uvs.push(...vertex.uv);
    }
  }

  quad(a: SoupVertex, b: SoupVertex, c: SoupVertex, d: SoupVertex) {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    return geometry;
  }
}

const FACE_LAYOUT: {
  face: keyof Omit<BoxFaces, 'edge'>;
  axis: Axis;
  sign: 1 | -1;
  right: Axis;
  rightSign: 1 | -1;
  up: Axis;
  upSign: 1 | -1;
}[] = [
  { face: 'front', axis: 2, sign: 1, right: 0, rightSign: 1, up: 1, upSign: 1 },
  { face: 'back', axis: 2, sign: -1, right: 0, rightSign: -1, up: 1, upSign: 1 },
  { face: 'right', axis: 0, sign: 1, right: 2, rightSign: -1, up: 1, upSign: 1 },
  { face: 'left', axis: 0, sign: -1, right: 2, rightSign: 1, up: 1, upSign: 1 },
  { face: 'top', axis: 1, sign: 1, right: 0, rightSign: 1, up: 2, upSign: -1 },
  { face: 'bottom', axis: 1, sign: -1, right: 0, rightSign: 1, up: 2, upSign: 1 },
];

/**
 * A box with cut edges, centred on the origin. The chamfer shares normals with
 * its two neighbouring faces, so it renders as a soft rolled edge that catches
 * rim light rather than as a third flat facet, which is most of what makes a
 * box stop looking like a box.
 */
export function chamferedBox(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
  faces: BoxFaces,
): THREE.BufferGeometry {
  const half: Triple = [width / 2, height / 2, depth / 2];
  const flat: Triple = [half[0] - chamfer, half[1] - chamfer, half[2] - chamfer];
  const soup = new TriangleSoup();

  for (const layout of FACE_LAYOUT) {
    const rect = faces[layout.face];
    const corner = (s: number, t: number): SoupVertex => {
      const position: Triple = [0, 0, 0];
      position[layout.axis] = layout.sign * half[layout.axis];
      position[layout.right] = s * layout.rightSign * flat[layout.right];
      position[layout.up] = t * layout.upSign * flat[layout.up];
      const normal: Triple = [0, 0, 0];
      normal[layout.axis] = layout.sign;
      return {
        position,
        normal,
        uv: [
          THREE.MathUtils.lerp(rect.u0, rect.u1, (s + 1) / 2),
          THREE.MathUtils.lerp(rect.v0, rect.v1, (t + 1) / 2),
        ],
      };
    };
    soup.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
  }

  const edgeUv: [number, number] = [
    (faces.edge.u0 + faces.edge.u1) / 2,
    (faces.edge.v0 + faces.edge.v1) / 2,
  ];

  const edges: [Axis, Axis, Axis][] = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ];
  for (const [along, b, c] of edges) {
    for (const signB of [-1, 1]) {
      for (const signC of [-1, 1]) {
        const vertex = (signAlong: number, onB: boolean): SoupVertex => {
          const position: Triple = [0, 0, 0];
          position[along] = signAlong * flat[along];
          position[b] = signB * (onB ? half[b] : flat[b]);
          position[c] = signC * (onB ? flat[c] : half[c]);
          const normal: Triple = [0, 0, 0];
          normal[onB ? b : c] = onB ? signB : signC;
          return { position, normal, uv: edgeUv };
        };
        soup.quad(vertex(-1, true), vertex(1, true), vertex(1, false), vertex(-1, false));
      }
    }
  }

  for (const signX of [-1, 1]) {
    for (const signY of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        const signs: Triple = [signX, signY, signZ];
        const vertex = (axis: Axis): SoupVertex => {
          const position: Triple = [signX * flat[0], signY * flat[1], signZ * flat[2]];
          position[axis] = signs[axis] * half[axis];
          const normal: Triple = [0, 0, 0];
          normal[axis] = signs[axis];
          return { position, normal, uv: edgeUv };
        };
        soup.triangle(vertex(0), vertex(1), vertex(2));
      }
    }
  }

  return soup.build();
}

/** `[radius, height]` pairs, bottom to top, travelling with the outside on the right. */
export type Profile = readonly (readonly [number, number])[];

export interface RevolveOptions {
  segments: number;
  /**
   * Profile spans this short or shorter are bevels: they take their neighbours'
   * normals, so a chamfer rolls smoothly instead of showing as a facet.
   */
  bevel?: number;
  /** Texture repeats around the axis. */
  uRepeat?: number;
  uOffset?: number;
  /** Texture rows at the two ends of the profile. */
  vRange?: readonly [number, number];
  /** Measure `v` by height, for walls, rather than by distance along the profile. */
  vByHeight?: boolean;
}

/**
 * Sweep a profile around the Y axis. Unlike `LatheGeometry`, every span owns its
 * vertices, so sharp corners between spans stay sharp.
 */
export function revolve(profile: Profile, options: RevolveOptions): THREE.BufferGeometry {
  const { segments, bevel = 0, uRepeat = 1, uOffset = 0, vRange = [0, 1], vByHeight = false } =
    options;
  const spans = profile.length - 1;
  const spanNormals: [number, number][] = [];
  const spanLengths: number[] = [];
  let travelled = 0;

  for (let span = 0; span < spans; span += 1) {
    const [r0, y0] = profile[span] as readonly [number, number];
    const [r1, y1] = profile[span + 1] as readonly [number, number];
    const length = Math.hypot(r1 - r0, y1 - y0) || 1e-6;
    spanLengths.push(length);
    spanNormals.push([(y1 - y0) / length, -(r1 - r0) / length]);
    travelled += length;
  }

  const firstY = (profile[0] as readonly [number, number])[1];
  const lastY = (profile[spans] as readonly [number, number])[1];
  const rowAt = (y: number, along: number): number => {
    const fraction = vByHeight ? (y - firstY) / (lastY - firstY || 1) : along / travelled;
    return THREE.MathUtils.lerp(vRange[0], vRange[1], fraction);
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let along = 0;

  for (let span = 0; span < spans; span += 1) {
    const [r0, y0] = profile[span] as readonly [number, number];
    const [r1, y1] = profile[span + 1] as readonly [number, number];
    const length = spanLengths[span] as number;
    const own = spanNormals[span] as [number, number];
    const isBevel = length <= bevel;
    const startNormal = isBevel ? (spanNormals[span - 1] ?? own) : own;
    const endNormal = isBevel ? (spanNormals[span + 1] ?? own) : own;
    const base = positions.length / 3;

    for (let step = 0; step <= segments; step += 1) {
      const fraction = step / segments;
      const angle = fraction * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const u = uOffset + fraction * uRepeat;
      positions.push(r0 * sin, y0, r0 * cos, r1 * sin, y1, r1 * cos);
      normals.push(startNormal[0] * sin, startNormal[1], startNormal[0] * cos);
      normals.push(endNormal[0] * sin, endNormal[1], endNormal[0] * cos);
      uvs.push(u, rowAt(y0, along), u, rowAt(y1, along + length));
    }

    for (let step = 0; step < segments; step += 1) {
      const a = base + step * 2;
      indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
    along += length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** Squeeze a geometry's whole `0–1` uv range into one rectangle of an atlas. */
export function fitUv(geometry: THREE.BufferGeometry, rect: UvRect): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      THREE.MathUtils.lerp(rect.u0, rect.u1, uv.getX(index)),
      THREE.MathUtils.lerp(rect.v0, rect.v1, uv.getY(index)),
    );
  }
  return geometry;
}

/** A round tube through `points`, as cable or conduit. */
export function pipe(
  points: readonly Triple[],
  radius: number,
  uv: UvRect,
  radialSegments = 8,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.4,
  );
  const tubular = Math.max(8, Math.ceil(curve.getLength() * 2.5));
  return fitUv(new THREE.TubeGeometry(curve, tubular, radius, radialSegments, false), uv);
}

const placement = new THREE.Matrix4();
const placementRotation = new THREE.Euler();

/** Move a geometry into place, about Y only unless `tilt` is given. Returns it for chaining. */
export function placed(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  tilt = 0,
): THREE.BufferGeometry {
  placementRotation.set(tilt, yaw, 0, 'YXZ');
  placement.makeRotationFromEuler(placementRotation).setPosition(x, y, z);
  return geometry.applyMatrix4(placement);
}

const scratchPosition = new THREE.Vector3();
const scratchColor = new THREE.Color();

/**
 * Bake per-vertex colour. Used two ways: as a multiplier on lit surfaces, for
 * contact shadow and tint without another material, and as HDR on unlit ones.
 */
export function vertexColor(
  geometry: THREE.BufferGeometry,
  paint: THREE.Color | ((position: THREE.Vector3, out: THREE.Color) => void),
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    if (typeof paint === 'function') {
      scratchPosition.fromBufferAttribute(position, index);
      paint(scratchPosition, scratchColor);
    } else {
      scratchColor.copy(paint);
    }
    colors[index * 3] = scratchColor.r;
    colors[index * 3 + 1] = scratchColor.g;
    colors[index * 3 + 2] = scratchColor.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Merge finished parts into one draw call. The parts are consumed. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const indexed = parts.map((part) => {
    if (part.index) return part;
    const count = (part.getAttribute('position') as THREE.BufferAttribute).count;
    part.setIndex(Array.from({ length: count }, (_, index) => index));
    return part;
  });
  const merged = mergeGeometries(indexed, false);
  if (!merged) throw new Error('Hardware parts have mismatched attributes');
  for (const part of parts) part.dispose();
  return merged;
}

/** A centred rounded rectangle, for extruding or filling. */
export function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const left = -width / 2;
  const bottom = -height / 2;
  const right = width / 2;
  const top = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
}

/** One additive pool of light lying on a surface. */
export interface FloorGlow {
  x: number;
  z: number;
  radius: number;
  color: THREE.ColorRepresentation;
  strength: number;
  y?: number;
}

/** Pools of light as merged quads, so a whole island's worth is one draw call. */
export function floorGlowGeometry(glows: readonly FloorGlow[]): THREE.BufferGeometry {
  const parts = glows.map((glow) => {
    const quad = new THREE.PlaneGeometry(glow.radius * 2, glow.radius * 2);
    quad.rotateX(-Math.PI / 2);
    quad.translate(glow.x, glow.y ?? 0.06, glow.z);
    return vertexColor(
      quad,
      scratchColor.set(glow.color).multiplyScalar(glow.strength).clone(),
    );
  });
  return mergeParts(parts);
}

/* ──────────────────────────────── Textures ──────────────────────────────── */

export function paintCanvas(
  width: number,
  height: number,
  paint?: (context: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  paint?.(context);
  return canvas;
}

export function canvasTexture(
  canvas: HTMLCanvasElement,
  role: 'color' | 'data',
  wrap = false,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  if (wrap) texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** A pixel for the packed surface map: R bump height, G roughness, B metalness. */
export function surfaceStyle(height: number, roughness: number, metalness: number): string {
  const byte = (value: number) => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
  return `rgb(${byte(height)},${byte(roughness)},${byte(metalness)})`;
}

/* ───────────────────────────── The rack atlas ───────────────────────────── */

const ATLAS_SIZE = 2048;

/** Painted steel: dielectric enough to catch diffuse light, so its detail shows in shade. */
const FACEPLATE = '#2b3346';
const FACEPLATE_LIT = '#465270';

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

const regionUv = ({ x, y, w, h }: Region): UvRect => {
  const inset = 3;
  return {
    u0: (x + inset) / ATLAS_SIZE,
    v0: 1 - (y + h - inset) / ATLAS_SIZE,
    u1: (x + w - inset) / ATLAS_SIZE,
    v1: 1 - (y + inset) / ATLAS_SIZE,
  };
};

const REGIONS = {
  blades: { x: 0, y: 0, w: 512, h: 1228 },
  bays: { x: 512, y: 0, w: 512, h: 1228 },
  display: { x: 1024, y: 0, w: 512, h: 1228 },
  service: { x: 1536, y: 0, w: 512, h: 1228 },
  lidLit: { x: 0, y: 1228, w: 410, h: 410 },
  lidVent: { x: 410, y: 1228, w: 410, h: 410 },
  unitLights: { x: 820, y: 1228, w: 614, h: 410 },
  unitGrille: { x: 1434, y: 1228, w: 614, h: 410 },
  plate: { x: 0, y: 1638, w: 1024, h: 205 },
  plain: { x: 0, y: 1843, w: 1024, h: 205 },
  unitWarm: { x: 1024, y: 1638, w: 614, h: 410 },
  grate: { x: 1638, y: 1638, w: 410, h: 205 },
  worn: { x: 1638, y: 1843, w: 205, h: 205 },
  rubber: { x: 1843, y: 1843, w: 205, h: 205 },
} as const satisfies Record<string, Region>;

export type RackRegion = keyof typeof REGIONS;

/** Where a region of the rack atlas sits, for mapping box faces onto it. */
export function rackUv(region: RackRegion): UvRect {
  return regionUv(REGIONS[region]);
}

/** Box faces from named regions; anything not given falls back to bare plate. */
export function rackFaces(faces: Partial<Record<keyof BoxFaces, RackRegion>>): BoxFaces {
  const uv = (key: keyof BoxFaces, fallback: RackRegion) => rackUv(faces[key] ?? fallback);
  return {
    front: uv('front', 'plate'),
    back: uv('back', 'plate'),
    left: uv('left', 'plate'),
    right: uv('right', 'plate'),
    top: uv('top', 'plain'),
    bottom: uv('bottom', 'plain'),
    edge: uv('edge', 'worn'),
  };
}

interface Layers {
  albedo: CanvasRenderingContext2D;
  emissive: CanvasRenderingContext2D;
  /** See `surfaceStyle`. */
  surface: CanvasRenderingContext2D;
  /** Gray per light: when in its slow cycle that light brightens. */
  phase: CanvasRenderingContext2D;
}

function layerCanvas(size: number): CanvasRenderingContext2D {
  const context = paintCanvas(size, size).getContext('2d') as CanvasRenderingContext2D;
  context.scale(size / ATLAS_SIZE, size / ATLAS_SIZE);
  return context;
}

function block(
  layers: Layers,
  x: number,
  y: number,
  width: number,
  height: number,
  albedo: string,
  bump: number,
  roughness = 0.45,
  metalness = 0.92,
) {
  layers.albedo.fillStyle = albedo;
  layers.albedo.fillRect(x, y, width, height);
  layers.surface.fillStyle = surfaceStyle(bump, roughness, metalness);
  layers.surface.fillRect(x, y, width, height);
}

function light(
  layers: Layers,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  phase: number,
  bleed = 12,
) {
  const { emissive, albedo } = layers;
  const cell = 12;
  const cells = width > cell * 3 ? Math.floor(width / cell) : 1;
  const cellWidth = cells > 1 ? cell - 3 : width;

  /* Long lights are level meters up close and dashes from far away: their tail is dimmer. */
  emissive.save();
  emissive.shadowColor = color;
  emissive.shadowBlur = bleed;
  emissive.fillStyle = color;
  for (let index = 0; index < cells; index += 1) {
    emissive.globalAlpha = index > cells * 0.72 ? 0.55 : 1;
    emissive.fillRect(x + index * cell, y, cellWidth, height);
  }
  emissive.restore();

  albedo.fillStyle = '#3b4a66';
  albedo.fillRect(x, y, width, height);

  const shade = Math.round(phase * 255);
  layers.phase.fillStyle = `rgb(${shade},${shade},${shade})`;
  layers.phase.fillRect(x - 4, y - 4, width + 8, height + 8);
}

function casing(layers: Layers, region: Region, rng: () => number) {
  const { x, y, w, h } = region;
  const gradient = layers.albedo.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, '#2a3347');
  gradient.addColorStop(0.5, '#1d2434');
  gradient.addColorStop(1, '#151b28');
  layers.albedo.fillStyle = gradient;
  layers.albedo.fillRect(x, y, w, h);
  layers.surface.fillStyle = surfaceStyle(0.55, 0.44, 0.55);
  layers.surface.fillRect(x, y, w, h);

  layers.albedo.save();
  layers.albedo.beginPath();
  layers.albedo.rect(x, y, w, h);
  layers.albedo.clip();
  for (let streak = 0; streak < 90; streak += 1) {
    layers.albedo.fillStyle = `rgba(${rng() > 0.5 ? '150,170,210' : '0,0,0'},${rngBetween(rng, 0.015, 0.06)})`;
    layers.albedo.fillRect(x + rng() * w, y + rng() * h, 1 + rng() * 2, 30 + rng() * 240);
  }
  layers.albedo.restore();
}

function bolt(layers: Layers, x: number, y: number, radius: number) {
  layers.albedo.fillStyle = '#4c5870';
  layers.albedo.beginPath();
  layers.albedo.arc(x, y, radius, 0, Math.PI * 2);
  layers.albedo.fill();
  layers.albedo.fillStyle = '#10141e';
  layers.albedo.fillRect(x - radius * 0.6, y - 1, radius * 1.2, 2);
  layers.surface.fillStyle = surfaceStyle(0.95, 0.3, 1);
  layers.surface.beginPath();
  layers.surface.arc(x, y, radius, 0, Math.PI * 2);
  layers.surface.fill();
}

function frameLip(layers: Layers, region: Region, margin: number) {
  const { x, y, w, h } = region;
  block(layers, x, y, w, margin, '#3b465e', 0.85, 0.36, 0.6);
  block(layers, x, y + h - margin, w, margin, '#343e54', 0.85, 0.38, 0.6);
  block(layers, x, y, margin, h, '#3b465e', 0.85, 0.36, 0.6);
  block(layers, x + w - margin, y, margin, h, '#343e54', 0.85, 0.38, 0.6);
  block(layers, x + margin, y + margin, w - margin * 2, 3, '#05070c', 0.2);
  block(layers, x + margin, y + h - margin - 3, w - margin * 2, 3, '#05070c', 0.2);
  block(layers, x + margin, y + margin, 3, h - margin * 2, '#05070c', 0.2);
  block(layers, x + w - margin - 3, y + margin, 3, h - margin * 2, '#05070c', 0.2);
}

/** Rows of blade servers: the long horizontal dashes that dominate the reference. */
function paintBlades(layers: Layers, region: Region, rng: () => number, tones: readonly string[]) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 30;
  frameLip(layers, region, margin);

  const rows = 15;
  const inner = w - margin * 2 - 16;
  const rowHeight = (h - margin * 2 - 16) / rows;

  for (let row = 0; row < rows; row += 1) {
    const top = y + margin + 8 + row * rowHeight;
    const left = x + margin + 8;
    const phase = rng();
    block(layers, left, top + 3, inner, rowHeight - 6, FACEPLATE, 0.62, 0.5, 0.4);
    block(layers, left, top + 3, inner, 3, FACEPLATE_LIT, 0.66, 0.46, 0.5);
    block(layers, left, top + rowHeight - 6, inner, 3, '#0a0d14', 0.5, 0.6, 0.4);

    const slotTop = top + rowHeight * 0.3;
    const slotHeight = rowHeight * 0.4;
    block(layers, left + 12, slotTop, inner - 24, slotHeight, '#05070c', 0.25, 0.65, 0.3);

    const tone = tones[Math.floor(rng() * tones.length)] as string;
    const dash = inner * rngBetween(rng, 0.24, 0.5);
    light(layers, left + 18, slotTop + slotHeight / 2 - 5, dash, 10, tone, phase);

    const portsLeft = left + 26 + dash;
    const ports = Math.floor((inner - dash - 130) / 22);
    for (let port = 0; port < ports; port += 1) {
      block(layers, portsLeft + port * 22, slotTop + 7, 13, slotHeight - 14, '#1d2433', 0.45, 0.5, 0.5);
    }

    const pips = 1 + Math.floor(rng() * 3);
    for (let pip = 0; pip < pips; pip += 1) {
      const pipTone = rng() > 0.86 ? COLORS.amber : (tones[0] as string);
      light(
        layers,
        left + inner - 34 - pip * 26,
        slotTop + slotHeight / 2 - 5,
        14,
        10,
        pipTone,
        (phase + 0.3 + pip * 0.2) % 1,
        8,
      );
    }
    bolt(layers, left + 7, top + rowHeight / 2, 3.5);
    bolt(layers, left + inner - 7, top + rowHeight / 2, 3.5);
  }
}

/** Banks of small drive caddies, each with its own activity light. */
function paintBays(layers: Layers, region: Region, rng: () => number, tones: readonly string[]) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 30;
  frameLip(layers, region, margin);

  const rows = 13;
  const gap = 8;
  const inner = w - margin * 2 - 20;
  const cellHeight = (h - margin * 2 - 20) / rows;
  const split = inner * 0.66;

  for (let row = 0; row < rows; row += 1) {
    const rowPhase = rng();
    const top = y + margin + 10 + row * cellHeight + gap / 2;
    const height = cellHeight - gap;

    for (const [offset, width, fill] of [
      [0, split - gap, rngBetween(rng, 0.42, 0.9)],
      [split, inner - split, rngBetween(rng, 0.3, 0.74)],
    ] as const) {
      const left = x + margin + 10 + offset;
      block(layers, left, top, width, height, FACEPLATE, 0.62, 0.5, 0.4);
      block(layers, left, top, width, 3, FACEPLATE_LIT, 0.66, 0.46, 0.5);
      block(layers, left + 8, top + height * 0.5, width - 16, height * 0.26, '#05070b', 0.3, 0.6, 0.3);

      const vents = Math.floor((width - 24) / 13);
      for (let vent = 0; vent < vents; vent += 1) {
        block(layers, left + 12 + vent * 13, top + height * 0.13, 7, height * 0.22, '#0b0e16', 0.35, 0.6);
      }

      if (rng() > 0.1) {
        light(
          layers,
          left + 12,
          top + height * 0.63 - 5,
          (width - 24) * fill,
          10,
          tones[Math.floor(rng() * tones.length)] as string,
          (rowPhase + offset * 0.003) % 1,
        );
      }
    }
  }
}

/** A status display over vented blanks. */
function paintDisplay(layers: Layers, region: Region, rng: () => number, tones: readonly string[]) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 30;
  frameLip(layers, region, margin);

  const screenLeft = x + margin + 24;
  const screenTop = y + margin + 26;
  const screenWidth = w - (margin + 24) * 2;
  const screenHeight = 170;
  block(layers, screenLeft - 8, screenTop - 8, screenWidth + 16, screenHeight + 16, '#0a0e16', 0.3, 0.5);

  const { emissive } = layers;
  emissive.fillStyle = 'rgba(46,92,210,0.42)';
  emissive.fillRect(screenLeft, screenTop, screenWidth, screenHeight);
  emissive.strokeStyle = tones[0] as string;
  emissive.lineWidth = 3;
  emissive.beginPath();
  let cursor = screenTop + screenHeight * 0.66;
  emissive.moveTo(screenLeft, cursor);
  for (let step = 1; step <= 24; step += 1) {
    cursor = THREE.MathUtils.clamp(
      cursor + rngBetween(rng, -30, 28),
      screenTop + 84,
      screenTop + screenHeight - 12,
    );
    emissive.lineTo(screenLeft + (screenWidth * step) / 24, cursor);
  }
  emissive.stroke();
  for (let row = 0; row < 4; row += 1) {
    light(
      layers,
      screenLeft + 14,
      screenTop + 14 + row * 15,
      screenWidth * rngBetween(rng, 0.22, 0.6),
      6,
      tones[row % tones.length] as string,
      rng(),
      6,
    );
  }

  const ventTop = screenTop + screenHeight + 40;
  for (let band = 0; band < 2; band += 1) {
    const top = ventTop + band * 92;
    for (let slit = 0; slit < 7; slit += 1) {
      block(layers, screenLeft, top + slit * 11, screenWidth, 6, '#04060a', 0.15, 0.7);
    }
  }

  const rowsTop = ventTop + 200;
  const rows = 13;
  const rowHeight = (y + h - margin - 26 - rowsTop) / rows;
  for (let row = 0; row < rows; row += 1) {
    const top = rowsTop + row * rowHeight;
    block(layers, screenLeft, top + 4, screenWidth, rowHeight - 8, FACEPLATE, 0.7, 0.45, 0.4);
    block(layers, screenLeft + 10, top + rowHeight * 0.34, screenWidth - 20, rowHeight * 0.32, '#04060a', 0.25, 0.6, 0.3);
    light(
      layers,
      screenLeft + 16,
      top + rowHeight * 0.5 - 4,
      screenWidth * rngBetween(rng, 0.2, 0.5),
      8,
      tones[Math.floor(rng() * tones.length)] as string,
      rng(),
    );
  }
}

/** A plainer side: access panels, latches and a strip of lights. */
function paintService(layers: Layers, region: Region, rng: () => number, tones: readonly string[]) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 26;
  frameLip(layers, region, margin);

  const panels = 4;
  const panelHeight = (h - margin * 2 - 30) / panels;
  for (let panel = 0; panel < panels; panel += 1) {
    const top = y + margin + 15 + panel * panelHeight;
    const left = x + margin + 15;
    const width = w - (margin + 15) * 2;
    const height = panelHeight - 14;
    block(layers, left, top, width, height, FACEPLATE, 0.68, 0.48, 0.4);
    block(layers, left, top, width, 3, FACEPLATE_LIT, 0.8, 0.34, 0.5);
    block(layers, left, top + height - 3, width, 3, '#07090f', 0.45, 0.6, 0.4);
    bolt(layers, left + 12, top + 12, 5);
    bolt(layers, left + width - 12, top + 12, 5);
    bolt(layers, left + 12, top + height - 12, 5);
    bolt(layers, left + width - 12, top + height - 12, 5);

    for (let slit = 0; slit < 9; slit += 1) {
      block(layers, left + 40, top + 40 + slit * 12, width * 0.46, 6, '#04060a', 0.2, 0.7);
    }
    block(layers, left + width - 92, top + 40, 52, 92, '#0a0e15', 0.32, 0.55);
    const phase = rng();
    for (let pip = 0; pip < 4; pip += 1) {
      light(
        layers,
        left + width - 80,
        top + 52 + pip * 20,
        28,
        9,
        tones[pip % tones.length] as string,
        (phase + pip * 0.21) % 1,
      );
    }
    light(
      layers,
      left + 40,
      top + height - 34,
      width * rngBetween(rng, 0.26, 0.6),
      9,
      tones[Math.floor(rng() * tones.length)] as string,
      phase,
    );
  }
}

/**
 * A rack's lid. The lit one is the reference's rectangle of blue light on each
 * rack's top; `vent` is the same casing without the light, for backs of things.
 */
function paintLid(layers: Layers, region: Region, rng: () => number, lit: boolean) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 18;
  frameLip(layers, region, margin);

  const slotLeft = x + w * 0.2;
  block(layers, slotLeft, y + h * 0.13, w * 0.6, h * 0.06, '#04060a', 0.15, 0.7);
  bolt(layers, x + 34, y + 34, 6);
  bolt(layers, x + w - 34, y + 34, 6);
  bolt(layers, x + 34, y + h - 34, 6);
  bolt(layers, x + w - 34, y + h - 34, 6);

  const panelLeft = x + w * 0.24;
  const panelTop = y + h * 0.3;
  const panelSize = w * 0.52;
  const { emissive } = layers;

  if (!lit) {
    for (let slit = 0; slit < 12; slit += 1) {
      block(layers, panelLeft, panelTop + slit * (panelSize / 12), panelSize, 8, '#04060a', 0.2, 0.7);
    }
    return;
  }

  /* A broad wash first: the whole lid reads as lit even when it is one pixel wide. */
  const wash = emissive.createRadialGradient(
    x + w / 2,
    y + h * 0.56,
    10,
    x + w / 2,
    y + h * 0.56,
    w * 0.66,
  );
  wash.addColorStop(0, 'rgba(92,134,255,0.4)');
  wash.addColorStop(0.5, 'rgba(84,92,236,0.22)');
  wash.addColorStop(1, 'rgba(84,72,214,0.14)');
  emissive.fillStyle = wash;
  emissive.fillRect(x, y, w, h);

  block(layers, panelLeft, panelTop, panelSize, panelSize, '#0a1120', 0.3, 0.3);
  const cells = 8;
  const cell = panelSize / cells;
  for (let column = 0; column < cells; column += 1) {
    for (let row = 0; row < cells; row += 1) {
      const fromCentre = Math.hypot(column - cells / 2 + 0.5, row - cells / 2 + 0.5) / (cells / 2);
      const alpha = Math.max(0.06, 1 - fromCentre * 0.8) * rngBetween(rng, 0.34, 0.6);
      emissive.fillStyle = `rgba(112,176,255,${alpha})`;
      emissive.fillRect(panelLeft + column * cell + 3, panelTop + row * cell + 3, cell - 6, cell - 6);
    }
  }
  layers.phase.fillStyle = 'rgb(128,128,128)';
  layers.phase.fillRect(panelLeft, panelTop, panelSize, panelSize);
}

/** A low unit's face: three lit readouts and a strip of pips. */
function paintUnitLights(
  layers: Layers,
  region: Region,
  rng: () => number,
  tones: readonly string[],
  plate = FACEPLATE,
) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 18;
  frameLip(layers, region, margin);
  const inner = w - margin * 2 - 36;

  for (let row = 0; row < 5; row += 1) {
    const top = y + margin + 16 + row * 56;
    block(layers, x + margin + 18, top, inner, 46, plate, 0.62, 0.5, 0.4);
    block(layers, x + margin + 30, top + 13, inner * 0.46, 20, '#04060a', 0.25, 0.6, 0.3);
    light(
      layers,
      x + margin + 34,
      top + 18,
      inner * rngBetween(rng, 0.1, 0.34),
      8,
      tones[row % tones.length] as string,
      rng(),
      7,
    );
    for (let pip = 0; pip < 7; pip += 1) {
      if (rng() > 0.3) {
        light(
          layers,
          x + w - margin - 36 - pip * 24,
          top + 18,
          10,
          8,
          (rng() > 0.8 ? COLORS.amber : tones[pip % tones.length]) as string,
          rng(),
          6,
        );
      }
    }
  }
  bolt(layers, x + 40, y + h - 44, 6);
  bolt(layers, x + w - 40, y + h - 44, 6);
  for (let slit = 0; slit < 22; slit += 1) {
    block(layers, x + 82 + slit * 21, y + h - 64, 11, 30, '#04060a', 0.15, 0.7);
  }
}

/** A low unit's face: a cooling grille with a warm status lamp. */
function paintUnitGrille(layers: Layers, region: Region, rng: () => number) {
  const { x, y, w, h } = region;
  casing(layers, region, rng);
  const margin = 18;
  frameLip(layers, region, margin);

  const left = x + margin + 22;
  const top = y + margin + 22;
  const width = w * 0.56;
  const height = h - (margin + 22) * 2;
  block(layers, left - 6, top - 6, width + 12, height + 12, '#0a0d14', 0.3, 0.6);
  for (let column = 0; column < 24; column += 1) {
    for (let row = 0; row < 14; row += 1) {
      const dotX = left + 6 + column * (width / 24) + (row % 2) * 6;
      const dotY = top + 8 + row * (height / 14);
      layers.albedo.fillStyle = '#2b3448';
      layers.albedo.beginPath();
      layers.albedo.arc(dotX, dotY, 3.4, 0, Math.PI * 2);
      layers.albedo.fill();
      layers.surface.fillStyle = surfaceStyle(0.1, 0.6, 0.8);
      layers.surface.fillRect(dotX - 3, dotY - 3, 6, 6);
    }
  }

  const side = left + width + 26;
  const sideWidth = x + w - margin - 22 - side;
  block(layers, side, top, sideWidth, 62, FACEPLATE, 0.68, 0.46, 0.4);
  light(layers, side + 14, top + 22, sideWidth * 0.56, 16, COLORS.orange, rng());
  light(layers, side + sideWidth - 42, top + 22, 18, 16, COLORS.amber, rng(), 8);
  block(layers, side, top + 82, sideWidth, height - 82, FACEPLATE, 0.66, 0.48, 0.4);
  bolt(layers, side + 18, top + 100, 5);
  bolt(layers, side + sideWidth - 18, top + 100, 5);
  bolt(layers, side + 18, top + height - 18, 5);
  bolt(layers, side + sideWidth - 18, top + height - 18, 5);
}

function paintPlate(layers: Layers, region: Region, rng: () => number) {
  casing(layers, region, rng);
  const { x, y, w, h } = region;
  const panels = 4;
  for (let panel = 0; panel < panels; panel += 1) {
    const left = x + (panel * w) / panels;
    block(layers, left + 4, y + 6, w / panels - 8, h - 12, FACEPLATE, 0.68, 0.48, 0.4);
    block(layers, left + 4, y + 6, w / panels - 8, 3, FACEPLATE_LIT, 0.8, 0.34, 0.5);
    bolt(layers, left + 18, y + 22, 5);
    bolt(layers, left + w / panels - 18, y + 22, 5);
    bolt(layers, left + 18, y + h - 22, 5);
    bolt(layers, left + w / panels - 18, y + h - 22, 5);
  }
}

function paintGrate(layers: Layers, region: Region) {
  const { x, y, w, h } = region;
  block(layers, x, y, w, h, '#10141e', 0.5, 0.5);
  const slits = 26;
  for (let slit = 0; slit < slits; slit += 1) {
    block(layers, x + 6 + slit * (w / slits), y + 8, w / slits - 7, h - 16, '#03050a', 0.1, 0.7);
  }
}

function paintPlain(layers: Layers, region: Region) {
  const { x, y, w, h } = region;
  const gradient = layers.albedo.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, '#2b3346');
  gradient.addColorStop(1, '#1e2534');
  layers.albedo.fillStyle = gradient;
  layers.albedo.fillRect(x, y, w, h);
  layers.surface.fillStyle = surfaceStyle(0.5, 0.46, 0.5);
  layers.surface.fillRect(x, y, w, h);
}

export interface RackAtlas {
  albedo: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
  surface: THREE.CanvasTexture;
  phase: THREE.CanvasTexture;
}

function bakeRackAtlas(): RackAtlas {
  const layers: Layers = {
    albedo: layerCanvas(1024),
    emissive: layerCanvas(2048),
    surface: layerCanvas(1024),
    phase: layerCanvas(512),
  };

  layers.emissive.fillStyle = '#000000';
  layers.emissive.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  layers.phase.fillStyle = 'rgb(128,128,128)';
  layers.phase.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  const blue = [COLORS.blue, COLORS.cyan, '#6fb6ff'] as const;
  const violet = [COLORS.violet, COLORS.magenta, '#a884ff', COLORS.blue] as const;
  const mixed = ['#4d7dff', COLORS.violet, COLORS.cyan] as const;

  const rng = createRng(0x51a7);
  paintBlades(layers, REGIONS.blades, rng, blue);
  paintBays(layers, REGIONS.bays, rng, violet);
  paintDisplay(layers, REGIONS.display, rng, mixed);
  paintService(layers, REGIONS.service, rng, violet);
  paintLid(layers, REGIONS.lidLit, rng, true);
  paintLid(layers, REGIONS.lidVent, rng, false);
  paintUnitLights(layers, REGIONS.unitLights, rng, blue);
  paintUnitGrille(layers, REGIONS.unitGrille, rng);
  paintUnitLights(layers, REGIONS.unitWarm, rng, [COLORS.orange, COLORS.amber, '#ff7a3c'], '#28221e');
  paintPlate(layers, REGIONS.plate, rng);
  paintGrate(layers, REGIONS.grate);
  paintPlain(layers, REGIONS.plain);
  block(layers, REGIONS.worn.x, REGIONS.worn.y, REGIONS.worn.w, REGIONS.worn.h, '#566280', 0.6, 0.44, 0.9);
  block(layers, REGIONS.rubber.x, REGIONS.rubber.y, REGIONS.rubber.w, REGIONS.rubber.h, '#0d1017', 0.5, 0.7, 0.1);

  return {
    albedo: canvasTexture(layers.albedo.canvas, 'color'),
    emissive: canvasTexture(layers.emissive.canvas, 'color'),
    surface: canvasTexture(layers.surface.canvas, 'data'),
    phase: canvasTexture(layers.phase.canvas, 'data'),
  };
}

/* ─────────────────────────────── Materials ──────────────────────────────── */

/**
 * Add to a standard material's emissive stage. `glsl` runs with `normal`,
 * `vViewPosition` and `totalEmissiveRadiance` in scope. Everything it needs is
 * uniforms and baked textures: nothing procedural runs per pixel.
 */
export function extendEmissive(
  material: THREE.MeshStandardMaterial,
  key: string,
  uniforms: Record<string, THREE.IUniform>,
  declarations: string,
  glsl: string,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${declarations}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${glsl}`);
  };
  material.customProgramCacheKey = () => key;
}

export interface HardwareKit {
  /** Merged rack bodies. Vertex colours multiply the albedo. */
  rack: THREE.MeshStandardMaterial;
  /** A four-pointed glint, for light caught on the corner of something. */
  glint: THREE.SpriteMaterial;
  /** Soft pools of light on decks. Vertex colours set colour and strength. */
  floorGlow: THREE.MeshBasicMaterial;
  /** Additive bands around glowing rings. `v` runs across the band. */
  halo: THREE.MeshBasicMaterial;
  /** Advances the racks' lights. Call once per frame with elapsed time. */
  animateLights(time: number): void;
}

let hardware: HardwareKit | null = null;

function createGlintTexture(): THREE.CanvasTexture {
  const size = 256;
  const centre = size / 2;
  const canvas = paintCanvas(size, size, (context) => {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'lighter';

    const core = context.createRadialGradient(centre, centre, 0, centre, centre, centre * 0.42);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.16, 'rgba(255,255,255,0.5)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = core;
    context.fillRect(0, 0, size, size);

    for (const [spanX, spanY] of [
      [centre, 1.6],
      [1.6, centre],
    ] as const) {
      const spike = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
      spike.addColorStop(0, 'rgba(255,255,255,1)');
      spike.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      spike.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = spike;
      context.fillRect(centre - spanX, centre - spanY, spanX * 2, spanY * 2);
    }
  });
  return canvasTexture(canvas, 'color');
}

function createHaloTexture(): THREE.CanvasTexture {
  const canvas = paintCanvas(4, 128, (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(0.46, 'rgba(255,255,255,0.62)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.54, 'rgba(255,255,255,0.62)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 128);
  });
  return canvasTexture(canvas, 'color');
}

export function getHardware(): HardwareKit {
  if (hardware) return hardware;

  const atlas = bakeRackAtlas();
  const lightClock: THREE.IUniform<number> = { value: 0 };

  const rack = new THREE.MeshStandardMaterial({
    map: atlas.albedo,
    emissiveMap: atlas.emissive,
    emissive: '#ffffff',
    emissiveIntensity: 3.4,
    roughnessMap: atlas.surface,
    metalnessMap: atlas.surface,
    bumpMap: atlas.surface,
    bumpScale: 0.5,
    metalness: 1,
    roughness: 1,
    vertexColors: true,
  });
  extendEmissive(
    rack,
    'hardware-rack-lights',
    { uLightClock: lightClock, uLightPhase: { value: atlas.phase } },
    'uniform float uLightClock;\nuniform sampler2D uLightPhase;',
    /* Two fixed rates: scaling a rate by the phase would shear into noise over time. */
    `float lightPhase = texture2D(uLightPhase, vEmissiveMapUv).r * 6.2832;
     totalEmissiveRadiance *= 0.74 + 0.16 * sin(uLightClock * 1.1 + lightPhase)
       + 0.1 * sin(uLightClock * 3.7 + lightPhase * 5.0);`,
  );

  hardware = {
    rack,
    glint: new THREE.SpriteMaterial({
      map: createGlintTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    floorGlow: new THREE.MeshBasicMaterial({
      map: getKit().glowTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    halo: new THREE.MeshBasicMaterial({
      map: createHaloTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.FrontSide,
    }),
    animateLights(time) {
      lightClock.value = time;
    },
  };
  return hardware;
}
