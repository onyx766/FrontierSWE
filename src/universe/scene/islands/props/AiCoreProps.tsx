'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { islands } from '@/data/universe';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../../state/store';
import { COLORS, hdr } from '../../palette';
import {
  BeamBatch,
  buildBustGeometry,
  createAtlas,
  createBodyMaterial,
  getBeamMaterial,
  getGlowMaterial,
  getPoolMaterial,
  getPropMetal,
  getScreenMaterial,
  getTraceMaterial,
  GlowBatch,
  HOLO_MONO,
  makeSeries,
  MetalBatch,
  once,
  paintBars,
  paintGrid,
  paintLeds,
  paintRows,
  paintSpark,
  paintText,
  PoolBatch,
  ScreenBatch,
  TraceBatch,
  useHoloClock,
  type Region,
  type V3,
} from './holo';

/**
 * AI Core: a holographic cube hovering over a pedestal, with analytics on a
 * floating screen to its left and a crystal hologram of a figure to its right.
 *
 * The composition is built from the opening shot backwards. The island's label
 * plate covers everything below about y = 5 at this far side of the world, so
 * the rings that lie on the deck in the reference are repeated as a holographic
 * disc at `RING_PLANE`, where they can be seen, and the cube sits high above it.
 */

const AXIS: V3 = [0, 0, -2];
const RING_PLANE = 7.2;
const CUBE_Y = 13;
const CUBE_EDGE = 5.6;
const CUBE_YAW = Math.PI / 4;

const SCREEN_AT: V3 = [-5.72, 9.9, 1.4];
const SCREEN_YAW = 0.36;
const CRYSTAL_AT: V3 = [5.64, 10.5, 0.6];
/** How much brighter the figure inside the crystal is than the crystal's own body. */
const FIGURE_GLOW = 0.45;
const FIGURE_SCALE = 0.33;
const FIGURE_Y = -1.5;

/** Lit panels on the faces of the machinery behind the pedestal. */
const MACHINE_PANELS: readonly { at: V3; yaw: number; phase: number }[] = [
  { at: [3.99, 2.2, -6.5], yaw: Math.PI - 0.5, phase: 0.1 },
  { at: [3.01, 2, -4.71], yaw: -0.5, phase: 0.3 },
  { at: [-3.98, 1.5, -6.69], yaw: Math.PI + 0.5, phase: 0.5 },
  { at: [-3.02, 1.5, -4.87], yaw: 0.5, phase: 0.7 },
];

/** The machinery's main housings: x, z, yaw, half width, half depth, height. */
const MACHINE_BOXES: readonly (readonly [number, number, number, number, number, number])[] = [
  [3.5, -5.6, -0.5, 1.5, 1, 3.6],
  [-3.5, -5.8, 0.5, 1.3, 1.05, 2.7],
];

const ATLAS_SIZE = 1024;
const ANALYTICS: Region = [0, 0, 512, 620];
const CUBE_FACE: Region = [512, 0, 512, 512];
const CUBE_TOP: Region = [512, 512, 256, 256];
const CHIP: Region = [768, 512, 256, 256];
const DISC: Region = [0, 640, 384, 384];
const CONSOLE: Region = [392, 776, 240, 124];
const LEDS: Region = [640, 776, 240, 124];

/* ──────────────────────────────── Atlas ─────────────────────────────────── */

