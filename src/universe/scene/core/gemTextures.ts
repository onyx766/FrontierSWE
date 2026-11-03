import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';

/**
 * The crystal's baked textures. Nothing here runs per frame: each is drawn once,
 * and the shader only reads them, so the crystal can fill the screen cheaply.
 *
 * Both tile, and every facet samples its own patch of one continuous image. That
 * means facets never repeat each other and a parallax offset can slide freely
 * without ever running off the edge of something.
 */

/** World units covered by one tile of the crack texture. */
export const CRACK_TILE = 64;

const CRACK_SIZE = 2048;
const GROWTH_CELL = 4;
const GROWTH_STEP = 5;

interface Crack {
  points: { x: number; y: number }[];
  /** 0 for the first cracks, rising with each generation that branched off. */
  generation: number;
}

interface GrowthOptions {
  seed: number;
  seeds: number;
  limit: number;
  /** Longest crack, in steps. */
  reach: number;
  /** Random change of direction per step, in radians. */
  jitter: number;
}

/**
 * Grows a fracture pattern the way glass fractures: each crack runs until it hits
 * another, and new cracks start from a point on an old one, roughly at right
 * angles. This gives irregular closed cells with T-junctions, like the reference,
 * which random branching lines do not.
 */
function growCracks({ seed, seeds, limit, reach, jitter }: GrowthOptions): Crack[] {
  const random = createRng(seed);
  const grid = Math.floor(CRACK_SIZE / GROWTH_CELL);
  const owner = new Int32Array(grid * grid).fill(-1);
  const wrap = (value: number) => ((value % grid) + grid) % grid;
  const cellOf = (x: number, y: number) =>
    wrap(Math.floor(y / GROWTH_CELL)) * grid + wrap(Math.floor(x / GROWTH_CELL));

  const cracks: Crack[] = [];

  interface Tip {
    id: number;
    x: number;
    y: number;
    angle: number;
    curve: number;
    age: number;
  }
  const tips: Tip[] = [];

  const spawn = (x: number, y: number, angle: number, generation: number) => {
    if (cracks.length >= limit) return;
    const id = cracks.length;
    cracks.push({ points: [{ x, y }], generation });
    tips.push({ id, x, y, angle, curve: rngBetween(random, -0.005, 0.005), age: 0 });
  };

  for (let index = 0; index < seeds; index += 1) {
    spawn(
      random() * CRACK_SIZE,
      random() * CRACK_SIZE,
      random() * Math.PI * 2,
      0,
    );
  }

  const branch = () => {
    const parent = cracks[Math.floor(random() * cracks.length)];
    if (!parent || parent.points.length < 8) return;
    const index = 2 + Math.floor(random() * (parent.points.length - 4));
    const point = parent.points[index];
    const before = parent.points[index - 1];
    if (!point || !before) return;
    const along = Math.atan2(point.y - before.y, point.x - before.x);
    const side = random() < 0.5 ? -1 : 1;
    spawn(
      point.x,
      point.y,
      along + side * (Math.PI / 2 + rngBetween(random, -0.45, 0.45)),
      parent.generation + 1,
    );
  };

  while (tips.length > 0) {
    for (let index = tips.length - 1; index >= 0; index -= 1) {
      const tip = tips[index] as Tip;
      const crack = cracks[tip.id] as Crack;

      tip.angle += tip.curve + rngBetween(random, -jitter, jitter);
      /* Now and then a sharp kink, because fracture lines are not smooth. */
      if (random() < 0.05) tip.angle += rngBetween(random, -0.75, 0.75);
      tip.x += Math.cos(tip.angle) * GROWTH_STEP;
      tip.y += Math.sin(tip.angle) * GROWTH_STEP;
      tip.age += 1;

      const cell = cellOf(tip.x, tip.y);
      const hit = owner[cell] as number;
      const blocked = hit !== -1 && hit !== tip.id && tip.age > 3;

      crack.points.push({ x: tip.x, y: tip.y });
      owner[cell] = tip.id;

      if (blocked || tip.age >= reach) {
        tips.splice(index, 1);
        branch();
        if (random() < 0.6) branch();
      }
    }
  }

  return cracks;
}

/** Longest stroke drawn as one piece, in growth steps. */
const CHUNK = 9;
/** Margin past the tile's edge within which a stroke must also be drawn on the far side. */
const TILE_MARGIN = 40;

interface Stroke {
  points: { x: number; y: number }[];
  /** Fades towards the crack's ends and wanders along it. */
  strength: number;
}

/** Slow one-dimensional noise, to vary a crack along its length. */
function wander(random: () => number, count: number): (t: number) => number {
  const knots = Array.from({ length: count + 2 }, () => random());
  return (t) => {
    const position = t * count;
    const index = Math.floor(position);
    const fraction = position - index;
    const blend = fraction * fraction * (3 - 2 * fraction);
    const a = knots[index] as number;
    const b = knots[index + 1] as number;
    return a + (b - a) * blend;
  };
}

