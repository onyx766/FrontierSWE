import * as THREE from 'three';
import { createRng, rngBetween, rngInt, rngPick } from '@/lib/rng';
import { DECK_UV_RADIUS } from './platformGeometry';

/**
 * The islands' surfaces, painted once at startup and never touched again.
 *
 * The deck and trim painters run once per channel from the same seed, so that
 * their albedo, height and roughness maps agree seam for seam. Normal maps are
 * derived from the height channel here, rather than by using a bump map, because
 * a bump map's screen-space derivatives go blocky when magnified, and the robot
 * walks on this with the camera a few units away.
 */

export interface SurfaceSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

type Channel = 'albedo' | 'height' | 'rough';

/** One kind of surface, expressed in each channel. */
interface Finish {
  /** Albedo lightness, 0 to 255. */
  tone: number;
  height: number;
  rough: number;
}

const SEAM: Finish = { tone: 12, height: 0.1, rough: 0.9 };
const PANEL: Finish = { tone: 34, height: 0.62, rough: 0.56 };
const RECESS: Finish = { tone: 29, height: 0.44, rough: 0.66 };
const RAISED: Finish = { tone: 37, height: 0.74, rough: 0.5 };
const TRIM: Finish = { tone: 46, height: 0.8, rough: 0.36 };
const BOLT: Finish = { tone: 64, height: 0.96, rough: 0.3 };
const SOCKET: Finish = { tone: 18, height: 0.24, rough: 0.8 };

function ink(channel: Channel, finish: Finish, lift = 0): string {
  if (channel === 'albedo') {
    /* Barely blue: the sky's fill and the crystal's light supply the rest of the slate. */
    const value = finish.tone + lift * 3.5;
    return `rgb(${Math.round(value * 0.9)},${Math.round(value)},${Math.round(value)})`;
  }
  const value = channel === 'height' ? finish.height + lift * 0.04 : finish.rough - lift * 0.08;
  const grey = Math.round(Math.min(1, Math.max(0, value)) * 255);
  return `rgb(${grey},${grey},${grey})`;
}

function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable');
  return { canvas, context };
}

/** Outline of an annular panel, inset evenly from its seams. Angles in radians. */
function sectorPath(
  context: CanvasRenderingContext2D,
  inner: number,
  outer: number,
  from: number,
  to: number,
  inset: number,
): void {
  const innerGap = inset / inner;
  const outerGap = inset / outer;
  context.beginPath();
  context.arc(0, 0, outer - inset, from + outerGap, to - outerGap);
  context.arc(0, 0, inner + inset, to - innerGap, from + innerGap, true);
  context.closePath();
}