function paintAnalytics(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = ANALYTICS;
  const island = islands.find((entry) => entry.id === 'ai-core');
  const rng = createRng(0xa1c04e);

  const glass = context.createLinearGradient(0, y, 0, y + h);
  glass.addColorStop(0, 'rgba(16,38,110,0.2)');
  glass.addColorStop(0.55, 'rgba(8,16,60,0.16)');
  glass.addColorStop(1, 'rgba(18,14,70,0.24)');
  context.fillStyle = glass;
  context.fillRect(x, y, w, h);
  paintGrid(context, [x, y, w, h], 32, 'rgba(90,150,255,0.09)');

  paintText(context, island?.label ?? '', x + 34, y + 84, {
    size: 62,
    color: '#dcefff',
    glow: 16,
  });
  paintText(context, island?.sublabel ?? '', x + 36, y + 124, {
    size: 26,
    color: '#7fb6ff',
    font: HOLO_MONO,
  });

  context.fillStyle = '#ffb35c';
  context.fillRect(x + 36, y + 146, 180, 5);
  context.fillStyle = 'rgba(88,216,255,0.8)';
  context.fillRect(x + 226, y + 146, 96, 5);

  island?.stations.forEach((station, index) => {
    const rowY = y + 198 + index * 36;
    context.fillStyle = index === 1 ? '#ffb35c' : '#58d8ff';
    context.fillRect(x + 38, rowY - 15, 14, 14);
    paintText(context, station.title, x + 64, rowY, { size: 24, color: '#cfe4ff' });
  });

  paintSpark(context, [x + 36, y + 318, w - 72, 86], makeSeries(11, 44), '#58d8ff');
  paintBars(context, [x + 36, y + 418, w - 72, 34], makeSeries(12, 34, 0.1, 1), '#8a5cff', 4);

  /* A cloud of embeddings: dense in the middle, in the reference's mixed colours. */
  const cloud: Region = [x + 30, y + 466, w - 60, h - 490];
  for (let i = 0; i < 1500; i += 1) {
    const spread = (rng() + rng() + rng()) / 3;
    const px = cloud[0] + spread * cloud[2];
    const py = cloud[1] + ((rng() + rng()) / 2) * cloud[3];
    const hue = rng();
    context.fillStyle = hue < 0.55 ? '#7cc4ff' : hue < 0.8 ? '#ffb35c' : '#c58bff';
    context.globalAlpha = rngBetween(rng, 0.45, 1);
    const size = rngBetween(rng, 1.4, 4);
    context.fillRect(px, py, size, size);
  }
  context.globalAlpha = 1;

  const halo = context.createRadialGradient(
    x + 110,
    y + 548,
    4,
    x + 110,
    y + 548,
    64,
  );
  halo.addColorStop(0, 'rgba(160,226,255,1)');
  halo.addColorStop(0.3, 'rgba(60,150,255,0.55)');
  halo.addColorStop(1, 'rgba(40,90,255,0)');
  context.fillStyle = halo;
  context.fillRect(x + 40, y + 478, 140, 140);
}

/** Orthogonal circuit traces, each running in from the rim and ending in a pad. */
function paintCircuit(
  context: CanvasRenderingContext2D,
  region: Region,
  count: number,
  color: string,
  rng: () => number,
): void {
  const [x, y, w, h] = region;
  const cx = x + w / 2;
  const cy = y + h / 2;
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 5;
  context.lineWidth = 2;
  for (let i = 0; i < count; i += 1) {
    const side = Math.floor(rng() * 4);
    const along = rngBetween(rng, 0.06, 0.94);
    const startX = side === 0 ? x + 6 : side === 1 ? x + w - 6 : x + along * w;
    const startY = side === 2 ? y + 6 : side === 3 ? y + h - 6 : y + along * h;
    const reach = rngBetween(rng, 0.22, 0.72);
    const midX = startX + (cx - startX) * reach * (side < 2 ? 1 : 0.15);
    const midY = startY + (cy - startY) * reach * (side < 2 ? 0.15 : 1);
    const endX = midX + (cx - midX) * 0.35;
    const endY = midY + (cy - midY) * 0.35;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(midX, midY);
    context.lineTo(endX, endY);
    context.stroke();
    context.beginPath();
    context.arc(endX, endY, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function paintCubeFace(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = CUBE_FACE;
  const rng = createRng(0xc0be);
  const body = context.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, 'rgba(14,36,170,0.34)');
  body.addColorStop(0.42, 'rgba(44,34,204,0.5)');
  body.addColorStop(0.72, 'rgba(116,52,252,0.9)');
  body.addColorStop(1, 'rgba(186,104,255,1)');
  context.fillStyle = body;
  context.fillRect(x, y, w, h);

  paintGrid(context, [x, y, w, h], 42, 'rgba(120,140,255,0.08)');
  paintCircuit(context, [x, y, w, h], 34, 'rgba(96,140,255,0.5)', rng);

  paintCubeGlyph(context, x + w * 0.52, y + h * 0.5);
}

/** Nodes of the graph on each cube face, as offsets from its centre in atlas pixels. */
const GLYPH_NODES: readonly (readonly [number, number, number])[] = [
  [-6, -8, 42],
  [-104, -96, 16],
  [62, -128, 22],
  [132, -36, 14],
  [106, 86, 20],
  [8, 134, 15],
  [-118, 70, 22],
  [-152, -18, 11],
];

const GLYPH_LINKS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 1],
];

/**
 * The form suspended in each face: a small neural graph. Its lopsidedness is on
 * purpose, because faces repeat, and a symmetric mark seen through the cube reads
 * as a row of characters.
 */
