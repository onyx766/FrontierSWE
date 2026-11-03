import { createRng } from '@/lib/rng';
import { TAU } from './geometry';
import {
  AVENUE_HALF_WIDTH,
  LANE_RADII,
  PLAZA_RADIUS,
  RIM_SEGMENTS,
  ROAD_INNER,
  ROAD_OUTER,
  type Building,
  type IslandModel,
  type TreeKind,
} from './model';
import { FACADES, FLOWER_COLORS, GROUND, TREE_COLORS, TRUNK, type FacadeLook } from './palette';

/**
 * Everything static is painted once, here, into offscreen canvases: the island
 * top, every building facade (one atlas), tree and cloud sprites, glows and the
 * "R". The renderer then only maps these onto the moving geometry with affine
 * transforms, which is what keeps a frame to a few hundred cheap draw calls.
 */

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ───────────────────────────── Island top ───────────────────────────── */

/** World units from the island centre to the ground texture's edge. */
export const GROUND_EXTENT = 1.03;

function rimPath(model: IslandModel): Path2D {
  const path = new Path2D();
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    const a = (i / RIM_SEGMENTS) * TAU;
    const r = model.rim[i] as number;
    if (i === 0) path.moveTo(r * Math.cos(a), r * Math.sin(a));
    else path.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  path.closePath();
  return path;
}

function annulus(g: CanvasRenderingContext2D, r0: number, r1: number) {
  g.beginPath();
  g.arc(0, 0, r1, 0, TAU);
  g.arc(0, 0, r0, 0, TAU, true);
}

function ring(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
}

/** A smooth stroke through a flat [x, z, ...] polyline (midpoint quadratics). */
function smoothLine(g: CanvasRenderingContext2D, points: readonly number[]) {
  g.beginPath();
  g.moveTo(points[0] as number, points[1] as number);
  for (let i = 2; i + 3 < points.length; i += 2) {
    const x = points[i] as number;
    const z = points[i + 1] as number;
    const nx = points[i + 2] as number;
    const nz = points[i + 3] as number;
    g.quadraticCurveTo(x, z, (x + nx) / 2, (z + nz) / 2);
  }
  g.lineTo(points[points.length - 2] as number, points[points.length - 1] as number);
}

/**
 * Soft contact shadows: the shape is drawn far off-canvas and only its blurred
 * shadow lands in place. `shadowBlur` is portable where `ctx.filter` is not.
 */
function softShadow(
  g: CanvasRenderingContext2D,
  scale: number,
  blurWorld: number,
  color: string,
  draw: (offset: number) => void,
) {
  const offset = 4;
  g.save();
  g.shadowColor = color;
  g.shadowBlur = Math.max(1, blurWorld * scale);
  g.shadowOffsetX = -offset * scale;
  g.fillStyle = '#000';
  draw(offset);
  g.restore();
}

function footprintPath(g: CanvasRenderingContext2D, b: Building, grow: number, dx = 0) {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const hw = b.hw + grow;
  const hd = b.hd + grow;
  g.beginPath();
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ] as const;
  corners.forEach(([lx, lz], i) => {
    const x = b.x + dx + lx * c - lz * s;
    const z = b.z + lx * s + lz * c;
    if (i === 0) g.moveTo(x, z);
    else g.lineTo(x, z);
  });
  g.closePath();
}

/**
 * The island top, seen straight down: lawn, ring road, avenues, plaza, paths,
 * streams and contact shadows. Directional lighting is left out on purpose:
 * the light is fixed to the camera while this texture turns with the island.
 */
