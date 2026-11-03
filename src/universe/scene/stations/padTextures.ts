import * as THREE from 'three';
import { createRng } from '@/lib/rng';
import { COLORS } from '../palette';

/**
 * Canvas textures for a station pad, drawn once on first use.
 *
 * Everything starts from one greyscale relief drawing. The normal map is derived
 * from it, and the colour and roughness follow it, so a groove reads as a groove
 * in every channel at once. The glowing marks are a separate texture in the
 * shader's overlay, because they are tinted and turned per pad.
 */

export interface PadTextures {
  color: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  /** R: outer tick ring. G: inner segmented ring. B: fixed fine lines and chevrons. */
  marks: THREE.CanvasTexture;
}

const SURFACE_SIZE = 1024;
const MARKS_SIZE = 1024;
const TAU = Math.PI * 2;

function createCanvas(size: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable');
  return { canvas, context };
}

function grey(level: number): string {
  const value = Math.round(level);
  return `rgb(${value},${value},${value})`;
}

function fillRing(g: CanvasRenderingContext2D, inner: number, outer: number, style: string) {
  const centre = g.canvas.width / 2;
  g.fillStyle = style;
  g.beginPath();
  g.arc(centre, centre, outer * centre, 0, TAU);
  g.arc(centre, centre, inner * centre, 0, TAU, true);
  g.fill();
}

function strokeCircle(g: CanvasRenderingContext2D, radius: number, width: number, style: string) {
  const centre = g.canvas.width / 2;
  g.strokeStyle = style;
  g.lineWidth = width;
  g.beginPath();
  g.arc(centre, centre, radius * centre, 0, TAU);
  g.stroke();
}

/** Runs `draw` once per step, with the origin at the pad's centre, rotated by the step. */
function aroundPad(
  g: CanvasRenderingContext2D,
  steps: number,
  draw: (step: number, unit: number) => void,
) {
  const centre = g.canvas.width / 2;
  for (let step = 0; step < steps; step += 1) {
    g.save();
    g.translate(centre, centre);
    g.rotate((step / steps) * TAU);
    draw(step, centre);
    g.restore();
  }
}

function drawBolt(g: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const dome = g.createRadialGradient(x, y, 0, x, y, radius);
  dome.addColorStop(0, grey(235));
  dome.addColorStop(0.7, grey(200));
  dome.addColorStop(1, grey(110));
  g.fillStyle = dome;
  g.beginPath();
  g.arc(x, y, radius, 0, TAU);
  g.fill();
}

/** Height: black is deep, white is proud. Radii are fractions of the pad's radius. */
function drawRelief(g: CanvasRenderingContext2D) {
  const size = g.canvas.width;
  g.fillStyle = grey(150);
  g.fillRect(0, 0, size, size);

  /* Outer bezel with a bolted lip. */
  fillRing(g, 0.93, 1.01, grey(205));
  strokeCircle(g, 0.965, 3, grey(170));
  aroundPad(g, 16, (_, unit) => drawBolt(g, 0, -0.965 * unit, 0.0125 * unit));

  /* The recessed channels that carry the glowing rings. */
  fillRing(g, 0.86, 0.93, grey(72));
  fillRing(g, 0.56, 0.62, grey(72));

  /* Main plate: twelve panels separated by seams, each with a vent. */
  fillRing(g, 0.62, 0.86, grey(160));
  aroundPad(g, 12, (_, unit) => {
    g.fillStyle = grey(50);
    g.fillRect(-0.0035 * unit, -0.862 * unit, 0.007 * unit, 0.244 * unit);
  });
  aroundPad(g, 12, (_, unit) => {
    g.rotate(Math.PI / 12);
    for (let slot = 0; slot < 5; slot += 1) {
      g.fillStyle = grey(84);
      g.fillRect((slot - 2) * 0.026 * unit - 0.0075 * unit, -0.8 * unit, 0.015 * unit, 0.12 * unit);
    }
  });

  /* Turned centre plate: fine lathe rings, a raised collar and a hub. */
  fillRing(g, 0, 0.56, grey(168));
  for (let ring = 0.08; ring < 0.54; ring += 0.0085) {
    strokeCircle(g, ring, 1, grey(ring % 0.03 < 0.0085 ? 148 : 158));
  }
  fillRing(g, 0.2, 0.235, grey(208));
  fillRing(g, 0, 0.075, grey(205));
  fillRing(g, 0.03, 0.04, grey(120));
  aroundPad(g, 6, (_, unit) => drawBolt(g, 0, -0.33 * unit, 0.011 * unit));
}

/** Softens the relief a touch, so that the normal map gets a chamfer and not a cliff. */
function softened(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, context } = createCanvas(source.width);
  context.filter = 'blur(1.4px)';
  context.drawImage(source, 0, 0);
  return canvas;
}