function paintCubeGlyph(context: CanvasRenderingContext2D, cx: number, cy: number): void {
  context.save();
  const halo = context.createRadialGradient(cx, cy, 8, cx, cy, 170);
  halo.addColorStop(0, 'rgba(100,180,255,0.5)');
  halo.addColorStop(0.5, 'rgba(60,110,255,0.16)');
  halo.addColorStop(1, 'rgba(50,60,255,0)');
  context.fillStyle = halo;
  context.fillRect(cx - 170, cy - 170, 340, 340);

  context.strokeStyle = '#74bcff';
  context.shadowColor = '#3f8cff';
  context.shadowBlur = 8;
  context.lineWidth = 4;
  for (const [from, to] of GLYPH_LINKS) {
    const a = GLYPH_NODES[from] as readonly [number, number, number];
    const b = GLYPH_NODES[to] as readonly [number, number, number];
    context.beginPath();
    context.moveTo(cx + a[0], cy + a[1]);
    context.lineTo(cx + b[0], cy + b[1]);
    context.stroke();
  }

  context.shadowBlur = 14;
  for (const [x, y, radius] of GLYPH_NODES) {
    context.fillStyle = '#9ad8ff';
    context.beginPath();
    context.arc(cx + x, cy + y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(12,20,90,0.9)';
    context.beginPath();
    context.arc(cx + x, cy + y, radius * 0.5, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function paintCubeTop(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = CUBE_TOP;
  const rng = createRng(0xc0bf);
  context.fillStyle = 'rgba(14,34,130,0.42)';
  context.fillRect(x, y, w, h);
  paintGrid(context, [x, y, w, h], 26, 'rgba(90,130,255,0.14)');
  paintCircuit(context, [x, y, w, h], 16, 'rgba(90,130,255,0.4)', rng);
}

function paintChip(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = CHIP;
  const rng = createRng(0xc41b);
  context.fillStyle = 'rgba(40,26,150,0.42)';
  context.fillRect(x, y, w, h);
  paintCircuit(context, [x, y, w, h], 22, 'rgba(100,150,255,0.55)', rng);

  context.save();
  context.fillStyle = 'rgba(10,14,60,0.9)';
  context.strokeStyle = '#a8dcff';
  context.shadowColor = '#5aa8ff';
  context.shadowBlur = 10;
  context.lineWidth = 4;
  context.fillRect(x + 82, y + 82, 92, 92);
  context.strokeRect(x + 82, y + 82, 92, 92);
  context.fillStyle = '#5aa8f0';
  context.fillRect(x + 104, y + 104, 48, 48);
  context.restore();
}

function paintDisc(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = DISC;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const glow = context.createRadialGradient(cx, cy, w * 0.06, cx, cy, w / 2);
  glow.addColorStop(0, 'rgba(180,120,255,0.9)');
  glow.addColorStop(0.28, 'rgba(120,70,255,0.42)');
  glow.addColorStop(0.72, 'rgba(70,60,220,0.16)');
  glow.addColorStop(1, 'rgba(50,50,200,0)');
  context.fillStyle = glow;
  context.fillRect(x, y, w, h);
}

function paintConsole(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = CONSOLE;
  const rng = createRng(0xc05);
  context.fillStyle = 'rgba(16,40,110,0.75)';
  context.fillRect(x, y, w, h);
  paintRows(context, [x + 14, y + 14, 90, h - 26], 7, '#7cc4ff', rng);
  paintBars(context, [x + 120, y + 16, w - 136, h - 32], makeSeries(21, 14), '#58d8ff', 3);
  paintLeds(context, LEDS, 20, 8, ['#58b8ff', '#58b8ff', '#a6e6ff', '#9d6dff'], rng);
}

const getAtlas = once(() =>
  createAtlas(ATLAS_SIZE, ATLAS_SIZE, (context) => {
    paintAnalytics(context);
    paintCubeFace(context);
    paintCubeTop(context);
    paintChip(context);
    paintDisc(context);
    paintConsole(context);
  }),
);

/* ────────────────────────────── Structure ───────────────────────────────── */

function buildMetal(): THREE.BufferGeometry {
  const metal = new MetalBatch(0xa1);

  /* The stepped dais and the spindle that rises out of it. */
  metal.revolve(
    [
      [6.05, 0],
      [6.05, 0.42],
      [5.82, 0.62],
      [4.72, 0.66],
      [4.72, 1.18],
      [4.46, 1.38],
      [3.36, 1.42],
      [3.36, 2.02],
      [3.1, 2.24],
      [2.22, 2.3],
    ],
    AXIS,
    { tone: 'dark' },
  );
  metal.revolve(
    [
      [2.22, 2.3],
      [1.7, 2.82],
      [1.3, 3.5],
      [1.1, 4.5],
      [1.06, 5.2],
      [1.3, 5.62],
      [1.86, 5.94],
      [2.44, 6.06],
      [2.44, 6.38],
      [2.1, 6.54],
      [1.16, 6.6],
      [0.98, 6.44],
    ],
    AXIS,
    { tone: 'mid' },
  );

  /* Buttresses between the dais and the head of the spindle. */
  for (let i = 0; i < 8; i += 1) {
    metal.prism(
      [
        [3.12, 2.26],
        [2.9, 2.74],
        [2.1, 3.7],
        [1.72, 4.7],
        [1.62, 5.5],
        [1.2, 5.5],
        [1.2, 2.26],
      ],
      0.24,
      AXIS,
      { yaw: (i / 8) * Math.PI * 2 + Math.PI / 8, tone: 'mid' },
    );
  }

  /* The console that feeds the analytics screen, with its mast. */
  metal.box([3.7, 1.0, 2.5], [SCREEN_AT[0], 0.5, SCREEN_AT[2]], {
    yaw: SCREEN_YAW,
    tone: 'dark',
    chamfer: 0.14,
  });
  metal.prism(
    [
      [-1, 0],
      [0.9, 0],
      [0.54, 0.74],
      [-1, 1.5],
    ],
    3.1,
    [SCREEN_AT[0], 1, SCREEN_AT[2] - 0.08],
    { yaw: SCREEN_YAW, tone: 'mid' },
  );
  metal.box([0.42, 6.6, 0.42], [SCREEN_AT[0] + 0.06, 3.3, SCREEN_AT[2] - 0.46], {
    yaw: SCREEN_YAW,
    tone: 'mid',
    chamfer: 0.05,
  });
  metal.box([1.5, 0.3, 0.6], [SCREEN_AT[0] + 0.06, 6.6, SCREEN_AT[2] - 0.42], {
    yaw: SCREEN_YAW,
    tone: 'light',
    chamfer: 0.06,
  });

  /* The crystal's projector. */
  metal.revolve(
    [
      [2.3, 0],
      [2.3, 0.5],
      [2.02, 0.72],
      [1.62, 0.78],
      [1.42, 2.6],
      [1.34, 3.7],
      [1.74, 4.1],
      [2.06, 4.2],
      [2.06, 4.5],
      [1.5, 4.66],
      [0.84, 4.68],
    ],
    [CRYSTAL_AT[0], 0, CRYSTAL_AT[2]],
    { tone: 'dark', segments: 48 },
  );

  /* Machinery behind the pedestal, tall enough to show past the label plate. */
  for (const [x, z, yaw, width, depth, height] of MACHINE_BOXES) {
    metal.box([width * 2, height, depth * 2], [x, height / 2, z], { yaw, tone: 'dark', chamfer: 0.16 });
  }
  metal.box([2.2, 1.3, 1.5], [3.72, 4.25, -5.74], { yaw: -0.5, tone: 'mid', chamfer: 0.12 });
  metal.box([1.5, 1.7, 1.2], [-3.3, 3.5, -5.9], { yaw: 0.5, tone: 'mid', chamfer: 0.12 });
  metal.box([0.3, 2.2, 0.3], [-4.0, 5.3, -5.5], { yaw: 0.5, tone: 'light', chamfer: 0.04 });
  metal.box([1.6, 1.1, 1.3], [0.2, 0.55, -7.4], { tone: 'dark' });

  /* Conduit from the machinery into the dais. */
  metal.tube(
    [
      [3.2, 0.14, -4.5],
      [3.1, 0.14, -3.2],
      [2.2, 0.8, -2.5],
    ],
    0.15,
  );
  metal.tube(
    [
      [-3.3, 0.14, -4.6],
      [-3.0, 0.14, -3.4],
      [-2.2, 0.8, -2.6],
    ],
    0.15,
  );
  metal.tube(
    [
      [SCREEN_AT[0] + 1.3, 0.14, SCREEN_AT[2]],
      [-3, 0.14, 1.2],
      [-2.2, 0.9, 0.2],
    ],
    0.13,
  );
  metal.tube(
    [
      [CRYSTAL_AT[0] - 2.1, 0.14, CRYSTAL_AT[2]],
      [3, 0.14, 1],
      [2.3, 0.9, 0.1],
    ],
    0.13,
  );

  return metal.build();
}

function buildTraces(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const violet = { color: COLORS.violet, intensity: 2.2, width: 0.09 };
  const blue = { color: COLORS.blue, intensity: 2.2, width: 0.07 };
  const [ax, , az] = AXIS;

  /* Concentric rings let into the deck and the tiers of the dais. */
  traces.ring([ax, 0.46, az], 6.08, { ...violet, width: 0.12 });
  traces.ring([ax, 1.22, az], 4.75, violet);
  traces.ring([ax, 2.06, az], 3.39, { ...violet, color: COLORS.magenta });
  traces.ring([ax, 6.3, az], 2.46, { color: '#a86bff', intensity: 2.8, width: 0.12 });
  traces.ring([ax, 6.56, az], 1.2, { color: '#d9c4ff', intensity: 3.4, width: 0.12 });

  /* Light running up each buttress. */
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    traces.line(
      [
        new THREE.Vector3(ax + sin * 3.14, 2.3, az + cos * 3.14),
        new THREE.Vector3(ax + sin * 2.92, 2.76, az + cos * 2.92),
        new THREE.Vector3(ax + sin * 2.12, 3.72, az + cos * 2.12),
        new THREE.Vector3(ax + sin * 1.74, 4.72, az + cos * 1.74),
        new THREE.Vector3(ax + sin * 1.64, 5.5, az + cos * 1.64),
      ],
      { color: COLORS.violet, intensity: 2.6, width: 0.05, flow: 0.3, dash: 3.6 },
    );
  }

  /* The beam's bright core. */
  traces.segment([ax, RING_PLANE - 0.5, az], [ax, CUBE_Y - CUBE_EDGE * 0.72, az], {
    color: '#e6d6ff',
    intensity: 3.2,
    width: 0.18,
  });
  traces.ring([ax, RING_PLANE + 1.4, az], 0.58, { color: COLORS.magenta, intensity: 5, width: 0.05 });
  traces.ring([ax, RING_PLANE + 0.7, az], 0.88, { color: COLORS.violet, intensity: 4, width: 0.05 });

  /* Light lines around the machinery, so that its dark sides still read as equipment. */
  for (const [x, z, yaw, width, depth, height] of MACHINE_BOXES) {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const corner = (u: number, v: number, y: number): V3 => [
      x + u * cos * width + v * sin * depth,
      y,
      z - u * sin * width + v * cos * depth,
    ];
    const outline = [corner(-1, 1, height), corner(1, 1, height), corner(1, -1, height), corner(-1, -1, height)];
    traces.line(outline.map((point) => new THREE.Vector3(...point)), { ...blue, intensity: 1.7 }, true);
    traces.segment(corner(1.02, 1.02, 0.3), corner(1.02, 1.02, height - 0.2), {
      color: COLORS.violet,
      intensity: 1.8,
      width: 0.05,
      flow: 0.4,
      dash: 2.4,
    });
    traces.segment(corner(-1.02, -1.02, 0.3), corner(-1.02, -1.02, height - 0.2), {
      color: COLORS.violet,
      intensity: 1.8,
      width: 0.05,
      flow: 0.4,
      dash: 2.4,
    });
  }

  /* The console's light line and the mast's. */
  const sin = Math.sin(SCREEN_YAW);
  const cos = Math.cos(SCREEN_YAW);
  const [sx, , sz] = SCREEN_AT;
  traces.segment(
    [sx - 1.8 * cos + 1.26 * sin, 0.9, sz + 1.8 * sin + 1.26 * cos],
    [sx + 1.8 * cos + 1.26 * sin, 0.9, sz - 1.8 * sin + 1.26 * cos],
    { ...blue, intensity: 5 },
  );
  traces.segment([sx + 0.2, 0.9, sz - 0.2], [sx + 0.2, 6.5, sz - 0.2], {
    color: COLORS.cyan,
    intensity: 2.8,
    width: 0.05,
    flow: 0.5,
    dash: 2.6,
  });

  /* The crystal projector's collar. */
  const [cx, , cz] = CRYSTAL_AT;
  traces.ring([cx, 4.34, cz], 2.08, { color: COLORS.violet, intensity: 2, width: 0.1 });
  traces.ring([cx, 0.6, cz], 2.26, { color: COLORS.violet, intensity: 1.6, width: 0.07 });
  traces.ring([cx, 4.7, cz], 0.86, { color: COLORS.violet, intensity: 2.4, width: 0.1 });

  /* Thin data links from the cube out to the screen and the crystal. */
  const link = (from: V3, via: V3, to: V3, color: string) =>
    traces.line(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...from),
        new THREE.Vector3(...via),
        new THREE.Vector3(...to),
      ).getPoints(24),
      { color, intensity: 3.4, width: 0.05, flow: 0.45, dash: 4 },
    );
  link([ax - 3.3, 12.2, az], [-4.6, 13.8, -1], [sx + 1.4, 12.2, sz - 0.5], COLORS.magenta);
  link([ax + 3.3, 12.4, az], [4.4, 14, -1], [cx - 0.8, 13.2, cz], COLORS.magenta);

  return traces.build();
}

/** Concentric rings of the holographic disc, centred on the local origin. */
function buildDiscTraces(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const hot = { color: '#a86bff', intensity: 2.2, width: 0.1 };
  const cool = { color: COLORS.violet, intensity: 2.4, width: 0.09 };
  const pale = { color: COLORS.blue, intensity: 1.8, width: 0.05 };

  traces.ring([0, 0, 0], 1.75, { ...hot, intensity: 3, width: 0.16 });
  for (const start of [0, 120, 240]) traces.arc([0, 0, 0], 2.7, start + 12, start + 104, cool);
  traces.ring([0, 0, 0], 3.5, hot);
  for (const start of [30, 210]) traces.arc([0, 0, 0], 4.3, start, start + 140, { ...cool, width: 0.12 });
  traces.ticks([0, 0, 0], 4.72, 0.22, 72, { ...pale, width: 0.04 });
  traces.ring([0, 0, 0], 5.2, { ...cool, intensity: 2.8, width: 0.1 });
  for (const start of [60, 240]) traces.arc([0, 0, 0], 5.72, start, start + 62, { ...hot, width: 0.14 });
  for (const start of [150, 330]) traces.arc([0, 0, 0], 5.72, start, start + 22, pale);
  return traces.build();
}

function buildScreens(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_SIZE, ATLAS_SIZE);
  screens.addTwoSided({
    region: ANALYTICS,
    at: SCREEN_AT,
    yaw: SCREEN_YAW,
    width: 4.7,
    height: 5.7,
    frame: hdr('#8fc4ff', 1.7),
    frameWidth: 0.05,
    gain: 0.95,
    bob: 0.1,
    phase: 0.13,
  });
  screens.addTwoSided({
    region: CONSOLE,
    at: [-6.9, 13.6, -1.4],
    yaw: SCREEN_YAW + 0.2,
    width: 2.3,
    height: 1.2,
    frame: hdr(COLORS.blue, 1.4),
    frameWidth: 0.035,
    corner: 0.1,
    gain: 1,
    bob: 0.14,
    phase: 0.62,
  });
  screens.add({
    region: CONSOLE,
    at: [SCREEN_AT[0] + 0.04, 1.94, SCREEN_AT[2] + 0.62],
    yaw: SCREEN_YAW,
    pitch: -0.74,
    width: 2.2,
    height: 1.1,
    frame: hdr(COLORS.blue, 2.4),
    frameWidth: 0.03,
    corner: 0.08,
    gain: 1.5,
  });
  for (const panel of MACHINE_PANELS) {
    screens.add({
      region: LEDS,
      width: 2,
      height: 1.5,
      corner: 0.06,
      frame: hdr(COLORS.blue, 1.1),
      frameWidth: 0.02,
      gain: 1.05,
      ...panel,
    });
  }
  screens.add({
    region: DISC,
    at: [AXIS[0], RING_PLANE, AXIS[2]],
    pitch: -Math.PI / 2,
    width: 12,
    height: 12,
    corner: 6,
    gain: 0.75,
  });
  return screens.build();
}