export function paintGround(model: IslandModel, size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const g = context(canvas);
  const scale = size / (2 * GROUND_EXTENT);
  g.setTransform(scale, 0, 0, scale, size / 2, size / 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rng = createRng((model.seed * 7919 + 17) >>> 0);
  const outline = rimPath(model);
  const everyBuilding = [model.tower, ...model.buildings];

  g.save();
  g.clip(outline);

  // Lawn: brighter in the middle, deeper toward the rim, mottled.
  const lawn = g.createRadialGradient(-0.12, -0.18, 0, 0, 0, 1.02);
  lawn.addColorStop(0, GROUND.grassCenter);
  lawn.addColorStop(0.55, GROUND.grassMid);
  lawn.addColorStop(1, GROUND.grassEdge);
  g.fillStyle = lawn;
  g.fillRect(-1.1, -1.1, 2.2, 2.2);
  for (let i = 0; i < 1100; i += 1) {
    const a = rng() * TAU;
    const r = Math.sqrt(rng()) * 1.02;
    const radius = 0.006 + rng() * 0.032;
    const roll = rng();
    g.globalAlpha = roll < 0.45 ? 0.2 : roll < 0.8 ? 0.13 : 0.16;
    g.fillStyle = roll < 0.45 ? GROUND.grassLight : roll < 0.8 ? GROUND.grassDark : '#d3ea8f';
    g.beginPath();
    g.arc(r * Math.cos(a), r * Math.sin(a), radius, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;

  // Rim: a deeper band, then the sunlit grass lip.
  g.globalAlpha = 0.32;
  g.strokeStyle = GROUND.grassDark;
  g.lineWidth = 0.075;
  g.stroke(outline);
  g.globalAlpha = 0.85;
  g.strokeStyle = GROUND.lip;
  g.lineWidth = 0.016;
  g.stroke(outline);
  g.globalAlpha = 1;

  // Walkway rings between the inner rows of blocks.
  g.strokeStyle = GROUND.paving;
  g.lineWidth = 0.011;
  for (const r of [0.252, 0.333]) {
    ring(g, r);
    g.stroke();
  }

  // Sidewalks either side of the ring road.
  g.fillStyle = GROUND.paving;
  annulus(g, ROAD_OUTER, ROAD_OUTER + 0.026);
  g.fill();
  annulus(g, ROAD_INNER - 0.03, ROAD_INNER);
  g.fill();
  g.strokeStyle = GROUND.pavingEdge;
  g.lineWidth = 0.003;
  ring(g, ROAD_OUTER + 0.026);
  g.stroke();
  ring(g, ROAD_INNER - 0.03);
  g.stroke();

  // Avenues from the plaza to the ring road.
  for (const beta of model.avenues) {
    g.save();
    g.rotate(beta);
    const x0 = PLAZA_RADIUS - 0.012;
    const len = ROAD_INNER - x0 + 0.004;
    g.fillStyle = GROUND.paving;
    g.fillRect(x0, -AVENUE_HALF_WIDTH - 0.009, len, (AVENUE_HALF_WIDTH + 0.009) * 2);
    g.fillStyle = GROUND.road;
    g.fillRect(x0, -AVENUE_HALF_WIDTH, len, AVENUE_HALF_WIDTH * 2);
    g.strokeStyle = GROUND.lane;
    g.globalAlpha = 0.85;
    g.lineWidth = 0.0026;
    g.setLineDash([0.016, 0.014]);
    g.beginPath();
    g.moveTo(x0 + 0.02, 0);
    g.lineTo(ROAD_INNER - 0.004, 0);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.restore();
  }

  // The ring road: four lanes, a double median, dashed lane lines.
  g.fillStyle = GROUND.road;
  annulus(g, ROAD_INNER, ROAD_OUTER);
  g.fill();
  g.strokeStyle = GROUND.roadDark;
  g.globalAlpha = 0.35;
  g.lineWidth = 0.007;
  for (const r of LANE_RADII) {
    ring(g, r - 0.005);
    g.stroke();
    ring(g, r + 0.005);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = GROUND.median;
  g.lineWidth = 0.0028;
  for (const r of [0.4775, 0.4825]) {
    ring(g, r);
    g.stroke();
  }
  g.strokeStyle = GROUND.lane;
  g.lineWidth = 0.0032;
  g.setLineDash([0.022, 0.017]);
  for (const r of [0.4505, 0.5095]) {
    ring(g, r);
    g.stroke();
  }
  g.setLineDash([]);
  g.lineWidth = 0.0026;
  for (const r of [ROAD_INNER + 0.006, ROAD_OUTER - 0.006]) {
    ring(g, r);
    g.stroke();
  }

  // Glowing blue edge lights along both kerbs.
  for (const r of [ROAD_INNER, ROAD_OUTER]) {
    g.strokeStyle = rgba(GROUND.edgeGlow, 0.2);
    g.lineWidth = 0.024;
    ring(g, r);
    g.stroke();
    g.strokeStyle = rgba(GROUND.edgeGlow, 0.45);
    g.lineWidth = 0.009;
    ring(g, r);
    g.stroke();
    g.strokeStyle = GROUND.edgeLight;
    g.lineWidth = 0.003;
    ring(g, r);
    g.stroke();
    const count = Math.round((TAU * r) / 0.026);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * TAU;
      g.beginPath();
      g.arc(r * Math.cos(a), r * Math.sin(a), 0.0042, 0, TAU);
      g.fill();
    }
  }

  // Plaza: pale stone, concentric rings, radial seams, a violet light ring.
  g.fillStyle = GROUND.plaza;
  ring(g, PLAZA_RADIUS);
  g.fill();
  g.strokeStyle = GROUND.plazaLine;
  g.lineWidth = 0.003;
  for (const r of [0.098, 0.124]) {
    ring(g, r);
    g.stroke();
  }
  g.lineWidth = 0.002;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * TAU;
    g.beginPath();
    g.moveTo(0.124 * Math.cos(a), 0.124 * Math.sin(a));
    g.lineTo(PLAZA_RADIUS * Math.cos(a), PLAZA_RADIUS * Math.sin(a));
    g.stroke();
  }
  g.strokeStyle = GROUND.pavingEdge;
  g.lineWidth = 0.004;
  ring(g, PLAZA_RADIUS);
  g.stroke();
  g.strokeStyle = rgba(GROUND.plazaGlow, 0.22);
  g.lineWidth = 0.02;
  ring(g, 0.111);
  g.stroke();
  g.strokeStyle = rgba(GROUND.plazaGlow, 0.75);
  g.lineWidth = 0.004;
  ring(g, 0.111);
  g.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU + model.tower.rot + Math.PI / 8;
    g.fillStyle = '#7fc46a';
    g.beginPath();
    g.arc(0.137 * Math.cos(a), 0.137 * Math.sin(a), 0.0075, 0, TAU);
    g.fill();
  }

  // Footpaths out to viewpoints at the rim.
  for (const path of model.paths) {
    g.strokeStyle = GROUND.pathEdge;
    g.lineWidth = path.width + 0.006;
    smoothLine(g, path.points);
    g.stroke();
    g.strokeStyle = GROUND.path;
    g.lineWidth = path.width;
    smoothLine(g, path.points);
    g.stroke();
  }
  for (const spot of model.viewpoints) {
    g.fillStyle = GROUND.pathEdge;
    g.beginPath();
    g.arc(spot.x, spot.z, spot.r + 0.004, 0, TAU);
    g.fill();
    g.fillStyle = GROUND.path;
    g.beginPath();
    g.arc(spot.x, spot.z, spot.r, 0, TAU);
    g.fill();
    g.fillStyle = '#a58c7a';
    g.beginPath();
    g.arc(spot.x, spot.z, 0.007, 0, TAU);
    g.fill();
  }

  // Streams and the ponds that feed them.
  for (const pond of model.ponds) {
    g.save();
    g.translate(pond.x, pond.z);
    g.rotate(pond.rot);
    const layers: [string, number][] = [
      ['#6c9a62', 0.012],
      [GROUND.waterDeep, 0],
      [GROUND.water, -0.008],
    ];
    for (const [color, grow] of layers) {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(0, 0, pond.rx + grow, pond.rz + grow, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = rgba(GROUND.waterLight, 0.85);
    g.beginPath();
    g.ellipse(-pond.rx * 0.25, -pond.rz * 0.3, pond.rx * 0.45, pond.rz * 0.22, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  for (const stream of model.streams) {
    const layers: [string, number][] = [
      ['#6c9a62', stream.width + 0.012],
      [GROUND.waterDeep, stream.width],
      [GROUND.water, stream.width * 0.66],
      [rgba(GROUND.waterLight, 0.9), stream.width * 0.2],
    ];
    for (const [color, width] of layers) {
      g.strokeStyle = color;
      g.lineWidth = width;
      smoothLine(g, stream.points);
      g.stroke();
    }
  }

  // Flower beds.
  for (const flower of model.flowers) {
    g.fillStyle = FLOWER_COLORS[flower.color % FLOWER_COLORS.length] as string;
    for (let i = 0; i < 4; i += 1) {
      const a = rng() * TAU;
      const d = rng() * 0.011;
      g.beginPath();
      g.arc(flower.x + Math.cos(a) * d, flower.z + Math.sin(a) * d, 0.0034, 0, TAU);
      g.fill();
    }
  }

  // Paved plinths under each building, then soft contact shadows around them.
  g.fillStyle = GROUND.paving;
  for (const b of model.buildings) {
    footprintPath(g, b, 0.011);
    g.fill();
  }
  g.strokeStyle = GROUND.pavingEdge;
  g.lineWidth = 0.0025;
  for (const b of model.buildings) {
    footprintPath(g, b, 0.011);
    g.stroke();
  }
  softShadow(g, scale, 0.02, 'rgba(36, 30, 84, 0.42)', (offset) => {
    for (const b of everyBuilding) {
      footprintPath(g, b, 0.003, offset);
      g.fill();
    }
  });
  softShadow(g, scale, 0.016, 'rgba(24, 60, 36, 0.4)', (offset) => {
    for (const tree of model.trees) {
      g.beginPath();
      g.arc(tree.x + offset, tree.z, tree.size * 0.85, 0, TAU);
      g.fill();
    }
  });

  g.restore();
  return canvas;
}

/* ───────────────────────────── Facades ───────────────────────────── */

const MAX_TIERS = 3;

export interface FacadeAtlas {
  canvas: HTMLCanvasElement;
  /** sx, sy, sw, sh per face slot (see `faceSlot`). */
  rects: Float32Array;
  /** Two twinkling windows per slot: u0, v0, du, dv each, in face units. */
  twinkles: Float32Array;
  /** Lit colour of each twinkle window. */
  twinkleColors: string[];
}

/**
 * Slot for one face kind of one tier. Building 0 is the tower, then
 * `model.buildings` in order. Kind 0 is the face along the local x axis (its
 * width is 2 hw), kind 1 the face along the local z axis (2 hd).
 */
export function faceSlot(buildingIndex: number, tier: number, kind: 0 | 1): number {
  return (buildingIndex * MAX_TIERS + tier) * 2 + kind;
}

/** Where a window cell sits on the face, in face units. */
function windowBox(look: FacadeLook, col: number, row: number, cols: number, rows: number): [number, number, number, number] {
  const cw = 1 / cols;
  const rh = 1 / rows;
  switch (look.kind) {
    case 'ribbon':
      return [col * cw + cw * 0.04, row * rh + rh * 0.24, cw * 0.92, rh * 0.5];
    case 'grid':
    case 'house':
      return [col * cw + cw * 0.2, row * rh + rh * 0.22, cw * 0.6, rh * 0.54];
    case 'podium':
    case 'pavilion':
      return [col * cw + cw * 0.08, row * rh + rh * 0.1, cw * 0.84, rh * 0.78];
    default:
      return [col * cw + cw * 0.13, row * rh + rh * 0.17, cw * 0.74, rh * 0.62];
  }
}

/** Rows (from the top) of the main tower shaft kept dark for the "R". */
export const EMBLEM_V0 = 0.04;
export const EMBLEM_V1 = 0.27;

function paintFacade(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  look: FacadeLook,
  cols: number,
  rows: number,
  rng: () => number,
  emblem: boolean,
) {
  // Base, bled into the padding so filtering at the edges never shows a seam.
  const base = g.createLinearGradient(0, y, 0, y + h);
  base.addColorStop(0, look.top);
  base.addColorStop(1, look.bottom);
  g.fillStyle = base;
  g.fillRect(x - 2, y - 2, w + 4, h + 4);

  const isLit = (row: number) => rng() < look.litChance * (look.kind === 'tower' && row > rows * 0.8 ? 0.6 : 1);

  for (let row = 0; row < rows; row += 1) {
    const v = row / rows;
    if (emblem && v + 1 / rows > EMBLEM_V0 && v < EMBLEM_V1) continue;
    for (let col = 0; col < cols; col += 1) {
      const [u0, v0, du, dv] = windowBox(look, col, row, cols, rows);
      const lit = isLit(row);
      if (lit) {
        g.globalAlpha = 0.78 + rng() * 0.22;
        g.fillStyle = look.lit[Math.floor(rng() * look.lit.length)] as string;
      } else {
        g.globalAlpha = look.kind === 'grid' || look.kind === 'house' || look.kind === 'ribbon' ? 0.92 : 0.6;
        g.fillStyle = look.dark;
      }
      g.fillRect(x + u0 * w, y + v0 * h, Math.max(1, du * w), Math.max(1, dv * h));
    }
  }
  g.globalAlpha = 1;

  // Structure: mullions on glass, slab lines on walls.
  const px = Math.max(1, Math.round(w / cols / 12));
  if (look.kind === 'glass' || look.kind === 'tower' || look.kind === 'crown' || look.kind === 'pavilion' || look.kind === 'podium') {
    g.fillStyle = look.frame;
    g.globalAlpha = look.kind === 'crown' ? 0.75 : 0.32;
    for (let col = 1; col < cols; col += 1) g.fillRect(x + (col / cols) * w - px / 2, y, px, h);
    g.globalAlpha = 0.2;
    for (let row = 1; row < rows; row += 1) g.fillRect(x, y + (row / rows) * h - 0.5, w, 1);
  } else {
    g.fillStyle = '#7d73b4';
    g.globalAlpha = 0.14;
    for (let row = 1; row < rows; row += 1) g.fillRect(x, y + (row / rows) * h - 0.5, w, 1);
  }
  g.globalAlpha = 1;

  if (emblem) {
    // A dark glass panel behind the "R", with a fine violet frame.
    const top = y + EMBLEM_V0 * h;
    const height = (EMBLEM_V1 - EMBLEM_V0) * h;
    g.fillStyle = '#16134a';
    g.fillRect(x + w * 0.06, top, w * 0.88, height);
    g.strokeStyle = 'rgba(167, 139, 250, 0.7)';
    g.lineWidth = Math.max(1, w / 90);
    g.strokeRect(x + w * 0.06, top, w * 0.88, height);
  }

  // Glass catches the sky: a soft diagonal reflection band.
  if (look.kind !== 'grid' && look.kind !== 'house' && look.kind !== 'ribbon') {
    const sheen = g.createLinearGradient(x, y, x + w, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(x, y, w, h);
  }

  // Lit edges on the tower and the crown, like the reference's glowing fins.
  if (look.kind === 'tower' || look.kind === 'crown') {
    const fin = Math.max(1, Math.round(w / 26));
    g.fillStyle = look.kind === 'tower' ? 'rgba(143, 170, 255, 0.85)' : 'rgba(236, 228, 255, 0.95)';
    g.fillRect(x, y, fin, h);
    g.fillRect(x + w - fin, y, fin, h);
  }

  // Parapet cap, lit lobby, and ambient occlusion at the foot.
  g.fillStyle = look.frame;
  g.globalAlpha = 0.75;
  g.fillRect(x, y, w, Math.max(1, h / rows / 4));
  g.globalAlpha = 1;
  if (look.kind !== 'house') {
    const lobby = Math.max(1, (h / rows) * 0.8);
    g.fillStyle = look.kind === 'tower' ? 'rgba(160, 196, 255, 0.55)' : 'rgba(220, 240, 255, 0.45)';
    g.fillRect(x, y + h - lobby, w, lobby);
  } else {
    // A door.
    const dw = Math.max(2, w * 0.18);
    const dh = Math.max(2, (h / rows) * 0.75);
    g.fillStyle = '#a58c9a';
    g.fillRect(x + w * 0.5 - dw / 2, y + h - dh, dw, dh);
  }
  const ao = g.createLinearGradient(0, y + h * 0.84, 0, y + h);
  ao.addColorStop(0, 'rgba(25, 20, 70, 0)');
  ao.addColorStop(1, 'rgba(25, 20, 70, 0.32)');
  g.fillStyle = ao;
  g.fillRect(x, y + h * 0.84, w, h * 0.16);

  // Bevelled corners: a bright hairline on each vertical edge (where two walls
  // meet it reads as the lit corner, on the silhouette as rim light), then a
  // slightly darker band inside it to round the form off.
  const band = Math.max(1, Math.round(w * 0.05));
  g.fillStyle = 'rgba(20, 16, 60, 0.12)';
  g.fillRect(x + 1, y, band, h);
  g.fillRect(x + w - 1 - band, y, band, h);
  g.fillStyle = 'rgba(255, 255, 255, 0.4)';
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}

/**
 * Packs every facade (two per tier: one for the width faces, one for the depth
 * faces) into one canvas, so all buildings draw from a single source image.
 * `density` is texels per world unit; it matches the on-screen scale.
 */
export function paintFacadeAtlas(model: IslandModel, density: number): FacadeAtlas {
  const everyBuilding = [model.tower, ...model.buildings];
  const slotCount = everyBuilding.length * MAX_TIERS * 2;
  const rects = new Float32Array(slotCount * 4);
  const twinkles = new Float32Array(slotCount * 8);
  const twinkleColors: string[] = new Array<string>(slotCount * 2).fill('#ffffff');

  interface Item {
    slot: number;
    b: number;
    t: number;
    kind: 0 | 1;
    w: number;
    h: number;
    worldW: number;
    worldH: number;
    x: number;
    y: number;
  }
  const items: Item[] = [];
  const pad = 3;
  everyBuilding.forEach((building, b) => {
    building.tiers.forEach((tier, t) => {
      const worldH = tier.y1 - tier.y0;
      for (const kind of [0, 1] as const) {
        const worldW = (kind === 0 ? tier.hw : tier.hd) * 2;
        items.push({
          slot: faceSlot(b, t, kind),
          b,
          t,
          kind,
          w: Math.max(4, Math.round(worldW * density)),
          h: Math.max(4, Math.round(worldH * density * 0.92)),
          worldW,
          worldH,
          x: 0,
          y: 0,
        });
      }
    });
  });

  // Shelf packing, tallest first.
  const width = density > 520 ? 2048 : 1024;
  items.sort((a, b) => b.h - a.h || b.w - a.w);
  let cursorX = pad;
  let cursorY = pad;
  let shelf = 0;
  for (const item of items) {
    if (cursorX + item.w + pad > width) {
      cursorX = pad;
      cursorY += shelf + pad * 2;
      shelf = 0;
    }
    item.x = cursorX;
    item.y = cursorY;
    cursorX += item.w + pad * 2;
    shelf = Math.max(shelf, item.h);
  }
  const canvas = makeCanvas(width, cursorY + shelf + pad);
  const g = context(canvas);
  const rng = createRng((model.seed * 31 + 5) >>> 0);

  for (const item of items) {
    const building = everyBuilding[item.b] as Building;
    const tier = building.tiers[item.t];
    if (!tier) continue;
    const look = FACADES[tier.style];
    const cols = Math.max(2, Math.round(item.worldW / look.cellW));
    const rows = Math.max(1, Math.round(item.worldH / look.cellH));
    // The "R" sits on the two opposite width faces, so exactly one is in view at a time.
    const emblem = tier.style === 'towerMain' && item.kind === 0;
    paintFacade(g, item.x, item.y, item.w, item.h, look, cols, rows, rng, emblem);
    rects.set([item.x, item.y, item.w, item.h], item.slot * 4);
    for (let k = 0; k < 2; k += 1) {
      let row = Math.floor(rng() * rows);
      if (emblem && row / rows < EMBLEM_V1 + 0.02) row = Math.min(rows - 1, row + Math.ceil(rows * 0.3));
      const [u0, v0, du, dv] = windowBox(look, Math.floor(rng() * cols), row, cols, rows);
      twinkles.set([u0, v0, du, dv], item.slot * 8 + k * 4);
      twinkleColors[item.slot * 2 + k] = look.lit[Math.floor(rng() * look.lit.length)] as string;
    }
  }
  return { canvas, rects, twinkles, twinkleColors };
}

/* ───────────────────────────── Trees ───────────────────────────── */

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Anchor in sprite pixels: where the trunk meets the ground. */
  ax: number;
  ay: number;
  /** Sprite pixels per world unit of tree "size" (canopy radius). */
  unit: number;
}

function lobe(g: CanvasRenderingContext2D, x: number, y: number, r: number, colors: readonly [string, string, string]) {
  const grad = g.createRadialGradient(x - r * 0.38, y - r * 0.45, r * 0.05, x, y, r * 1.08);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.5, colors[1]);
  grad.addColorStop(1, colors[2]);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** One tree sprite, drawn for a canopy radius of `R` pixels. */
export function paintTree(kind: TreeKind, R: number, seed: number): Sprite {
  const rng = createRng(seed);
  const colors = TREE_COLORS[kind] ?? TREE_COLORS[0];
  const c = colors as readonly [string, string, string];
  const w = Math.ceil(R * 2.8);
  const tall = kind === 3;
  const h = Math.ceil(R * (tall ? 4.1 : kind === 5 ? 2.6 : 3.3));
  const canvas = makeCanvas(w, h);
  const g = context(canvas);
  const ax = w / 2;
  const ay = h - R * 0.12;

  if (kind !== 5) {
    const trunkH = R * (tall ? 0.5 : 0.78);
    g.fillStyle = TRUNK;
    g.fillRect(ax - R * 0.11, ay - trunkH, R * 0.22, trunkH);
    g.fillStyle = 'rgba(40, 20, 30, 0.35)';
    g.fillRect(ax, ay - trunkH, R * 0.11, trunkH);
  }

  if (tall) {
    // Cypress: a stack of narrowing lobes.
    const baseY = ay - R * 0.45;
    const tiers = 5;
    for (let i = 0; i < tiers; i += 1) {
      const t = i / (tiers - 1);
      const r = R * (0.78 - t * 0.5);
      lobe(g, ax + (rng() - 0.5) * R * 0.12, baseY - R * 0.55 - t * R * 2.3, r, c);
    }
  } else {
    const cy = ay - R * (kind === 5 ? 0.85 : 1.55);
    const lobes: [number, number, number][] = [
      [-0.12, -0.42, 0.56],
      [0.32, -0.32, 0.52],
      [0, -0.02, 0.86],
      [-0.5, 0.2, 0.64],
      [0.5, 0.24, 0.6],
      [0.02, 0.36, 0.62],
    ];
    for (const [dx, dy, r] of lobes) {
      lobe(g, ax + (dx + (rng() - 0.5) * 0.1) * R, cy + (dy + (rng() - 0.5) * 0.08) * R, r * R, c);
    }
    // Leaf highlights on the sunny side.
    g.fillStyle = c[0];
    for (let i = 0; i < 7; i += 1) {
      g.globalAlpha = 0.35 + rng() * 0.35;
      const a = Math.PI * (1.0 + rng() * 0.6);
      const d = R * (0.35 + rng() * 0.45);
      g.beginPath();
      g.arc(ax + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.07 + rng() * 0.08), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    if (kind === 4) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i += 1) {
        g.globalAlpha = 0.5 + rng() * 0.4;
        const a = rng() * TAU;
        const d = rng() * R * 0.8;
        g.beginPath();
        g.arc(ax + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, R * 0.06, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  // Shade the underside of the canopy, only where there are leaves.
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, ay - R * 2.2, 0, ay);
  shade.addColorStop(0, 'rgba(20, 40, 60, 0)');
  shade.addColorStop(1, 'rgba(20, 40, 60, 0.32)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';

  return { canvas, ax, ay, unit: R };
}

/* ───────────────────────────── Clouds ───────────────────────────── */

/**
 * A cumulus sprite: three rows of puffs (billows at the back, body in the
 * middle, lobes along the base) under a dome profile. Each puff is painted as
 * a softly lit sphere, back to front, so every billow's shaded lower edge is
 * overlapped by the sunlit top of the one in front: that's what reads as
 * volume. Lavender-pink underneath, a misty flat base. `bank` is wide and low.
 */
export function paintCloud(widthPx: number, aspect: number, seed: number, bank: boolean): HTMLCanvasElement {
  const rng = createRng(seed);
  const w = Math.max(16, Math.round(widthPx));
  const h = Math.max(8, Math.round(widthPx * aspect));
  const canvas = makeCanvas(w, h);
  const g = context(canvas);
  const baseY = h * 0.86;
  const peak = h * (bank ? 0.6 : 0.74);
  const bumpA = rng() * TAU;
  const skew = (rng() - 0.5) * 0.3;
  const dome = (t: number) => {
    const u = Math.min(1, Math.max(0, t + skew * t * (1 - t)));
    const s = Math.sin(Math.PI * u);
    return peak * Math.pow(s, bank ? 0.5 : 0.8) * (0.86 + 0.14 * Math.sin(u * 9 + bumpA));
  };

  interface Puff {
    x: number;
    y: number;
    r: number;
  }
  const puffs: (Puff & { shade: string })[] = [];
  // Lower rows get flatter shading: a cloud's base reads as one mass, not a row of balls.
  const addRow = (count: number, x0: number, x1: number, rMin: number, rMax: number, reach: number, shade: string) => {
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5 + (rng() - 0.5) * 0.6) / count;
      const r = h * (rMin + rng() * (rMax - rMin));
      const x = Math.min(w - r * 1.02, Math.max(r * 1.02, w * (x0 + (x1 - x0) * t)));
      const top = Math.max(r * 0.02, baseY - dome(x / w) * reach);
      puffs.push({ x, y: Math.min(baseY - r * 0.45, top + r), r, shade });
    }
  };
  if (bank) {
    addRow(7, 0.14, 0.86, 0.22, 0.32, 1, '#dfcdea');
    addRow(8, 0.07, 0.93, 0.2, 0.3, 0.66, '#e6d8ef');
    addRow(7, 0.04, 0.96, 0.17, 0.26, 0.3, '#eee5f4');
  } else {
    addRow(4, 0.26, 0.74, 0.23, 0.32, 1, '#dccaea');
    addRow(6, 0.12, 0.88, 0.19, 0.27, 0.64, '#e4d6ee');
    addRow(5, 0.06, 0.94, 0.16, 0.23, 0.3, '#ede4f4');
  }

  for (const p of puffs) {
    // Lit from the upper left: the gradient is centred there, so the sunny edge
    // stays white and only the lower-right edge falls into lavender shade.
    const lx = p.x - p.r * 0.34;
    const ly = p.y - p.r * 0.4;
    const shade = g.createRadialGradient(lx, ly, 0, lx, ly, p.r * 1.5);
    shade.addColorStop(0, '#ffffff');
    shade.addColorStop(0.45, '#fdfbff');
    shade.addColorStop(0.75, '#f3ecf8');
    shade.addColorStop(1, p.shade);
    g.fillStyle = shade;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, TAU);
    g.fill();
  }

  g.globalCompositeOperation = 'source-atop';
  // Lavender-pink underside.
  const under = g.createLinearGradient(0, baseY - peak * 0.55, 0, baseY);
  under.addColorStop(0, 'rgba(236, 204, 232, 0)');
  under.addColorStop(1, 'rgba(232, 192, 226, 0.4)');
  g.fillStyle = under;
  g.fillRect(0, 0, w, h);
  // A breath of warm sunset on the left, cooler lavender on the right.
  const warm = g.createLinearGradient(0, 0, w, 0);
  warm.addColorStop(0, 'rgba(255, 214, 196, 0.26)');
  warm.addColorStop(0.5, 'rgba(255, 230, 220, 0)');
  warm.addColorStop(1, 'rgba(206, 196, 255, 0.16)');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  // Misty flat base instead of a row of round bottoms.
  g.globalCompositeOperation = 'destination-out';
  const base = g.createLinearGradient(0, baseY - h * 0.05, 0, baseY + h * 0.09);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = base;
  g.fillRect(0, baseY - h * 0.05, w, h);
  g.globalCompositeOperation = 'source-over';

  // A whisker of blur turns the crisp spheres into fluff. Skipped where canvas
  // filters are unsupported; the clouds are still fine, just crisper.
  if ('filter' in g) {
    const soft = makeCanvas(w, h);
    const sg = context(soft);
    sg.filter = `blur(${Math.max(0.6, w / 480).toFixed(2)}px)`;
    sg.drawImage(canvas, 0, 0);
    return soft;
  }
  return canvas;
}

/* ───────────────────────────── Atlases ───────────────────────────── */

export interface PackedAtlas {
  canvas: HTMLCanvasElement;
  /** sx, sy, sw, sh per packed canvas, in the order given. */
  rects: Float32Array;
}

/**
 * Packs small canvases side by side into one. Draws that share a source image
 * can be merged into one GPU draw, so sprites used together live together.
 */
export function packAtlas(canvases: HTMLCanvasElement[], pad = 2): PackedAtlas {
  let width = pad;
  let height = 0;
  for (const c of canvases) {
    width += c.width + pad;
    height = Math.max(height, c.height);
  }
  const canvas = makeCanvas(width, height + pad * 2);
  const g = context(canvas);
  const rects = new Float32Array(canvases.length * 4);
  let x = pad;
  canvases.forEach((c, i) => {
    g.drawImage(c, x, pad);
    rects.set([x, pad, c.width, c.height], i * 4);
    x += c.width + pad;
  });
  return { canvas, rects };
}

/* ───────────────────────────── Glows and marks ───────────────────────────── */

/** A soft radial glow, white at the centre, in the given colour. */
export function paintGlow(hex: string, size = 64, falloff: 'soft' | 'tight' = 'soft'): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const g = context(canvas);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  if (falloff === 'tight') {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, rgba(hex, 0.95));
    grad.addColorStop(0.35, rgba(hex, 0.3));
    grad.addColorStop(1, rgba(hex, 0));
  } else {
    grad.addColorStop(0, rgba(hex, 0.9));
    grad.addColorStop(0.25, rgba(hex, 0.55));
    grad.addColorStop(0.55, rgba(hex, 0.18));
    grad.addColorStop(1, rgba(hex, 0));
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

/** A four-pointed sparkle. */
export function paintStar(size = 48): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const g = context(canvas);
  const c = size / 2;
  const glow = g.createRadialGradient(c, c, 0, c, c, c * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.3, 'rgba(200,180,255,0.35)');
  glow.addColorStop(1, 'rgba(200,180,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  // Two pinched diamonds: a long vertical ray and a shorter horizontal one.
  g.fillStyle = '#ffffff';
  const ray = (rx: number, ry: number) => {
    g.beginPath();
    g.moveTo(c, c - ry);
    g.quadraticCurveTo(c, c, c + rx, c);
    g.quadraticCurveTo(c, c, c, c + ry);
    g.quadraticCurveTo(c, c, c - rx, c);
    g.quadraticCurveTo(c, c, c, c - ry);
    g.fill();
  };
  ray(c * 0.16, c * 0.95);
  ray(c * 0.7, c * 0.16);
  return canvas;
}

/** A soft diagonal glint, mapped onto glass faces as they turn into the light. */
export function paintSheen(size = 64): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const g = context(canvas);
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255, 244, 250, 0)');
  grad.addColorStop(0.3, 'rgba(255, 244, 250, 0.15)');
  grad.addColorStop(0.48, 'rgba(255, 250, 255, 0.9)');
  grad.addColorStop(0.58, 'rgba(255, 244, 250, 0.25)');
  grad.addColorStop(1, 'rgba(255, 244, 250, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

/** The falling-water ribbon body: soft sides, fading toward the bottom. */
export function paintWaterfall(w = 32, h = 128): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const g = context(canvas);
  const down = g.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, 'rgba(236, 250, 255, 0.95)');
  down.addColorStop(0.35, 'rgba(196, 236, 255, 0.78)');
  down.addColorStop(0.75, 'rgba(214, 240, 255, 0.4)');
  down.addColorStop(1, 'rgba(240, 248, 255, 0)');
  g.fillStyle = down;
  g.fillRect(0, 0, w, h);
  // Soft edges across the ribbon.
  g.globalCompositeOperation = 'destination-in';
  const across = g.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.2, 'rgba(0,0,0,1)');
  across.addColorStop(0.8, 'rgba(0,0,0,1)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return canvas;
}

/** The logo mark's "R" (same path as the nav logo), glowing white-violet. */
const R_BOWL = 'M6 4h11.5c4.7 0 8 3.1 8 7.6s-3.3 7.6-8 7.6h-5.1V28H6Zm6.4 5.2V14H17c1.7 0 2.6-1 2.6-2.4S18.7 9.2 17 9.2Z';
const R_LEG = 'M15.4 21.4h6.7L27 28h-6.7Z';
/** Fraction of the emblem sprite taken by glow padding on each side. */
export const EMBLEM_PAD = 0.22;

export function paintEmblem(size = 192): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const g = context(canvas);
  const inner = size * (1 - EMBLEM_PAD * 2);
  // The glyph spans about 24 x 24 units of the 32-unit logo box.
  const unit = inner / 24;
  const bowl = new Path2D(R_BOWL);
  const leg = new Path2D(R_LEG);
  const place = () => {
    g.setTransform(unit, 0, 0, unit, size / 2 - 16.6 * unit, size / 2 - 16 * unit);
    g.transform(1, 0, Math.tan((-8 * Math.PI) / 180), 1, 3.4, 0);
  };
  place();
  g.lineJoin = 'round';
  // Wide violet-blue glow first, then a bright core thickened by a stroke so the
  // mark still reads as an "R" (leg included) at a few dozen pixels.
  g.shadowColor = 'rgba(124, 92, 255, 1)';
  g.shadowBlur = size * 0.14;
  g.fillStyle = '#c9bbff';
  g.strokeStyle = '#c9bbff';
  g.lineWidth = 2.2;
  g.fill(bowl, 'evenodd');
  g.fill(leg);
  g.stroke(leg);
  g.shadowBlur = size * 0.05;
  g.shadowColor = 'rgba(170, 200, 255, 1)';
  const core = g.createLinearGradient(6, 4, 26, 28);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(1, '#eef0ff');
  g.fillStyle = core;
  g.strokeStyle = core;
  g.lineWidth = 1.1;
  g.fill(bowl, 'evenodd');
  g.stroke(bowl);
  g.fill(leg);
  g.stroke(leg);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