function drawColor(g: CanvasRenderingContext2D, relief: HTMLCanvasElement) {
  const size = g.canvas.width;
  g.fillStyle = COLORS.metalDark;
  g.fillRect(0, 0, size, size);

  /* Faint circular brushing, which is what makes a turned part look turned. */
  const rng = createRng(7741);
  const centre = size / 2;
  for (let stroke = 0; stroke < 900; stroke += 1) {
    const radius = rng() * centre;
    const start = rng() * TAU;
    const shade = rng() > 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${shade},${shade},${shade},${0.015 + rng() * 0.03})`;
    g.lineWidth = 1 + rng() * 1.5;
    g.beginPath();
    g.arc(centre, centre, radius, start, start + 0.3 + rng() * 1.6);
    g.stroke();
  }

  /* Darken the low ground: `multiply` by the relief lifted so that only grooves bite. */
  g.globalCompositeOperation = 'multiply';
  g.filter = 'brightness(1.75)';
  g.drawImage(relief, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
}

function drawRoughness(g: CanvasRenderingContext2D, relief: HTMLCanvasElement) {
  const size = g.canvas.width;
  g.drawImage(relief, 0, 0);
  /* Proud metal is polished by wear; recesses stay rough. Green is what three reads. */
  g.globalCompositeOperation = 'difference';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(196,196,196,0.72)';
  g.fillRect(0, 0, size, size);
}

/** Tangent-space normals from height by central differences. */
function drawNormals(g: CanvasRenderingContext2D, relief: HTMLCanvasElement) {
  const size = g.canvas.width;
  const reliefContext = relief.getContext('2d');
  if (!reliefContext) throw new Error('2D canvas is unavailable');
  const height = reliefContext.getImageData(0, 0, size, size).data;
  const output = g.createImageData(size, size);
  const strength = 2.2 / 255;

  const at = (x: number, y: number): number => {
    const clampedX = x < 0 ? 0 : x >= size ? size - 1 : x;
    const clampedY = y < 0 ? 0 : y >= size ? size - 1 : y;
    return height[(clampedY * size + clampedX) * 4] as number;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const scale = 1 / Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      output.data[index] = (-dx * scale * 0.5 + 0.5) * 255;
      output.data[index + 1] = (-dy * scale * 0.5 + 0.5) * 255;
      output.data[index + 2] = (scale * 0.5 + 0.5) * 255;
      output.data[index + 3] = 255;
    }
  }

  g.putImageData(output, 0, 0);
}

function drawMarks(g: CanvasRenderingContext2D) {
  const size = g.canvas.width;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  /* `lighter` keeps the three colours as three independent channels. */
  g.globalCompositeOperation = 'lighter';

  /* Red: the ring of ticks that turns slowly, with three long arcs through it. */
  aroundPad(g, 120, (step, unit) => {
    const major = step % 10 === 0;
    const length = major ? 0.05 : 0.026;
    const width = major ? 0.0075 : 0.0042;
    g.fillStyle = '#f00';
    g.fillRect((-width / 2) * unit, -(0.895 + length / 2) * unit, width * unit, length * unit);
  });
  const centre = size / 2;
  for (let arc = 0; arc < 3; arc += 1) {
    const start = (arc / 3) * TAU;
    g.strokeStyle = '#f00';
    g.lineWidth = size * 0.0045;
    g.beginPath();
    g.arc(centre, centre, 0.925 * centre, start, start + TAU * 0.12);
    g.stroke();
    g.beginPath();
    g.arc(centre, centre, 0.867 * centre, start + TAU / 6, start + TAU * 0.26);
    g.stroke();
  }

  /* Green: the inner segmented ring, which turns the other way. */
  g.lineCap = 'butt';
  for (let segment = 0; segment < 6; segment += 1) {
    const start = (segment / 6) * TAU;
    g.strokeStyle = '#0f0';
    g.lineWidth = size * (segment % 2 === 0 ? 0.011 : 0.006);
    g.beginPath();
    g.arc(centre, centre, 0.59 * centre, start + 0.06, start + TAU / 6 - 0.06);
    g.stroke();
  }

  /* Blue: fine hairlines, and landing chevrons pointing at the centre. */
  for (const radius of [0.935, 0.855, 0.625, 0.555, 0.235, 0.2]) {
    g.strokeStyle = '#00f';
    g.lineWidth = size * 0.0022;
    g.beginPath();
    g.arc(centre, centre, radius * centre, 0, TAU);
    g.stroke();
  }
  aroundPad(g, 4, (_, unit) => {
    g.strokeStyle = '#00f';
    g.lineWidth = 0.011 * unit;
    g.lineJoin = 'miter';
    for (const reach of [0.43, 0.49]) {
      g.beginPath();
      g.moveTo(-0.055 * unit, -(reach + 0.04) * unit);
      g.lineTo(0, -reach * unit);
      g.lineTo(0.055 * unit, -(reach + 0.04) * unit);
      g.stroke();
    }
  });
}

function prepare(texture: THREE.CanvasTexture, colorSpace: THREE.ColorSpace) {
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

let textures: PadTextures | null = null;

export function getPadTextures(): PadTextures {
  if (textures) return textures;

  const relief = createCanvas(SURFACE_SIZE);
  drawRelief(relief.context);
  const soft = softened(relief.canvas);

  const color = createCanvas(SURFACE_SIZE);
  drawColor(color.context, soft);

  const roughness = createCanvas(SURFACE_SIZE);
  drawRoughness(roughness.context, soft);

  const normal = createCanvas(SURFACE_SIZE);
  drawNormals(normal.context, soft);

  const marks = createCanvas(MARKS_SIZE);
  drawMarks(marks.context);

  textures = {
    color: prepare(new THREE.CanvasTexture(color.canvas), THREE.SRGBColorSpace),
    normal: prepare(new THREE.CanvasTexture(normal.canvas), THREE.NoColorSpace),
    roughness: prepare(new THREE.CanvasTexture(roughness.canvas), THREE.NoColorSpace),
    marks: prepare(new THREE.CanvasTexture(marks.canvas), THREE.NoColorSpace),
  };

  return textures;
}