function buildCubeFaces(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_SIZE, ATLAS_SIZE);
  const half = CUBE_EDGE / 2;
  const frame = hdr('#6d96ff', 1.25);
  const face = {
    region: CUBE_FACE,
    width: CUBE_EDGE,
    height: CUBE_EDGE,
    corner: 0.05,
    frame,
    frameWidth: 0.05,
    gain: 0.86,
    back: 0.2,
  };
  screens.add({ ...face, at: [0, 0, half] });
  screens.add({ ...face, at: [half, 0, 0], yaw: Math.PI / 2, flip: true });
  screens.add({ ...face, at: [0, 0, -half], yaw: Math.PI, flip: true });
  screens.add({ ...face, at: [-half, 0, 0], yaw: -Math.PI / 2 });
  screens.add({ ...face, region: CUBE_TOP, at: [0, half, 0], pitch: -Math.PI / 2, gain: 0.55 });
  screens.add({ ...face, region: CUBE_TOP, at: [0, -half, 0], pitch: Math.PI / 2, gain: 1.1 });
  return screens.build();
}

function buildChip(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_SIZE, ATLAS_SIZE);
  const edge = 1.9;
  const half = edge / 2;
  const face = {
    region: CHIP,
    width: edge,
    height: edge,
    corner: 0.03,
    frame: hdr(COLORS.blue, 1),
    frameWidth: 0.03,
    gain: 0.75,
  };
  screens.add({ ...face, at: [0, 0, half] });
  screens.add({ ...face, at: [half, 0, 0], yaw: Math.PI / 2 });
  screens.add({ ...face, at: [0, 0, -half], yaw: Math.PI });
  screens.add({ ...face, at: [-half, 0, 0], yaw: -Math.PI / 2 });
  screens.add({ ...face, at: [0, half, 0], pitch: -Math.PI / 2 });
  screens.add({ ...face, at: [0, -half, 0], pitch: Math.PI / 2 });
  return screens.build();
}