function bolt(
  context: CanvasRenderingContext2D,
  channel: Channel,
  radius: number,
  angle: number,
  size: number,
): void {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  context.fillStyle = ink(channel, SOCKET);
  context.beginPath();
  context.arc(x, y, size * 1.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = ink(channel, BOLT);
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
}

interface DeckRing {
  inner: number;
  outer: number;
  panels: number;
}

/** The deck's plates, from the prop court out to the rim. */
const DECK_RINGS: DeckRing[] = [
  { inner: 1.1, outer: 4.8, panels: 6 },
  { inner: 4.8, outer: 8.7, panels: 10 },
  { inner: 9.2, outer: 13.2, panels: 14 },
  { inner: 13.2, outer: 16.7, panels: 18 },
];

type PanelDetail = 'plain' | 'inset' | 'vents' | 'studs' | 'hatch';

const PANEL_DETAILS: PanelDetail[] = [
  'plain',
  'plain',
  'plain',
  'plain',
  'inset',
  'vents',
  'studs',
  'hatch',
  'hatch',
];

function paintPanelDetail(
  context: CanvasRenderingContext2D,
  channel: Channel,
  rng: () => number,
  detail: PanelDetail,
  ring: DeckRing,
  from: number,
  to: number,
): void {
  const { inner, outer } = ring;
  const middle = (inner + outer) / 2;
  const angle = (from + to) / 2;
  const span = to - from;

  if (detail === 'inset') {
    sectorPath(context, inner, outer, from, to, 0.34);
    context.fillStyle = ink(channel, RECESS);
    context.fill();
    context.strokeStyle = ink(channel, SEAM);
    context.lineWidth = 0.05;
    context.stroke();
    sectorPath(context, inner, outer, from, to, 0.42);
    context.strokeStyle = ink(channel, RAISED);
    context.lineWidth = 0.02;
    context.stroke();
  }

  if (detail === 'vents') {
    const slots = rngInt(rng, 5, 8);
    context.strokeStyle = ink(channel, SEAM);
    context.lineCap = 'round';
    context.lineWidth = 0.12;
    for (let slot = 0; slot < slots; slot += 1) {
      const radius = inner + ((slot + 1) / (slots + 1)) * (outer - inner);
      context.beginPath();
      context.arc(0, 0, radius, angle - span * 0.3, angle + span * 0.3);
      context.stroke();
    }
    context.lineCap = 'butt';
  }

  if (detail === 'studs') {
    context.fillStyle = ink(channel, RAISED);
    for (let row = 0; row < 3; row += 1) {
      const radius = inner + ((row + 1) / 4) * (outer - inner);
      const count = Math.max(4, Math.floor((radius * span) / 0.44));
      for (let stud = 0; stud < count; stud += 1) {
        const at = from + ((stud + 0.5) / count) * span;
        context.beginPath();
        context.arc(Math.cos(at) * radius, Math.sin(at) * radius, 0.07, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (detail === 'hatch') {
    const width = Math.min(1.3, (outer - inner) * 0.56);
    const height = Math.min(0.9, span * middle * 0.42);
    context.save();
    context.rotate(angle);
    context.translate(middle, 0);
    context.fillStyle = ink(channel, SEAM);
    context.fillRect(-width / 2 - 0.05, -height / 2 - 0.05, width + 0.1, height + 0.1);
    context.fillStyle = ink(channel, RAISED);
    context.fillRect(-width / 2, -height / 2, width, height);
    context.fillStyle = ink(channel, SOCKET);
    context.fillRect(-width * 0.28, -0.05, width * 0.56, 0.1);
    context.restore();
  }
}

/** Stress cracks running in from the slab's edge. */
function paintCracks(context: CanvasRenderingContext2D, channel: Channel, rng: () => number): void {
  context.strokeStyle = ink(channel, SEAM);
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (let index = 0; index < 26; index += 1) {
    let angle = rng() * Math.PI * 2;
    let radius = 17.3;
    context.lineWidth = rngBetween(rng, 0.03, 0.075);
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);

    const steps = rngInt(rng, 3, 7);
    for (let step = 0; step < steps; step += 1) {
      radius -= rngBetween(rng, 0.3, 0.9);
      angle += rngBetween(rng, -0.05, 0.05);
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.stroke();
  }

  context.lineCap = 'butt';
}

/** Scuffs and grime. Albedo and roughness only: it has no depth. */
function paintWear(context: CanvasRenderingContext2D, channel: Channel, rng: () => number): void {
  const extent = DECK_UV_RADIUS;
  const place = () => {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * extent;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle, radius };
  };

  /* Soft stains. */
  for (let index = 0; index < 340; index += 1) {
    const { x, y } = place();
    const radius = rngBetween(rng, 0.3, 2.6);
    const strength = rngBetween(rng, 0.05, 0.2);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const stain = channel === 'albedo' ? '4,5,8' : '220,220,220';
    gradient.addColorStop(0, `rgba(${stain},${strength})`);
    gradient.addColorStop(1, `rgba(${stain},0)`);
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /* Fine scratches, mostly following the direction of foot traffic around the deck. */
  const scratch = channel === 'albedo' ? '150,162,186' : '60,60,60';
  context.lineCap = 'round';
  for (let index = 0; index < 900; index += 1) {
    const { angle, radius } = place();
    const sweep = rngBetween(rng, 0.02, 0.3);
    const alpha = rngBetween(rng, 0.03, 0.16);
    context.strokeStyle = `rgba(${scratch},${alpha})`;
    context.lineWidth = rngBetween(rng, 0.008, 0.03);
    context.beginPath();
    context.arc(0, 0, radius, angle, angle + sweep);
    context.stroke();
  }
  context.lineCap = 'butt';

  /* Rust-brown weeping from seams, kept faint. */
  if (channel === 'albedo') {
    for (let index = 0; index < 90; index += 1) {
      const { x, y, angle } = place();
      const length = rngBetween(rng, 0.5, 2.2);
      context.strokeStyle = `rgba(112,72,44,${rngBetween(rng, 0.04, 0.12)})`;
      context.lineWidth = rngBetween(rng, 0.03, 0.09);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }
  }
}

function paintDeck(channel: Channel, size: number, seed: number): HTMLCanvasElement {
  const { canvas, context } = createCanvas(size, size);
  const unit = size / (2 * DECK_UV_RADIUS);

  context.fillStyle = ink(channel, SEAM);
  context.fillRect(0, 0, size, size);
  context.setTransform(unit, 0, 0, unit, size / 2, size / 2);

  const rng = createRng(seed);

  /* Hub. */
  context.fillStyle = ink(channel, RAISED);
  context.beginPath();
  context.arc(0, 0, 1.04, 0, Math.PI * 2);
  context.fill();

  for (const ring of DECK_RINGS) {
    const step = (Math.PI * 2) / ring.panels;
    const start = rng() * step;

    for (let panel = 0; panel < ring.panels; panel += 1) {
      const from = start + panel * step;
      const to = from + step;
      const lift = rngBetween(rng, -1, 1);

      sectorPath(context, ring.inner, ring.outer, from, to, 0.03);
      context.fillStyle = ink(channel, PANEL, lift);
      context.fill();

      paintPanelDetail(context, channel, rng, rngPick(rng, PANEL_DETAILS), ring, from, to);

      const margin = 0.2;
      const gapInner = margin / ring.inner;
      const gapOuter = margin / ring.outer;
      bolt(context, channel, ring.inner + margin, from + gapInner, 0.05);
      bolt(context, channel, ring.inner + margin, to - gapInner, 0.05);
      bolt(context, channel, ring.outer - margin, from + gapOuter, 0.05);
      bolt(context, channel, ring.outer - margin, to - gapOuter, 0.05);
    }
  }

  /* The machined trim rings: the prop court's edge and the deck's edge. */
  for (const [inner, outer, ticks] of [
    [8.74, 9.16, 72],
    [16.74, 17.4, 180],
  ] as const) {
    context.fillStyle = ink(channel, TRIM);
    context.beginPath();
    context.arc(0, 0, outer, 0, Math.PI * 2);
    context.arc(0, 0, inner, 0, Math.PI * 2, true);
    context.fill();

    context.strokeStyle = ink(channel, SEAM);
    context.lineWidth = 0.035;
    for (let tick = 0; tick < ticks; tick += 1) {
      const angle = (tick / ticks) * Math.PI * 2;
      const reach = tick % 5 === 0 ? outer - 0.04 : (inner + outer) / 2 + 0.06;
      context.beginPath();
      context.moveTo(Math.cos(angle) * (inner + 0.04), Math.sin(angle) * (inner + 0.04));
      context.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      context.stroke();
    }
  }

  paintCracks(context, channel, createRng(seed ^ 0x3c6e));
  if (channel !== 'height') paintWear(context, channel, createRng(seed ^ 0x9e37));

  return canvas;
}

/** Row heights of the trim sheet in pixels, top to bottom. See `TRIM_ROWS`. */
const TRIM_WIDTH = 1024;
const TRIM_HEIGHT = 256;

function paintTrim(channel: Channel, seed: number): HTMLCanvasElement {
  const { canvas, context } = createCanvas(TRIM_WIDTH, TRIM_HEIGHT);
  const rng = createRng(seed);

  context.fillStyle = ink(channel, PANEL);
  context.fillRect(0, 0, TRIM_WIDTH, TRIM_HEIGHT);

  /* Row one: wall panels. */
  const panelWidth = TRIM_WIDTH / 6;
  for (let panel = 0; panel < 6; panel += 1) {
    const x = panel * panelWidth;
    context.fillStyle = ink(channel, PANEL, rngBetween(rng, -1, 1));
    context.fillRect(x + 3, 4, panelWidth - 6, 120);

    const inset = 16;
    context.fillStyle = ink(channel, SEAM);
    context.fillRect(x + inset - 2, 26, panelWidth - inset * 2 + 4, 76);
    context.fillStyle = ink(channel, PANEL, rngBetween(rng, -1, 0.4));
    context.fillRect(x + inset, 28, panelWidth - inset * 2, 72);

    /* A row of slots or a label block inside the recess. */
    context.fillStyle = ink(channel, SEAM);
    if (panel % 2 === 0) {
      for (let slot = 0; slot < 9; slot += 1) {
        context.fillRect(x + inset + 14 + slot * 13, 44, 6, 40);
      }
    } else {
      context.fillStyle = ink(channel, RAISED);
      context.fillRect(x + inset + 10, 40, 56, 16);
      context.fillRect(x + inset + 10, 64, 34, 10);
    }

    for (const [boltX, boltY] of [
      [x + 10, 12],
      [x + panelWidth - 10, 12],
      [x + 10, 116],
      [x + panelWidth - 10, 116],
    ] as const) {
      context.fillStyle = ink(channel, SOCKET);
      context.beginPath();
      context.arc(boltX, boltY, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ink(channel, BOLT);
      context.beginPath();
      context.arc(boltX, boltY, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.fillStyle = ink(channel, SEAM);
  context.fillRect(0, 0, TRIM_WIDTH, 3);
  context.fillRect(0, 124, TRIM_WIDTH, 4);

  /* Row two: a machined lip with a bolt line. */
  context.fillStyle = ink(channel, TRIM);
  context.fillRect(0, 128, TRIM_WIDTH, 64);
  for (let x = 32; x < TRIM_WIDTH; x += 64) {
    context.fillStyle = ink(channel, SOCKET);
    context.beginPath();
    context.arc(x, 160, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ink(channel, BOLT);
    context.beginPath();
    context.arc(x, 160, 7, 0, Math.PI * 2);
    context.fill();
  }

  /* Row three: vents. */
  context.fillStyle = ink(channel, RAISED);
  context.fillRect(0, 192, TRIM_WIDTH, 32);
  context.fillStyle = ink(channel, SEAM);
  for (let x = 8; x < TRIM_WIDTH; x += 24) context.fillRect(x, 197, 14, 22);

  /* Row four: plain brushed metal. */
  context.fillStyle = ink(channel, TRIM);
  context.fillRect(0, 224, TRIM_WIDTH, 32);

  /* Long brushed streaks across the whole sheet. */
  if (channel !== 'height') {
    const streak = channel === 'albedo' ? '200,210,230' : '40,40,40';
    for (let index = 0; index < 500; index += 1) {
      context.fillStyle = `rgba(${streak},${rngBetween(rng, 0.015, 0.06)})`;
      context.fillRect(rng() * TRIM_WIDTH, rng() * TRIM_HEIGHT, rngBetween(rng, 30, 240), 1);
    }
  }

  return canvas;
}

/**
 * Tangent-space normals from a greyscale height canvas. `broad` adds the slope
 * measured over a wider span, for relief at a larger scale than the finest grain.
 */
function normalsFromHeight(
  source: HTMLCanvasElement,
  strength: number,
  broad = 0,
): HTMLCanvasElement {
  const { width, height } = source;
  const pixels = (source.getContext('2d') as CanvasRenderingContext2D).getImageData(
    0,
    0,
    width,
    height,
  ).data;
  const { canvas, context } = createCanvas(width, height);
  const output = context.createImageData(width, height);
  const target = output.data;

  const sample = (x: number, y: number) =>
    pixels[(((y + height) % height) * width + ((x + width) % width)) * 4] as number;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      /* Canvas y runs down and texture v runs up, so y's gradient keeps its sign. */
      let dx = ((sample(x - 1, y) - sample(x + 1, y)) / 255) * strength;
      let dy = ((sample(x, y + 1) - sample(x, y - 1)) / 255) * strength;
      if (broad > 0) {
        dx += ((sample(x - BROAD_SPAN, y) - sample(x + BROAD_SPAN, y)) / 255) * broad;
        dy += ((sample(x, y + BROAD_SPAN) - sample(x, y - BROAD_SPAN)) / 255) * broad;
      }
      const size = Math.hypot(dx, dy, 1);
      const offset = (y * width + x) * 4;
      target[offset] = ((dx / size) * 0.5 + 0.5) * 255;
      target[offset + 1] = ((dy / size) * 0.5 + 0.5) * 255;
      target[offset + 2] = ((1 / size) * 0.5 + 0.5) * 255;
      target[offset + 3] = 255;
    }
  }

  context.putImageData(output, 0, 0);
  return canvas;
}

/** Pixels either side of a texel for the wider slope in `normalsFromHeight`. */
const BROAD_SPAN = 7;

function texture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  anisotropy: number,
  wrapS: THREE.Wrapping = THREE.ClampToEdgeWrapping,
  wrapT: THREE.Wrapping = THREE.ClampToEdgeWrapping,
): THREE.CanvasTexture {
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = colorSpace;
  result.anisotropy = anisotropy;
  result.wrapS = wrapS;
  result.wrapT = wrapT;
  return result;
}

const DECK_SEED = 0x51de;
const TRIM_SEED = 0x7a1e;
const ROCK_SEED = 0x20c6;

export function createDeckSurface(anisotropy: number): SurfaceSet {
  const height = paintDeck('height', 1024, DECK_SEED);
  return {
    map: texture(paintDeck('albedo', 2048, DECK_SEED), THREE.SRGBColorSpace, anisotropy),
    normalMap: texture(normalsFromHeight(height, 2.2), THREE.NoColorSpace, anisotropy),
    roughnessMap: texture(paintDeck('rough', 1024, DECK_SEED), THREE.NoColorSpace, anisotropy),
  };
}

export function createTrimSurface(anisotropy: number): SurfaceSet {
  const repeat = THREE.RepeatWrapping;
  return {
    map: texture(paintTrim('albedo', TRIM_SEED), THREE.SRGBColorSpace, anisotropy, repeat),
    normalMap: texture(
      normalsFromHeight(paintTrim('height', TRIM_SEED), 3),
      THREE.NoColorSpace,
      anisotropy,
      repeat,
    ),
    roughnessMap: texture(paintTrim('rough', TRIM_SEED), THREE.NoColorSpace, anisotropy, repeat),
  };
}

/** Periodic value noise, stretched by giving the axes different cell counts. */
function addTilingNoise(
  field: Float32Array,
  size: number,
  cellsX: number,
  cellsY: number,
  amplitude: number,
  rng: () => number,
): void {
  const lattice = Float32Array.from({ length: cellsX * cellsY }, () => rng());
  const at = (x: number, y: number) =>
    lattice[((y + cellsY) % cellsY) * cellsX + ((x + cellsX) % cellsX)] as number;
  const fade = (t: number) => t * t * (3 - 2 * t);

  for (let y = 0; y < size; y += 1) {
    const cellY = (y / size) * cellsY;
    const row = Math.floor(cellY);
    const blendY = fade(cellY - row);

    for (let x = 0; x < size; x += 1) {
      const cellX = (x / size) * cellsX;
      const column = Math.floor(cellX);
      const blendX = fade(cellX - column);
      const top = at(column, row) + (at(column + 1, row) - at(column, row)) * blendX;
      const bottom = at(column, row + 1) + (at(column + 1, row + 1) - at(column, row + 1)) * blendX;
      const index = y * size + x;
      field[index] = (field[index] as number) + (top + (bottom - top) * blendY) * amplitude;
    }
  }
}

/** Draw something near a tile's edge at each wrap, so the texture has no seam. */
function drawWrapped(size: number, draw: (offsetX: number, offsetY: number) => void): void {
  for (const offsetX of [-size, 0, size]) {
    for (const offsetY of [-size, 0, size]) draw(offsetX, offsetY);
  }
}

/** Worn, lighter chips. Marks with any regular shape turn into a visible pattern when tiled. */
function paintRockChips(context: CanvasRenderingContext2D, size: number, rng: () => number): void {
  for (let index = 0; index < 150; index += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = rngBetween(rng, 3, 16);
    const corners = rngInt(rng, 4, 6);
    const light = rng() < 0.5;
    const alpha = rngBetween(rng, 0.05, 0.15);
    const outline = Array.from({ length: corners }, (_, corner) => {
      const angle = (corner / corners) * Math.PI * 2 + rngBetween(rng, -0.3, 0.3);
      const reach = radius * rngBetween(rng, 0.6, 1);
      return [Math.cos(angle) * reach, Math.sin(angle) * reach] as const;
    });
    drawWrapped(size, (offsetX, offsetY) => {
      context.fillStyle = light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      context.beginPath();
      outline.forEach(([pointX, pointY], corner) => {
        if (corner === 0) context.moveTo(x + offsetX + pointX, y + offsetY + pointY);
        else context.lineTo(x + offsetX + pointX, y + offsetY + pointY);
      });
      context.closePath();
      context.fill();
    });
  }
}

export function createRockSurface(anisotropy: number): SurfaceSet {
  const size = 512;
  const rng = createRng(ROCK_SEED);
  const field = new Float32Array(size * size);

  addTilingNoise(field, size, 10, 9, 0.12, rng);
  addTilingNoise(field, size, 26, 24, 0.24, rng);
  addTilingNoise(field, size, 60, 56, 0.3, rng);
  addTilingNoise(field, size, 130, 120, 0.2, rng);
  addTilingNoise(field, size, 256, 256, 0.14, rng);

  const { canvas, context } = createCanvas(size, size);
  const image = context.createImageData(size, size);
  for (let index = 0; index < field.length; index += 1) {
    const value = Math.min(1, Math.max(0, (field[index] as number) * 2.2 - 0.6));
    const grey = (0.68 + value * 0.32) * 255;
    const offset = index * 4;
    image.data[offset] = grey;
    image.data[offset + 1] = grey;
    image.data[offset + 2] = grey;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  paintRockChips(context, size, rng);

  const repeat = THREE.RepeatWrapping;
  return {
    map: texture(canvas, THREE.SRGBColorSpace, anisotropy, repeat, repeat),
    normalMap: texture(normalsFromHeight(canvas, 1.6, 1.8), THREE.NoColorSpace, anisotropy, repeat, repeat),
  };
}