/**
 * Cuts a crack into short strokes, each with its own strength. A fracture is
 * brightest where it is widest open, tapers away to nothing at its ends and comes
 * and goes along its length; drawn at one strength it reads as a line of paint.
 */
function strokesOf(crack: Crack, random: () => number): Stroke[] {
  const strokes: Stroke[] = [];
  const last = crack.points.length - 1;
  if (last < 1) return strokes;

  const along = wander(random, Math.max(2, Math.round(last / 14)));

  for (let start = 0; start < last; start += CHUNK) {
    const end = Math.min(last, start + CHUNK);
    const t = (start + end) / 2 / last;
    const taper = Math.min(1, Math.min(t, 1 - t) * 7);
    strokes.push({
      points: crack.points.slice(start, end + 1),
      strength: taper * (0.22 + 0.78 * along(t) ** 1.5),
    });
  }
  return strokes;
}

function strokeOnTile(context: CanvasRenderingContext2D, stroke: Stroke) {
  const first = stroke.points[0];
  if (!first) return;

  /* Bring the stroke onto the tile, then repeat it on whichever sides it spills over. */
  const baseX = -Math.floor(first.x / CRACK_SIZE) * CRACK_SIZE;
  const baseY = -Math.floor(first.y / CRACK_SIZE) * CRACK_SIZE;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x + baseX);
    maxX = Math.max(maxX, point.x + baseX);
    minY = Math.min(minY, point.y + baseY);
    maxY = Math.max(maxY, point.y + baseY);
  }

  const shiftsX = [0];
  if (minX < TILE_MARGIN) shiftsX.push(CRACK_SIZE);
  if (maxX > CRACK_SIZE - TILE_MARGIN) shiftsX.push(-CRACK_SIZE);
  const shiftsY = [0];
  if (minY < TILE_MARGIN) shiftsY.push(CRACK_SIZE);
  if (maxY > CRACK_SIZE - TILE_MARGIN) shiftsY.push(-CRACK_SIZE);

  for (const shiftX of shiftsX) {
    for (const shiftY of shiftsY) {
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x + baseX + shiftX;
        const y = point.y + baseY + shiftY;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
  }
}

/**
 * Red holds the core of each crack with a soft cross-section, so the shader can
 * pull a thin hot filament from its centre up close. Green holds its wide glow and
 * blue a far finer network of hairlines, so that one texture gives three
 * independent layers to tint.
 */
export function bakeCrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CRACK_SIZE;
  canvas.height = CRACK_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  context.fillStyle = '#000';
  context.fillRect(0, 0, CRACK_SIZE, CRACK_SIZE);
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'butt';
  context.lineJoin = 'round';

  const random = createRng(2203);
  const cracks = growCracks({ seed: 41, seeds: 22, limit: 260, reach: 130, jitter: 0.04 });
  const hairlines = growCracks({ seed: 907, seeds: 40, limit: 900, reach: 42, jitter: 0.09 });

  /* Later generations are finer and fainter. */
  const weight = (generation: number) => (generation <= 1 ? 1 : generation === 2 ? 0.66 : 0.4);

  const strokes = cracks.flatMap((crack) =>
    strokesOf(crack, random).map((stroke) => ({ ...stroke, weight: weight(crack.generation) })),
  );

  const passes = [
    { channel: 'g', width: 62, alpha: 0.02 },
    { channel: 'g', width: 36, alpha: 0.04 },
    { channel: 'g', width: 19, alpha: 0.08 },
    { channel: 'g', width: 9, alpha: 0.16 },
    { channel: 'r', width: 7, alpha: 0.14 },
    { channel: 'r', width: 3.6, alpha: 0.32 },
    { channel: 'r', width: 1.7, alpha: 0.72 },
  ] as const;

  for (const pass of passes) {
    for (const stroke of strokes) {
      const alpha = pass.alpha * stroke.strength * (0.35 + 0.65 * stroke.weight);
      if (alpha < 0.004) continue;
      const value = `${Math.round(Math.min(1, alpha) * 255)}`;
      context.strokeStyle = pass.channel === 'r' ? `rgb(${value},0,0)` : `rgb(0,${value},0)`;
      context.lineWidth = pass.width * (pass.channel === 'r' ? 0.45 + 0.55 * stroke.weight : 1);
      strokeOnTile(context, stroke);
    }
  }

  context.strokeStyle = 'rgb(0,0,190)';
  context.lineWidth = 1.2;
  for (const crack of hairlines) {
    for (const stroke of strokesOf(crack, random)) strokeOnTile(context, stroke);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

const MARBLE_SIZE = 512;
const LATTICE = 256;

/**
 * Value noise whose lattice wraps at `frequency`, so that sums of octaves tile.
 * `frequency` must be a power of two.
 */
function latticeNoise(table: Float32Array, u: number, v: number, frequency: number, layer: number) {
  const x = u * frequency;
  const y = v * frequency;
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fx = x - cellX;
  const fy = y - cellY;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  const mask = frequency - 1;
  const left = (cellX & mask) + layer * 31;
  const right = ((cellX + 1) & mask) + layer * 31;
  const near = ((cellY & mask) + layer * 17) * LATTICE;
  const far = (((cellY + 1) & mask) + layer * 17) * LATTICE;
  const size = LATTICE * LATTICE - 1;

  const a = table[(near + left) & size] as number;
  const b = table[(near + right) & size] as number;
  const c = table[(far + left) & size] as number;
  const d = table[(far + right) & size] as number;

  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

function fbm(
  table: Float32Array,
  u: number,
  v: number,
  frequency: number,
  octaves: number,
  layer: number,
): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let current = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * latticeNoise(table, u, v, current, layer + octave);
    total += amplitude;
    amplitude *= 0.5;
    current *= 2;
  }
  return sum / total;
}