function buildCubeGlows(): THREE.BufferGeometry {
  const glows = new GlowBatch();
  const half = CUBE_EDGE / 2;
  for (const x of [-half, half]) {
    for (const y of [-half, half]) {
      for (const z of [-half, half]) {
        glows.add([x, y, z], 0.5, '#c4d8ff', 0.6, { flare: 0.4 });
      }
    }
  }
  glows.add([0, -1.2, 0], 5.2, COLORS.violet, 0.09);
  return glows.build();
}

function buildGlows(): THREE.BufferGeometry {
  const rng = createRng(0xa16c);
  const glows = new GlowBatch();
  const [ax, , az] = AXIS;

  glows.add([ax, RING_PLANE + 0.1, az], 3, COLORS.violet, 0.5);
  glows.add([ax, RING_PLANE - 0.3, az], 1, '#e6d6ff', 0.7, { flare: 0.3 });
  glows.add([ax, CUBE_Y - CUBE_EDGE * 0.72, az], 1.2, COLORS.magenta, 0.6);
  glows.add([ax, 2.4, az], 4.5, COLORS.violet, 0.3);
  glows.add([CRYSTAL_AT[0], 5, CRYSTAL_AT[2]], 1.7, COLORS.magenta, 0.9);
  glows.add([SCREEN_AT[0] - 1.1, 8.2, SCREEN_AT[2] + 0.5], 1, COLORS.cyan, 0.6);

  /* Motes lifted by the beam. */
  for (let i = 0; i < 26; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = rngBetween(rng, 0.4, 5.4);
    glows.add(
      [ax + Math.sin(angle) * radius, RING_PLANE, az + Math.cos(angle) * radius],
      rngBetween(rng, 0.05, 0.11),
      rng() < 0.6 ? COLORS.violet : COLORS.cyan,
      2.4,
      { rise: rngBetween(rng, 3, 7), speed: rngBetween(rng, 0.05, 0.11), phase: rng() },
    );
  }
  return glows.build();
}

