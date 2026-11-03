'use client';

import * as THREE from 'three';
import { projects } from '@/data/projects';
import { islands } from '@/data/universe';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../../state/store';
import { COLORS, hdr } from '../../palette';
import {
  BeamBatch,
  createAtlas,
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
 * Project Lab: a large curved dashboard with an angled screen at each side and a
 * bank of equipment beneath it. The panels turn towards the crystal, as in the
 * reference, so the island looks inward at the rest of the world.
 *
 * The screens show the site's real projects, from `src/data/projects.ts`. Their
 * charts are drawn from seeded noise and carry no numbers, so nothing on them
 * can be read as a measurement.
 */

const MAIN_AT: V3 = [-0.1, 10.5, -1.7];
const MAIN_YAW = 0.42;
const MAIN_WIDTH = 12.8;
const MAIN_HEIGHT = 8.4;
const MAIN_CURVE = 14;

const LEFT_AT: V3 = [-5.5, 4.7, 1.3];
const LEFT_YAW = 0.5;
const RIGHT_AT: V3 = [5.7, 5, 0.1];
const RIGHT_YAW = 0.28;
const SIDE_WIDTH = 5;
const SIDE_HEIGHT = 4.2;

const ATLAS_WIDTH = 2048;
const ATLAS_HEIGHT = 1024;
const DASHBOARD: Region = [0, 0, 1400, 922];
const LEFT_PANEL: Region = [1408, 0, 640, 500];
const RIGHT_PANEL: Region = [1408, 508, 640, 500];
const LED_COLUMN: Region = [0, 930, 512, 90];
const BANK_SCREEN: Region = [520, 930, 300, 90];
const LAMP_COLORS = ['#58b8ff', '#58b8ff', '#58b8ff', '#a68cff'];

/* ──────────────────────────────── Atlas ─────────────────────────────────── */

interface EmblemColors {
  rim: string;
  body: string;
  core: string;
  mesh: string;
}

/**
 * The glowing shape at the heart of each panel: a leaf-like form, part flame and
 * part anatomical scan, with a fine mesh inside it.
 */
function paintEmblem(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colors: EmblemColors,
): void {
  const outline = new Path2D();
  outline.moveTo(cx, cy - size);
  outline.bezierCurveTo(cx + size * 0.28, cy - size * 0.78, cx + size * 0.62, cy - size * 0.54, cx + size * 0.8, cy - size * 0.06);
  outline.bezierCurveTo(cx + size * 0.98, cy + size * 0.46, cx + size * 0.5, cy + size * 0.86, cx + size * 0.08, cy + size * 0.74);
  outline.bezierCurveTo(cx - size * 0.14, cy + size * 0.68, cx - size * 0.3, cy + size * 0.98, cx - size * 0.54, cy + size * 0.84);
  outline.bezierCurveTo(cx - size * 0.98, cy + size * 0.58, cx - size * 0.86, cy + size * 0.02, cx - size * 0.6, cy - size * 0.34);
  outline.bezierCurveTo(cx - size * 0.44, cy - size * 0.58, cx - size * 0.22, cy - size * 0.8, cx, cy - size);
  outline.closePath();

  context.save();
  const body = context.createRadialGradient(cx, cy + size * 0.1, size * 0.1, cx, cy, size * 1.05);
  body.addColorStop(0, colors.core);
  body.addColorStop(0.45, colors.body);
  body.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = body;
  context.fill(outline);

  context.clip(outline);
  context.strokeStyle = colors.mesh;
  context.lineWidth = 2;
  context.globalAlpha = 0.85;
  for (let i = -8; i <= 8; i += 1) {
    const offset = (i / 8) * size;
    context.beginPath();
    context.moveTo(cx + offset, cy - size);
    context.quadraticCurveTo(cx + offset * 0.2, cy, cx + offset * 1.1, cy + size);
    context.stroke();
    context.beginPath();
    context.moveTo(cx - size, cy + offset);
    context.quadraticCurveTo(cx, cy + offset * 0.3, cx + size, cy + offset * 0.9);
    context.stroke();
  }
  context.restore();

  context.save();
  context.strokeStyle = colors.rim;
  context.shadowColor = colors.rim;
  context.shadowBlur = 22;
  context.lineWidth = 7;
  context.stroke(outline);
  context.shadowBlur = 8;
  context.lineWidth = 2.5;
  context.stroke(outline);
  context.restore();
}

/** The hexagonal dot screen on the lower glass, lit from the pad beneath it. */
function paintDotScreen(context: CanvasRenderingContext2D, region: Region, color: string): void {
  const [x, y, w, h] = region;
  context.save();
  context.fillStyle = color;
  const pitch = 13;
  for (let row = 0; row * pitch * 0.86 < h; row += 1) {
    for (let column = 0; column * pitch < w; column += 1) {
      const fade = (row * pitch * 0.86) / h;
      context.globalAlpha = 0.08 + fade * 0.5;
      context.beginPath();
      context.arc(x + column * pitch + (row % 2) * pitch * 0.5, y + row * pitch * 0.86, 2.2, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function paintDashboard(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = DASHBOARD;
  const rng = createRng(0x1ab);
  const island = islands.find((entry) => entry.id === 'project-lab');
  const featured = projects.filter((project) => project.featured).slice(0, 5);

  const glass = context.createLinearGradient(0, y, 0, y + h);
  glass.addColorStop(0, 'rgba(16,40,136,0.44)');
  glass.addColorStop(0.62, 'rgba(22,34,136,0.44)');
  glass.addColorStop(1, 'rgba(84,48,206,0.66)');
  context.fillStyle = glass;
  context.fillRect(x, y, w, h);
  paintGrid(context, DASHBOARD, 46, 'rgba(110,130,255,0.07)');
  paintDotScreen(context, [x + 4, y + 640, w - 8, h - 650], '#9d78ff');

  /* Header. */
  paintText(context, island?.sublabel ?? '', x + 60, y + 104, {
    size: 74,
    color: '#dceaff',
    glow: 20,
  });
  paintText(context, (island?.label ?? '').toUpperCase(), x + 62, y + 148, {
    size: 30,
    color: '#7fc0ff',
    font: HOLO_MONO,
    tracking: 6,
  });
  context.fillStyle = 'rgba(88,216,255,0.75)';
  context.fillRect(x + 60, y + 170, 560, 3);
  context.fillStyle = 'rgba(138,92,255,0.8)';
  context.fillRect(x + w - 460, y + 170, 400, 3);

  /* The seam down the middle of the curved panel. */
  const seam = context.createLinearGradient(0, y, 0, y + h);
  seam.addColorStop(0, 'rgba(160,190,255,0.5)');
  seam.addColorStop(1, 'rgba(190,150,255,0.05)');
  context.fillStyle = seam;
  context.fillRect(x + w / 2 - 1.5, y + 8, 3, h - 16);

  /* Left column: the projects, with a build bar each. */
  featured.slice(0, 3).forEach((project, index) => {
    const rowY = y + 226 + index * 58;
    context.fillStyle = index === 0 ? '#58d8ff' : '#6a8cff';
    context.fillRect(x + 62, rowY - 17, 16, 16);
    paintText(context, project.name, x + 92, rowY, { size: 28, color: '#cfe4ff' });
    context.fillStyle = 'rgba(88,216,255,0.28)';
    context.fillRect(x + 92, rowY + 12, 410, 7);
    context.fillStyle = '#58d8ff';
    context.fillRect(x + 92, rowY + 12, rngBetween(rng, 220, 400), 7);
  });

  paintBars(context, [x + 62, y + 420, 200, 120], makeSeries(41, 11, 0.25, 1), '#37e0d8', 8);
  paintBars(context, [x + 288, y + 420, 214, 120], makeSeries(42, 11, 0.2, 1), '#58a8ff', 8);

  /* The pink outlined readout at the lower left. */
  context.save();
  context.strokeStyle = '#ff6fd8';
  context.shadowColor = '#ff6fd8';
  context.shadowBlur = 14;
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(x + 62, y + 584, 440, 150, 22);
  context.stroke();
  context.restore();
  const stack = featured[0]?.technologies ?? [];
  stack.slice(0, 2).forEach((technology, index) => {
    paintText(context, technology, x + 92, y + 644 + index * 58, {
      size: 40,
      color: '#ff9fe6',
      glow: 10,
    });
  });

  /* The emblem at the centre. */
  paintEmblem(context, x + 700, y + 400, 232, {
    rim: '#5cc0ff',
    body: 'rgba(40,104,255,0.72)',
    core: 'rgba(255,140,60,0.8)',
    mesh: 'rgba(120,190,255,0.6)',
  });

  /* Right column: stack rows in cyan, then magenta bars. */
  (featured[1]?.technologies ?? []).slice(0, 4).forEach((technology, index) => {
    const rowY = y + 240 + index * 50;
    paintText(context, technology, x + 950, rowY, {
      size: 30,
      color: '#7fe6ff',
      font: HOLO_MONO,
    });
    context.fillStyle = 'rgba(127,230,255,0.5)';
    context.fillRect(x + 950, rowY + 12, rngBetween(rng, 160, 380), 4);
  });
  for (let row = 0; row < 5; row += 1) {
    const rowY = y + 486 + row * 34;
    context.save();
    context.fillStyle = row % 2 === 0 ? '#ff5fd0' : '#c65cff';
    context.shadowColor = context.fillStyle;
    context.shadowBlur = 10;
    context.fillRect(x + 950, rowY, rngBetween(rng, 190, 390), 15);
    context.restore();
  }
  paintSpark(context, [x + 950, y + 668, 390, 90], makeSeries(43, 34), '#ffb35c');
  paintRows(context, [x + 60, y + 776, 440, 90], 5, 'rgba(180,170,255,0.6)', rng);
  paintRows(context, [x + 950, y + 790, 390, 80], 4, 'rgba(180,170,255,0.6)', rng);
}

interface SidePanelColors {
  glassTop: string;
  glassBottom: string;
  title: string;
  rows: string;
  emblem: EmblemColors;
}

const AMBER_PANEL: SidePanelColors = {
  glassTop: 'rgba(40,18,52,0.3)',
  glassBottom: 'rgba(90,40,22,0.42)',
  title: '#ffc070',
  rows: 'rgba(255,176,84,1)',
  emblem: {
    rim: '#ffb35c',
    body: 'rgba(255,130,50,0.7)',
    core: 'rgba(255,214,150,0.95)',
    mesh: 'rgba(120,50,30,0.5)',
  },
};

const VIOLET_PANEL: SidePanelColors = {
  glassTop: 'rgba(40,24,110,0.34)',
  glassBottom: 'rgba(58,30,130,0.42)',
  title: '#ffb86b',
  rows: 'rgba(214,150,255,0.85)',
  emblem: {
    rim: '#c58bff',
    body: 'rgba(140,84,255,0.7)',
    core: 'rgba(255,190,160,0.95)',
    mesh: 'rgba(220,190,255,0.6)',
  },
};

function paintSidePanel(
  context: CanvasRenderingContext2D,
  region: Region,
  title: string,
  colors: SidePanelColors,
  seed: number,
): void {
  const [x, y, w, h] = region;
  const rng = createRng(seed);

  const glass = context.createLinearGradient(0, y, 0, y + h);
  glass.addColorStop(0, colors.glassTop);
  glass.addColorStop(1, colors.glassBottom);
  context.fillStyle = glass;
  context.fillRect(x, y, w, h);
  paintGrid(context, region, 38, 'rgba(160,140,255,0.06)');

  paintText(context, title, x + 34, y + 62, { size: 40, color: colors.title, glow: 12 });
  context.fillStyle = colors.title;
  context.fillRect(x + 36, y + 78, 180, 3);

  paintEmblem(context, x + 196, y + 298, 142, colors.emblem);

  for (let row = 0; row < 4; row += 1) {
    const rowY = y + 134 + row * 62;
    context.fillStyle = colors.rows;
    context.fillRect(x + 372, rowY, rngBetween(rng, 130, 228), 16);
    paintRows(context, [x + 372, rowY + 26, 232, 26], 2, colors.rows, rng);
  }
  paintBars(context, [x + 372, y + 396, 232, 76], makeSeries(seed, 16, 0.2, 1), colors.title, 6);
}

function paintBankScreen(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = BANK_SCREEN;
  const rng = createRng(0xba4);
  context.fillStyle = 'rgba(20,28,110,0.8)';
  context.fillRect(x, y, w, h);
  paintRows(context, [x + 10, y + 12, 130, h - 22], 6, '#8fb4ff', rng);
  paintSpark(context, [x + 150, y + 10, w - 162, h - 22], makeSeries(44, 22), '#b48cff');
}

const getAtlas = once(() =>
  createAtlas(ATLAS_WIDTH, ATLAS_HEIGHT, (context) => {
    const stations = islands.find((entry) => entry.id === 'project-lab')?.stations ?? [];
    paintDashboard(context);
    paintSidePanel(context, LEFT_PANEL, stations[0]?.title ?? '', AMBER_PANEL, 0x1f7);
    paintSidePanel(context, RIGHT_PANEL, stations[1]?.title ?? '', VIOLET_PANEL, 0x719);
    paintLeds(context, LED_COLUMN, 40, 5, LAMP_COLORS, createRng(0x1ed2));
    paintBankScreen(context);
  }),
);

/* ────────────────────────────── Structure ───────────────────────────────── */

const BANK_INNER = 5.5;
const BANK_OUTER = 8.1;
/** The equipment bank around the back of the island: from and to bearings, and height. */
const BANK_BLOCKS: readonly (readonly [number, number, number])[] = [
  [118, 156, 2.3],
  [160, 200, 3],
  [204, 242, 2.3],
];

function bearingPoint(bearing: number, radius: number, y: number): V3 {
  const angle = THREE.MathUtils.degToRad(bearing);
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
}

function buildMetal(): THREE.BufferGeometry {
  const metal = new MetalBatch(0x1a);

  for (const [from, to, height] of BANK_BLOCKS) {
    metal.revolve(
      [
        [BANK_OUTER, 0],
        [BANK_OUTER, height - 0.4],
        [BANK_OUTER - 0.26, height - 0.2],
        [BANK_OUTER - 0.6, height],
        [BANK_OUTER - 1.3, height],
        [BANK_OUTER - 1.5, height - 0.16],
        [BANK_INNER, height - 0.9],
        [BANK_INNER, 0],
      ],
      [0, 0, 0],
      { from, to, tone: 'dark', caps: true, segments: 12 },
    );
    const middle = (from + to) / 2;
    metal.box([2.6, 0.56, 1.1], bearingPoint(middle, BANK_OUTER - 0.9, height + 0.26), {
      yaw: THREE.MathUtils.degToRad(middle),
      tone: 'mid',
      chamfer: 0.1,
    });
  }

  /* The dashboard's mast and the plinth it stands in. */
  const [mx, , mz] = MAIN_AT;
  metal.revolve(
    [
      [3.3, 0],
      [3.3, 0.34],
      [3.02, 0.52],
      [1.9, 0.56],
      [1.76, 1.3],
      [1.3, 1.66],
      [0.8, 1.76],
    ],
    [mx, 0, mz],
    { tone: 'dark', segments: 48 },
  );
  metal.box([0.8, 4.3, 0.56], [mx, 3.6, mz], { yaw: MAIN_YAW, tone: 'mid', chamfer: 0.08 });
  metal.box([3.6, 0.34, 0.5], [mx, 5.6, mz], { yaw: MAIN_YAW, tone: 'light', chamfer: 0.08 });

  /* The tall equipment case on the right, the reference's lit tower. */
  metal.box([2.3, 4.2, 2.1], [6.2, 2.1, 2.4], { yaw: 0.18, tone: 'dark', chamfer: 0.14 });
  metal.box([1.9, 0.4, 1.7], [6.2, 4.4, 2.4], { yaw: 0.18, tone: 'mid', chamfer: 0.08 });

  /* The left-hand desk, under its angled screen. */
  metal.box([3, 1, 2.4], [-5.9, 0.5, 2.2], { yaw: LEFT_YAW, tone: 'dark', chamfer: 0.14 });
  metal.prism(
    [
      [-1, 0],
      [0.86, 0],
      [0.5, 0.7],
      [-1, 1.3],
    ],
    2.5,
    [-5.9, 1, 2.1],
    { yaw: LEFT_YAW, tone: 'mid' },
  );

  /* A base unit under the right-hand screen. */
  metal.box([1.8, 2.2, 1.2], [RIGHT_AT[0], 1.1, RIGHT_AT[2] - 0.7], { yaw: RIGHT_YAW, tone: 'dark', chamfer: 0.12 });

  /* Conduit across the deck. */
  metal.tube(
    [
      [-4.2, 0.14, 1.8],
      [-3.2, 0.14, 0.6],
      [-2.9, 0.42, -0.6],
    ],
    0.13,
  );
  metal.tube(
    [
      [4.9, 0.14, 2],
      [3.4, 0.14, 0.4],
      [2.9, 0.42, -0.8],
    ],
    0.13,
  );
  for (const bearing of [150, 180, 210]) {
    const [x, , z] = bearingPoint(bearing, BANK_INNER + 0.05, 0);
    metal.tube(
      [
        [x, 0.5, z],
        [x * 0.9, 0.14, z * 0.9],
        [mx + (x - mx) * 0.66, 0.14, mz + (z - mz) * 0.66],
        [mx + (x - mx) * 0.5, 0.4, mz + (z - mz) * 0.5],
      ],
      0.12,
    );
  }

  return metal.build();
}

function buildTraces(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const blue = { color: COLORS.blue, intensity: 2.4, width: 0.07 };
  const violet = { color: COLORS.violet, intensity: 3, width: 0.09 };
  const [mx, , mz] = MAIN_AT;

  /* Rings around the mast's foot, lit violet from the dashboard above. */
  traces.ring([mx, 0.44, mz], 3.32, violet);
  traces.ring([mx, 0.06, mz], 3.86, { ...violet, intensity: 2, width: 0.06 });
  traces.ring([mx, 0.06, mz], 4.5, { ...violet, intensity: 1.3, width: 0.05 });
  traces.ring([mx, 1.5, mz], 1.8, { color: COLORS.magenta, intensity: 3, width: 0.07 });

  /* Light up the mast, feeding the panel. */
  traces.segment([mx, 1.7, mz + 0.3], [mx, 5.7, mz + 0.3], {
    color: COLORS.magenta,
    intensity: 3,
    width: 0.09,
    flow: 0.5,
    dash: 2.4,
  });

  /* The bank's top and foot lines. */
  for (const [from, to, height] of BANK_BLOCKS) {
    traces.arc([0, height + 0.02, 0], BANK_OUTER - 0.95, from + 1.6, to - 1.6, blue);
    traces.arc([0, 0.34, 0], BANK_OUTER + 0.04, from + 1.6, to - 1.6, { ...blue, intensity: 1.5, width: 0.05 });
  }

  /* The lit shoulder of the equipment case. */
  traces.segment([5.02, 4.22, 3.4], [7.26, 4.22, 3.0], { color: COLORS.cyan, intensity: 3.4, width: 0.1 });
  traces.segment([5.02, 0.32, 3.4], [7.26, 0.32, 3.0], { ...blue, intensity: 1.8 });

  /* The left desk's front edge. */
  const sin = Math.sin(LEFT_YAW);
  const cos = Math.cos(LEFT_YAW);
  traces.segment(
    [-5.9 - 1.46 * cos + 1.22 * sin, 0.88, 2.2 + 1.46 * sin + 1.22 * cos],
    [-5.9 + 1.46 * cos + 1.22 * sin, 0.88, 2.2 - 1.46 * sin + 1.22 * cos],
    { color: COLORS.orange, intensity: 3, width: 0.07 },
  );

  /* Thin data rails between the side screens and the dashboard. */
  const rail = { color: COLORS.violet, intensity: 2.2, width: 0.04, flow: 0.4, dash: 3 };
  traces.segment([LEFT_AT[0] + 1.6, 6.7, LEFT_AT[2] - 1], [-3.6, 7, -0.2], rail);
  traces.segment([RIGHT_AT[0] - 1.6, 7, RIGHT_AT[2]], [3.8, 7.3, -1.5], rail);

  return traces.build();
}

function buildScreens(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_WIDTH, ATLAS_HEIGHT);

  screens.addTwoSided({
    region: DASHBOARD,
    at: MAIN_AT,
    yaw: MAIN_YAW,
    curve: MAIN_CURVE,
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    frame: hdr('#7e9dff', 1.25),
    frameWidth: 0.045,
    corner: 0.3,
    gain: 1,
    bob: 0.08,
    phase: 0.31,
  });
  screens.addTwoSided({
    region: LEFT_PANEL,
    at: LEFT_AT,
    yaw: LEFT_YAW,
    width: SIDE_WIDTH,
    height: SIDE_HEIGHT,
    frame: hdr('#a673ff', 1.25),
    frameWidth: 0.045,
    gain: 1,
    bob: 0.1,
    phase: 0.57,
  });
  screens.addTwoSided({
    region: RIGHT_PANEL,
    at: RIGHT_AT,
    yaw: RIGHT_YAW,
    width: SIDE_WIDTH,
    height: SIDE_HEIGHT,
    frame: hdr('#a673ff', 1.25),
    frameWidth: 0.045,
    gain: 1,
    bob: 0.1,
    phase: 0.83,
  });

  /* Lit faces on the equipment. */
  screens.add({
    region: LED_COLUMN,
    at: [6.14, 2.5, 3.48],
    yaw: 0.18,
    width: 1.6,
    height: 2.2,
    corner: 0.06,
    frame: hdr(COLORS.blue, 1.2),
    frameWidth: 0.02,
    gain: 1.3,
  });
  screens.add({
    region: BANK_SCREEN,
    at: [-5.34, 1.74, 2.92],
    yaw: LEFT_YAW,
    pitch: -0.72,
    width: 2,
    height: 0.8,
    corner: 0.05,
    frame: hdr(COLORS.orange, 1.2),
    frameWidth: 0.02,
    gain: 1.2,
  });

  for (const [from, to, height] of BANK_BLOCKS) {
    const bearing = (from + to) / 2;
    screens.add({
      region: BANK_SCREEN,
      at: bearingPoint(bearing, 6.2, height - 0.54),
      yaw: THREE.MathUtils.degToRad(bearing) + Math.PI,
      pitch: -0.86,
      width: 2.4,
      height: 0.9,
      corner: 0.05,
      frame: hdr(COLORS.blue, 1.3),
      frameWidth: 0.02,
      gain: 1.1,
      phase: bearing / 360,
    });
    screens.add({
      region: LED_COLUMN,
      at: bearingPoint(bearing, BANK_OUTER + 0.03, height * 0.42),
      yaw: THREE.MathUtils.degToRad(bearing),
      curve: -(BANK_OUTER + 0.03),
      width: 3,
      height: height * 0.42,
      corner: 0.04,
      frame: hdr(COLORS.blue, 1.1),
      frameWidth: 0.02,
      gain: 1.1,
    });
  }
  return screens.build();
}

function buildBeams(): THREE.BufferGeometry {
  const beams = new BeamBatch();
  const [mx, , mz] = MAIN_AT;
  beams.add([mx, 0.5, mz], 3.1, 3.7, 6, COLORS.violet, 0.3);
  return beams.build();
}

function buildPools(): THREE.BufferGeometry {
  const pools = new PoolBatch();
  pools.add([MAIN_AT[0], 0.05, MAIN_AT[2]], 7.4, COLORS.violet, 0.36);
  pools.add([-5.4, 0.05, 3.6], 3.6, COLORS.orange, 0.2);
  pools.add([6, 0.05, 4.2], 3.6, COLORS.blue, 0.26);
  return pools.build();
}

function buildGlows(): THREE.BufferGeometry {
  const rng = createRng(0x1a9);
  const glows = new GlowBatch();
  const [mx, , mz] = MAIN_AT;

  glows.add([6.2, 4.4, 3.2], 1.7, COLORS.cyan, 0.4);
  glows.add([mx, 5.8, mz + 0.3], 1.2, COLORS.magenta, 0.45, { flare: 0.25 });
  glows.add([mx, 1.8, mz], 2.2, COLORS.violet, 0.4);

  /* Motes drifting up past the dashboard's face. */
  for (let i = 0; i < 22; i += 1) {
    glows.add(
      [mx + rngBetween(rng, -4.4, 4.4), 1, mz + rngBetween(rng, 0.8, 3.6)],
      rngBetween(rng, 0.05, 0.1),
      rng() < 0.6 ? COLORS.violet : COLORS.cyan,
      2,
      { rise: rngBetween(rng, 6, 10), speed: rngBetween(rng, 0.04, 0.09), phase: rng() },
    );
  }
  return glows.build();
}

function buildParts() {
  return {
    metal: buildMetal(),
    traces: buildTraces(),
    screens: buildScreens(),
    beams: buildBeams(),
    pools: buildPools(),
    glows: buildGlows(),
  };
}

const getParts = once(buildParts);

export function ProjectLabProps() {
  useHoloClock();
  const parts = getParts();
  const screenMaterial = getScreenMaterial(getAtlas());
  const quality = useUniverse((state) => state.quality);

  return (
    <group>
      <mesh geometry={parts.metal} material={getPropMetal()} />
      <mesh geometry={parts.pools} material={getPoolMaterial()} />
      <mesh geometry={parts.traces} material={getTraceMaterial()} />
      <mesh geometry={parts.screens} material={screenMaterial} />
      <mesh geometry={parts.glows} material={getGlowMaterial()} />
      {quality !== 'low' ? <mesh geometry={parts.beams} material={getBeamMaterial()} /> : null}
    </group>
  );
}