function smooth(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Red holds thin plasma filaments from ridged, domain-warped noise, green soft
 * cloud, and blue a large slow field used as a brightness mask.
 */
export function bakeMarbleTexture(): THREE.DataTexture {
  const random = createRng(1303);
  const table = new Float32Array(LATTICE * LATTICE);
  for (let index = 0; index < table.length; index += 1) table[index] = random();

  const data = new Uint8Array(MARBLE_SIZE * MARBLE_SIZE * 4);

  for (let row = 0; row < MARBLE_SIZE; row += 1) {
    const v = row / MARBLE_SIZE;
    for (let column = 0; column < MARBLE_SIZE; column += 1) {
      const u = column / MARBLE_SIZE;

      const warpU = fbm(table, u, v, 4, 3, 1) - 0.5;
      const warpV = fbm(table, u, v, 4, 3, 9) - 0.5;
      const warpedU = u + warpU * 0.42;
      const warpedV = v + warpV * 0.42;

      const field = fbm(table, warpedU, warpedV, 4, 5, 20);
      const ridge = 1 - Math.abs(field * 2 - 1);
      const filament = ridge ** 9;
      const cloud = smooth(0.32, 0.7, fbm(table, warpedU, warpedV, 4, 5, 40));
      const mask = fbm(table, u, v, 2, 3, 60);

      const offset = (row * MARBLE_SIZE + column) * 4;
      data[offset] = Math.round(filament * 255);
      data[offset + 1] = Math.round(cloud * 255);
      data[offset + 2] = Math.round(smooth(0.28, 0.72, mask) * 255);
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, MARBLE_SIZE, MARBLE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Small glow atlas for the crystal's billboards. Red is a soft round glow, green
 * a four-pointed lens sparkle.
 */
export function bakeGlintTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  context.fillStyle = '#000';
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = 'lighter';

  const center = size / 2;

  const round = context.createRadialGradient(center, center, 0, center, center, center);
  round.addColorStop(0, 'rgba(255,0,0,1)');
  round.addColorStop(0.1, 'rgba(255,0,0,0.62)');
  round.addColorStop(0.3, 'rgba(255,0,0,0.2)');
  round.addColorStop(0.62, 'rgba(255,0,0,0.05)');
  round.addColorStop(1, 'rgba(255,0,0,0)');
  context.fillStyle = round;
  context.fillRect(0, 0, size, size);

  const beam = (angle: number, length: number, width: number) => {
    context.save();
    context.translate(center, center);
    context.rotate(angle);
    const gradient = context.createLinearGradient(-length, 0, length, 0);
    gradient.addColorStop(0, 'rgba(0,255,0,0)');
    gradient.addColorStop(0.5, 'rgba(0,255,0,1)');
    gradient.addColorStop(1, 'rgba(0,255,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(-length, 0);
    context.quadraticCurveTo(0, -width, length, 0);
    context.quadraticCurveTo(0, width, -length, 0);
    context.fill();
    context.restore();
  };
  beam(0, center, 3.4);
  beam(Math.PI / 2, center, 3.4);
  beam(Math.PI / 4, center * 0.3, 1.6);
  beam(-Math.PI / 4, center * 0.3, 1.6);

  const heart = context.createRadialGradient(center, center, 0, center, center, 26);
  heart.addColorStop(0, 'rgba(0,255,0,1)');
  heart.addColorStop(0.3, 'rgba(0,255,0,0.5)');
  heart.addColorStop(1, 'rgba(0,255,0,0)');
  context.fillStyle = heart;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