function buildBeams(): THREE.BufferGeometry {
  const beams = new BeamBatch();
  const [ax, , az] = AXIS;
  beams.add([ax, RING_PLANE - 0.5, az], 1.9, 0.9, 3.4, COLORS.violet, 0.8);
  beams.add([ax, RING_PLANE - 0.5, az], 1, 0.5, 3, COLORS.magenta, 0.5);
  beams.add([CRYSTAL_AT[0], 4.7, CRYSTAL_AT[2]], 1.05, 2.1, 3.6, COLORS.violet, 0.45);
  return beams.build();
}

function buildPools(): THREE.BufferGeometry {
  const pools = new PoolBatch();
  const y = 0.05;
  pools.add([AXIS[0], y, AXIS[2]], 9, COLORS.violet, 0.34);
  pools.add([SCREEN_AT[0], y, SCREEN_AT[2] + 0.8], 4.4, COLORS.blue, 0.26);
  pools.add([CRYSTAL_AT[0], y, CRYSTAL_AT[2]], 4.4, COLORS.violet, 0.3);
  return pools.build();
}

/** A faceted gem shaped like a shield, standing on its point. */
function buildCrystal(): { body: THREE.BufferGeometry; edges: THREE.BufferGeometry } {
  const rng = createRng(0xc2157);
  const sides = 7;
  const rows: readonly (readonly [number, number])[] = [
    [0.05, -3.5],
    [1.1, -2.3],
    [1.9, -0.7],
    [2.26, 0.75],
    [2.04, 2],
    [1.3, 2.9],
    [0.38, 3.4],
  ];

  const grid = rows.map(([radius, y], row) =>
    Array.from({ length: sides }, (_, side) => {
      const twist = row * 0.34;
      const angle = (side / sides) * Math.PI * 2 + twist;
      const jitter = row === 0 ? 1 : rngBetween(rng, 0.86, 1.1);
      return new THREE.Vector3(
        Math.sin(angle) * radius * jitter,
        y + rngBetween(rng, -0.12, 0.12),
        Math.cos(angle) * radius * jitter * 0.72,
      );
    }),
  );

  const crown = new THREE.Vector3(0, 3.62, 0);
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  for (let row = 0; row < grid.length - 1; row += 1) {
    const lower = grid[row] as THREE.Vector3[];
    const upper = grid[row + 1] as THREE.Vector3[];
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const a = lower[side] as THREE.Vector3;
      const b = lower[next] as THREE.Vector3;
      const c = upper[next] as THREE.Vector3;
      const d = upper[side] as THREE.Vector3;
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  const top = grid[grid.length - 1] as THREE.Vector3[];
  top.forEach((point, side) => triangle(point, top[(side + 1) % sides] as THREE.Vector3, crown));

  const gem = new THREE.BufferGeometry();
  gem.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  gem.computeVertexNormals();

  const traces = new TraceBatch();
  const edge = { color: '#b597ff', intensity: 0.42, width: 0.035 };
  grid.forEach((row) => traces.line(row, edge, true));
  for (let side = 0; side < sides; side += 1) {
    traces.line([...grid.map((row) => row[side] as THREE.Vector3), crown], edge);
  }

  return { body: figureInside(gem), edges: traces.build() };
}

/** Adds a small head and shoulders inside the crystal, sharing its draw call. */
function figureInside(gem: THREE.BufferGeometry): THREE.BufferGeometry {
  const figure = buildBustGeometry(30, 22).toNonIndexed();
  figure.scale(FIGURE_SCALE, FIGURE_SCALE, FIGURE_SCALE);
  figure.translate(0, FIGURE_Y, 0);

  const gemPosition = gem.getAttribute('position');
  const gemNormal = gem.getAttribute('normal');
  const figurePosition = figure.getAttribute('position');
  const figureNormal = figure.getAttribute('normal');
  const total = gemPosition.count + figurePosition.count;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const glow = new Float32Array(total);
  positions.set(gemPosition.array as Float32Array, 0);
  normals.set(gemNormal.array as Float32Array, 0);
  positions.set(figurePosition.array as Float32Array, gemPosition.count * 3);
  normals.set(figureNormal.array as Float32Array, gemPosition.count * 3);
  glow.fill(FIGURE_GLOW, gemPosition.count);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  merged.computeBoundingSphere();
  return merged;
}

function buildParts() {
  const crystal = buildCrystal();
  return {
    metal: buildMetal(),
    traces: buildTraces(),
    discTraces: buildDiscTraces(),
    screens: buildScreens(),
    cubeFaces: buildCubeFaces(),
    chip: buildChip(),
    cubeGlows: buildCubeGlows(),
    glows: buildGlows(),
    beams: buildBeams(),
    pools: buildPools(),
    crystalBody: crystal.body,
    crystalEdges: crystal.edges,
    crystalMaterial: createBodyMaterial({
      rim: hdr('#a874ff', 1.5),
      fill: hdr('#8a4cff', 0.3),
      power: 1.7,
      lines: 4,
      body: 0.12,
    }),
  };
}

const getParts = once(buildParts);

export function AiCoreProps() {
  useHoloClock();
  const parts = getParts();
  const screenMaterial = getScreenMaterial(getAtlas());

  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);

  const cube = useRef<THREE.Group>(null);
  const chip = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.elapsedTime;
    if (cube.current) {
      cube.current.rotation.y = CUBE_YAW + Math.sin(time * 0.21) * 0.13;
      cube.current.position.y = CUBE_Y + Math.sin(time * 0.62) * 0.14;
    }
    if (chip.current) {
      chip.current.rotation.y = time * -0.42;
      chip.current.rotation.x = Math.sin(time * 0.3) * 0.4;
    }
    if (disc.current) disc.current.rotation.y = time * 0.09;
    if (crystal.current) crystal.current.rotation.y = time * 0.2;
  });

  return (
    <group>
      <mesh geometry={parts.metal} material={getPropMetal()} />
      <mesh geometry={parts.pools} material={getPoolMaterial()} />
      <mesh geometry={parts.traces} material={getTraceMaterial()} />
      <mesh geometry={parts.screens} material={screenMaterial} />
      <mesh geometry={parts.glows} material={getGlowMaterial()} />
      {quality !== 'low' ? <mesh geometry={parts.beams} material={getBeamMaterial()} /> : null}

      <group ref={disc} position={[AXIS[0], RING_PLANE, AXIS[2]]}>
        <mesh geometry={parts.discTraces} material={getTraceMaterial()} />
      </group>

      <group ref={cube} position={[AXIS[0], CUBE_Y, AXIS[2]]} rotation={[0, CUBE_YAW, 0]}>
        <mesh geometry={parts.cubeFaces} material={screenMaterial} />
        <group ref={chip}>
          <mesh geometry={parts.chip} material={screenMaterial} />
        </group>
        {quality !== 'low' ? <mesh geometry={parts.cubeGlows} material={getGlowMaterial()} /> : null}
      </group>

      <group ref={crystal} position={CRYSTAL_AT}>
        <mesh geometry={parts.crystalBody} material={parts.crystalMaterial} />
        <mesh geometry={parts.crystalEdges} material={getTraceMaterial()} />
      </group>
    </group>
  );
}
