'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { capabilityStrip, profile } from '@/data/profile';
import { islands } from '@/data/universe';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../../state/store';
import { islandCenter } from '../../../world/network';
import { COLORS, hdr } from '../../palette';
import {
  BeamBatch,
  bustPoint,
  circlePoint,
  createAtlas,
  createBodyMaterial,
  FACING,
  getBeamMaterial,
  getBustGeometry,
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
  paintLeds,
  paintRows,
  paintSpark,
  paintText,
  PoolBatch,
  ScreenBatch,
  TraceBatch,
  useHoloClock,
  type ArcPlane,
  type Region,
  type V3,
} from './holo';

/**
 * About: a holographic head and shoulders inside a globe of latitude lines, with
 * a low wall of consoles around the projector.
 *
 * The hologram turns to keep facing the visitor, and that is what makes it work
 * from everywhere: it is frontal at the opening shot, as the reference has it,
 * and it looks down at the robot walking past.
 */

/** The hologram's vertical axis on the deck. */
const AXIS: V3 = [0.8, 0, -0.8];
const GLOBE_Y = 10.9;
const GLOBE_RADIUS = 6.1;
/** The bust's base, below the centre of the globe. */
const BUST_DROP = 7;
const BUST_SCALE = 1.16;
/** The centre of the globe and its radius, in the bust's own units. The bust is cut to fit. */
const GLOBE_IN_BUST = new THREE.Vector4(
  0,
  BUST_DROP / BUST_SCALE,
  0,
  (GLOBE_RADIUS + 0.1) / BUST_SCALE,
);

/** The opening camera sits this far above level, seen from this island. */
const OPENING_PITCH = 0.42;
const OPENING_YAW = -0.22;
/** Limits on how far the hologram tips to look at the camera. */
const PITCH_DOWN = -0.26;
const PITCH_UP = 0.5;
/** Rate at which the hologram follows the camera, per second. */
const FOLLOW_RATE = 2.4;

const ATLAS_WIDTH = 1024;
const ATLAS_HEIGHT = 512;
const SCREEN_A: Region = [0, 0, 340, 200];
const SCREEN_B: Region = [344, 0, 340, 200];
const SCREEN_C: Region = [688, 0, 336, 200];
const LED_PANEL: Region = [0, 208, 256, 150];
const STIPPLE: Region = [512, 208, 300, 300];
const LAMP_COLORS = ['#58b8ff', '#58b8ff', '#58b8ff', '#a6e6ff', '#8a7cff'];

/* ──────────────────────────────── Atlas ─────────────────────────────────── */

function paintConsoleScreens(context: CanvasRenderingContext2D): void {
  const rng = createRng(0xab07);

  const [ax, ay, aw, ah] = SCREEN_A;
  context.fillStyle = 'rgba(14,44,120,0.7)';
  context.fillRect(ax, ay, aw, ah);
  paintText(context, profile.name.toUpperCase(), ax + 18, ay + 52, {
    size: 42,
    color: '#dcefff',
    glow: 10,
  });
  paintText(context, profile.role, ax + 18, ay + 84, { size: 18, color: '#8fc6ff' });
  paintRows(context, [ax + 18, ay + 104, aw - 40, 78], 7, '#5ea8ff', rng);

  const [bx, by, bw, bh] = SCREEN_B;
  context.fillStyle = 'rgba(16,36,110,0.7)';
  context.fillRect(bx, by, bw, bh);
  capabilityStrip.slice(0, 8).forEach((skill, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = bx + 18 + column * 160;
    const y = by + 40 + row * 44;
    paintText(context, skill, x, y, { size: 19, color: '#c8e4ff', font: HOLO_MONO });
    context.fillStyle = column === 0 ? '#58d8ff' : '#7f8cff';
    context.fillRect(x, y + 8, rngBetween(rng, 60, 136), 5);
  });

  const [cx, cy, cw, ch] = SCREEN_C;
  context.fillStyle = 'rgba(12,40,116,0.7)';
  context.fillRect(cx, cy, cw, ch);
  paintSpark(context, [cx + 16, cy + 20, cw - 32, 92], makeSeries(31, 36), '#58d8ff');
  paintBars(context, [cx + 16, cy + 124, cw - 32, 60], makeSeries(32, 30), '#3f9dff', 4);
}

/** The faint speckle filling the globe, denser towards its centre. */
function paintStipple(context: CanvasRenderingContext2D): void {
  const [x, y, w, h] = STIPPLE;
  const rng = createRng(0x571);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fill = context.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  fill.addColorStop(0, 'rgba(40,96,220,0.55)');
  fill.addColorStop(0.7, 'rgba(26,70,190,0.24)');
  fill.addColorStop(1, 'rgba(26,70,190,0.42)');
  context.fillStyle = fill;
  context.fillRect(x, y, w, h);
  for (let i = 0; i < 3200; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * (w / 2);
    context.fillStyle = rng() < 0.82 ? '#7cc0ff' : '#c58bff';
    context.globalAlpha = rngBetween(rng, 0.15, 0.75);
    context.fillRect(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1.6, 1.6);
  }
  context.globalAlpha = 1;
}

const getAtlas = once(() =>
  createAtlas(ATLAS_WIDTH, ATLAS_HEIGHT, (context) => {
    paintConsoleScreens(context);
    paintLeds(context, LED_PANEL, 22, 9, LAMP_COLORS, createRng(0x1ed));
    paintStipple(context);
  }),
);

/* ────────────────────────────── Structure ───────────────────────────────── */

interface ConsoleBlock {
  from: number;
  to: number;
  height: number;
}

/** The console wall: bearings around the island's centre, 0 towards +Z, open at the front. */
const CONSOLE_BLOCKS: readonly ConsoleBlock[] = [
  { from: 36, to: 86, height: 3.1 },
  { from: 92, to: 148, height: 5 },
  { from: 154, to: 206, height: 6 },
  { from: 212, to: 268, height: 5 },
  { from: 274, to: 324, height: 3.1 },
];
const WALL_OUTER = 8.1;
const WALL_INNER = 5.95;
/** Bearing and height of the pillars. The tall pair are what show past the label plate. */
const UPRIGHTS: readonly (readonly [number, number])[] = [
  [33, 3.7],
  [327, 3.7],
  [89, 7],
  [271, 7],
];

function wallPoint(bearing: number, radius: number, y: number): V3 {
  const angle = THREE.MathUtils.degToRad(bearing);
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
}

function buildMetal(): THREE.BufferGeometry {
  const metal = new MetalBatch(0xab);

  for (const block of CONSOLE_BLOCKS) {
    const h = block.height;
    metal.revolve(
      [
        [WALL_OUTER, 0],
        [WALL_OUTER, h - 0.52],
        [WALL_OUTER - 0.2, h - 0.3],
        [WALL_OUTER - 0.52, h],
        [WALL_OUTER - 1.3, h],
        [WALL_OUTER - 1.5, h - 0.2],
        [WALL_INNER, h - 1.06],
        [WALL_INNER, 0],
      ],
      [0, 0, 0],
      { from: block.from, to: block.to, tone: 'dark', caps: true, segments: 14 },
    );

    /* A raised service housing on each block breaks up the top line. */
    const middle = (block.from + block.to) / 2;
    for (const offset of [-13, 13]) {
      const bearing = middle + offset;
      metal.box([2.1, 0.7, 1], wallPoint(bearing, WALL_OUTER - 0.74, h + 0.3), {
        yaw: THREE.MathUtils.degToRad(bearing),
        tone: 'mid',
        chamfer: 0.1,
      });
    }
  }

  /* Uprights at the ends of the wall, the reference's boxy pillars. */
  for (const [bearing, height] of UPRIGHTS) {
    metal.box([1.5, height, 1.5], wallPoint(bearing, 7.1, height / 2), {
      yaw: THREE.MathUtils.degToRad(bearing),
      tone: 'mid',
      chamfer: 0.14,
    });
    metal.box([1.1, 0.4, 1.1], wallPoint(bearing, 7.1, height + 0.2), {
      yaw: THREE.MathUtils.degToRad(bearing),
      tone: 'dark',
      chamfer: 0.08,
    });
  }

  /* The projector plinth. */
  metal.revolve(
    [
      [3.75, 0],
      [3.75, 0.5],
      [3.46, 0.72],
      [3.06, 0.76],
      [2.86, 2.26],
      [2.5, 2.72],
      [2.96, 2.96],
      [2.96, 3.3],
      [2.3, 3.5],
      [1.5, 3.54],
      [1.32, 3.42],
    ],
    AXIS,
    { tone: 'dark' },
  );
  for (let i = 0; i < 6; i += 1) {
    metal.prism(
      [
        [3.1, 0.74],
        [3.32, 1.2],
        [3.24, 2.3],
        [2.84, 2.72],
        [2.6, 2.7],
        [2.7, 0.74],
      ],
      0.3,
      AXIS,
      { yaw: (i / 6) * Math.PI * 2, tone: 'mid' },
    );
  }

  /* Cables from the wall into the plinth. */
  for (const bearing of [120, 180, 240]) {
    const angle = THREE.MathUtils.degToRad(bearing);
    const [x, , z] = wallPoint(bearing, WALL_INNER + 0.1, 0);
    metal.tube(
      [
        [x, 0.5, z],
        [x * 0.8, 0.14, z * 0.8],
        [AXIS[0] + Math.sin(angle) * 3.9, 0.14, AXIS[2] + Math.cos(angle) * 3.9],
        [AXIS[0] + Math.sin(angle) * 3.5, 0.5, AXIS[2] + Math.cos(angle) * 3.5],
      ],
      0.13,
    );
  }

  return metal.build();
}

function buildTraces(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const blue = { color: COLORS.blue, intensity: 2.4, width: 0.07 };
  const cyan = { color: COLORS.cyan, intensity: 2.6, width: 0.09 };

  for (const block of CONSOLE_BLOCKS) {
    const h = block.height;
    const from = block.from + 1.4;
    const to = block.to - 1.4;
    traces.arc([0, h + 0.02, 0], WALL_OUTER - 0.92, from, to, cyan);
    traces.arc([0, h - 0.66, 0], WALL_OUTER + 0.04, from, to, { ...blue, intensity: 1.8, width: 0.05 });
    traces.arc([0, 0.34, 0], WALL_OUTER + 0.04, from, to, { ...blue, intensity: 1.5, width: 0.05 });
  }

  /* The reference's hot light, on the wall's left shoulder and the tall pillars. */
  traces.arc([0, 5.04, 0], WALL_OUTER - 0.44, 216, 264, {
    color: '#bfe6ff',
    intensity: 3,
    width: 0.13,
  });
  for (const [bearing, height] of UPRIGHTS) {
    if (height < 5) continue;
    const yaw = THREE.MathUtils.degToRad(bearing);
    const across: V3 = [Math.cos(yaw) * 0.58, 0, -Math.sin(yaw) * 0.58];
    for (const [y, radius] of [
      [height + 0.24, 7.68],
      [height - 1.1, 7.87],
      [height - 2.4, 7.87],
    ] as const) {
      const [x, , z] = wallPoint(bearing, radius, y);
      traces.segment([x - across[0], y, z - across[2]], [x + across[0], y, z + across[2]], {
        color: '#9fdcff',
        intensity: y > height ? 3.2 : 2,
        width: 0.09,
      });
    }
  }

  /* The projector. */
  const [ax, , az] = AXIS;
  traces.ring([ax, 3.14, az], 3, { ...cyan, intensity: 3.2 });
  traces.ring([ax, 3.56, az], 1.5, { color: COLORS.cyan, intensity: 1.8, width: 0.1 });
  traces.ring([ax, 0.62, az], 3.64, { ...blue, intensity: 2.2 });
  traces.ring([ax, 0.06, az], 4.2, { ...blue, intensity: 1.5, width: 0.05 });
  traces.ring([ax, 0.06, az], 4.75, { ...blue, intensity: 1.1, width: 0.04 });
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    traces.segment(
      [ax + sin * 3.36, 1.2, az + cos * 3.36],
      [ax + sin * 3.28, 2.3, az + cos * 3.28],
      { ...cyan, intensity: 2.2, width: 0.05, flow: 0.4, dash: 2.2 },
    );
  }
  return traces.build();
}

/** Wall screens and the lit panels on the wall's outer faces. */
function buildScreens(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_WIDTH, ATLAS_HEIGHT);
  const frame = hdr(COLORS.cyan, 1.5);

  const desks: readonly [number, Region][] = [
    [62, SCREEN_C],
    [108, SCREEN_B],
    [134, SCREEN_A],
    [170, SCREEN_C],
    [190, SCREEN_A],
    [226, SCREEN_B],
    [252, SCREEN_C],
    [298, SCREEN_A],
  ];
  desks.forEach(([bearing, region], index) => {
    const block = CONSOLE_BLOCKS.find((entry) => bearing > entry.from && bearing < entry.to);
    const height = block?.height ?? 3;
    const yaw = THREE.MathUtils.degToRad(bearing) + Math.PI;
    screens.add({
      region,
      at: wallPoint(bearing, 6.52, height - 0.5),
      yaw,
      pitch: -0.86,
      width: 2.3,
      height: 1.32,
      frame,
      frameWidth: 0.025,
      corner: 0.06,
      gain: 1.2,
      phase: index * 0.17,
    });
  });

  /* Lit panels let into the outer face, each following the curve of the wall. */
  for (const block of CONSOLE_BLOCKS) {
    const middle = (block.from + block.to) / 2;
    for (const offset of [-13, 13]) {
      const bearing = middle + offset;
      screens.add({
        region: LED_PANEL,
        at: wallPoint(bearing, WALL_OUTER + 0.03, block.height * 0.44),
        yaw: THREE.MathUtils.degToRad(bearing),
        curve: -(WALL_OUTER + 0.03),
        width: 2.3,
        height: Math.min(1.5, block.height * 0.36),
        frame,
        frameWidth: 0.02,
        corner: 0.05,
        gain: 1.1,
        phase: bearing / 360,
      });
    }
  }
  return screens.build();
}

function buildBeams(): THREE.BufferGeometry {
  const beams = new BeamBatch();
  beams.add([AXIS[0], 3.5, AXIS[2]], 1.5, 3.8, 5.4, COLORS.blue, 0.55);
  beams.add([AXIS[0], 3.5, AXIS[2]], 1.2, 2.2, 3.2, COLORS.cyan, 0.5);
  return beams.build();
}

function buildPools(): THREE.BufferGeometry {
  const pools = new PoolBatch();
  pools.add([AXIS[0], 0.05, AXIS[2]], 7.6, COLORS.blue, 0.32);
  return pools.build();
}

function buildGlows(): THREE.BufferGeometry {
  const glows = new GlowBatch();
  const [ax, , az] = AXIS;
  glows.add([ax, 3.9, az], 2.7, COLORS.cyan, 0.42);
  glows.add([ax, 3.7, az], 1, COLORS.white, 0.7, { flare: 0.3 });
  const shoulder = THREE.MathUtils.degToRad(240);
  glows.add([Math.sin(shoulder) * 7.7, 5.1, Math.cos(shoulder) * 7.7], 1.7, COLORS.cyan, 0.42);
  for (const [bearing, height] of UPRIGHTS) {
    if (height >= 5) glows.add(wallPoint(bearing, 7.1, height + 0.5), 1.5, COLORS.cyan, 0.4);
  }
  return glows.build();
}

/** Parts that turn with the hologram, all centred on the middle of the globe. */
function buildGlobeLines(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const line = { color: COLORS.blue, intensity: 0.26, width: 0.024 };

  for (let latitude = -60; latitude <= 60; latitude += 20) {
    const angle = THREE.MathUtils.degToRad(latitude);
    traces.ring([0, Math.sin(angle) * GLOBE_RADIUS, 0], Math.cos(angle) * GLOBE_RADIUS, line);
  }
  for (let longitude = 0; longitude < 180; longitude += 45) {
    const angle = THREE.MathUtils.degToRad(longitude);
    const plane: ArcPlane = { u: [Math.sin(angle), 0, Math.cos(angle)], v: [0, 1, 0] };
    traces.arc([0, 0, 0], GLOBE_RADIUS, 0, 360, line, plane);
  }
  return traces.build();
}

/** The halo around the globe: a thin ring, ticks, broken arcs and a horizontal sight line. */
function buildHalo(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const outer = GLOBE_RADIUS + 0.28;
  const center: V3 = [0, 0, 0];
  const bright = { color: '#9fd0ff', intensity: 1.5, width: 0.07 };
  const soft = { color: COLORS.blue, intensity: 1, width: 0.045 };

  traces.ring(center, outer, bright, FACING);
  traces.ring(center, GLOBE_RADIUS - 1.05, { ...soft, intensity: 0.9 }, FACING);
  traces.ticks(center, outer + 0.1, 0.16, 72, { ...soft, width: 0.03, intensity: 0.42 }, FACING);
  traces.arc(center, outer + 0.42, 34, 70, { ...bright, intensity: 0.9 }, FACING);
  traces.arc(center, outer + 0.42, 214, 256, { ...bright, intensity: 0.9 }, FACING);
  traces.arc(center, GLOBE_RADIUS - 1.05, 40, 70, { color: COLORS.magenta, intensity: 1.3, width: 0.06 }, FACING);

  const sight = { color: COLORS.cyan, intensity: 0.8, width: 0.03 };
  traces.segment([-outer, 0, 0], [-GLOBE_RADIUS + 0.9, 0, 0], sight);
  traces.segment([GLOBE_RADIUS - 0.9, 0, 0], [outer, 0, 0], sight);
  traces.segment([0, outer, 0], [0, GLOBE_RADIUS - 0.9, 0], sight);
  return traces.build();
}

function buildHaloGlows(): THREE.BufferGeometry {
  const glows = new GlowBatch();
  const outer = GLOBE_RADIUS + 0.28;
  const flare = { flare: 0.6 };
  glows.add(circlePoint([0, 0, 0], outer, 180, FACING).toArray(), 1.05, '#9fd8ff', 0.72, flare);
  glows.add(circlePoint([0, 0, 0], outer, 0, FACING).toArray(), 1.05, '#9fd8ff', 0.8, flare);
  glows.add(circlePoint([0, 0, 0], outer, 90, FACING).toArray(), 0.6, '#9fd8ff', 0.5, flare);
  glows.add(circlePoint([0, 0, 0], outer, 53, FACING).toArray(), 0.5, COLORS.magenta, 0.42);
  return glows.build();
}

/** Fades a point on the bust into the projector's light, and at the edge of the globe. */
function bustFade(point: THREE.Vector3): number {
  const reach = Math.hypot(point.x, point.y - GLOBE_IN_BUST.y, point.z);
  const inside = 1 - THREE.MathUtils.smoothstep(reach, GLOBE_IN_BUST.w - 0.9, GLOBE_IN_BUST.w);
  return THREE.MathUtils.smoothstep(point.y, 0.3, 2.2) * inside;
}

/**
 * A true wireframe, following the surface. The brow, nose and chin are too shallow
 * for the limb glow to show from the front, but they bend these lines.
 */
function buildBustWire(): THREE.BufferGeometry {
  const traces = new TraceBatch();
  const wire = { color: '#6fb6ff', intensity: 0.26, width: 0.02, shade: bustFade };
  const point = () => new THREE.Vector3();

  for (let loop = 1; loop < 34; loop += 1) {
    const along = loop / 34;
    const points = Array.from({ length: 72 }, (_, step) =>
      bustPoint(along, (step / 72) * Math.PI * 2 - Math.PI, point()),
    );
    traces.line(points, wire, true);
  }
  for (let meridian = 0; meridian < 22; meridian += 1) {
    const theta = (meridian / 22) * Math.PI * 2 - Math.PI;
    const points = Array.from({ length: 80 }, (_, step) => bustPoint(step / 79, theta, point()));
    traces.line(points, wire);
  }

  /* The neckline, the one detail that says "person" rather than "mannequin". */
  const collar = {
    color: COLORS.magenta,
    intensity: 1.1,
    width: 0.05,
    shade: bustFade,
  };
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 28 }, (_, step) => {
      const t = step / 27;
      return bustPoint(
        THREE.MathUtils.lerp(0.3, 0.07, t),
        side * THREE.MathUtils.lerp(0.92, 0.02, t),
        point(),
      );
    });
    traces.line(points, collar);
  }
  return traces.build();
}

/** A sparse dust on the surface, and the bright knot behind the face. */
function buildBustDust(): THREE.BufferGeometry {
  const rng = createRng(0xb057);
  const glows = new GlowBatch();
  const position = getBustGeometry().getAttribute('position');

  const point = new THREE.Vector3();
  for (let i = 0; i < 240; i += 1) {
    point.fromBufferAttribute(position, Math.floor(rng() * position.count));
    if (bustFade(point) < 0.5) continue;
    glows.add(
      point.toArray(),
      rngBetween(rng, 0.03, 0.07),
      COLORS.cyan,
      rngBetween(rng, 0.5, 1.3),
    );
  }

  for (let i = 0; i < 90; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng()) * 1.05;
    glows.add(
      [
        Math.cos(angle) * radius,
        6.5 + rngBetween(rng, -1, 1),
        Math.sin(angle) * radius * 0.7 + 0.5,
      ],
      rngBetween(rng, 0.06, 0.16),
      rng() < 0.64 ? COLORS.blue : COLORS.magenta,
      rngBetween(rng, 0.6, 1.3),
    );
  }
  glows.add([0, 6.5, 0.5], 1.6, COLORS.blue, 0.22);
  return glows.build();
}

function buildStippleDisc(): THREE.BufferGeometry {
  const screens = new ScreenBatch(ATLAS_WIDTH, ATLAS_HEIGHT);
  const diameter = (GLOBE_RADIUS - 1.05) * 2;
  screens.add({
    region: STIPPLE,
    at: [0, 0, -0.4],
    width: diameter,
    height: diameter,
    corner: diameter / 2,
    gain: 0.62,
  });
  return screens.build();
}

function buildParts() {
  return {
    metal: buildMetal(),
    traces: buildTraces(),
    screens: buildScreens(),
    beams: buildBeams(),
    pools: buildPools(),
    glows: buildGlows(),
    globeLines: buildGlobeLines(),
    halo: buildHalo(),
    haloGlows: buildHaloGlows(),
    bustWire: buildBustWire(),
    bustDust: buildBustDust(),
    stippleDisc: buildStippleDisc(),
    bustMaterial: createBodyMaterial({
      rim: hdr('#8cc8ff', 1.9),
      fill: hdr(COLORS.blue, 0.2),
      power: 3,
      lines: 0,
      body: 0.1,
      fadeFrom: 0.1,
      fadeTo: 2,
      sphere: GLOBE_IN_BUST,
    }),
  };
}

const getParts = once(buildParts);

/** Where the hologram turns about in the world, to aim it at the camera. */
const getGlobeOrigin = once(() => {
  const island = islands.find((entry) => entry.id === 'about');
  const center = island ? islandCenter(island) : { x: 0, z: 0 };
  return new THREE.Vector3(center.x + AXIS[0], GLOBE_Y, center.z + AXIS[2]);
});

export function AboutProps() {
  useHoloClock();
  const parts = getParts();
  const screenMaterial = getScreenMaterial(getAtlas());

  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);

  const hologram = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Group>(null);
  const pose = useRef({ yaw: OPENING_YAW, pitch: OPENING_PITCH });

  useFrame(({ camera, clock }, delta) => {
    const group = hologram.current;
    if (!group) return;

    if (!reducedMotion) {
      const origin = getGlobeOrigin();
      const dx = camera.position.x - origin.x;
      const dy = camera.position.y - origin.y;
      const dz = camera.position.z - origin.z;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const blend = 1 - Math.exp(-Math.min(delta, 0.1) * FOLLOW_RATE);
      const turn = Math.atan2(Math.sin(yaw - pose.current.yaw), Math.cos(yaw - pose.current.yaw));
      pose.current.yaw += turn * blend;
      pose.current.pitch += (THREE.MathUtils.clamp(pitch, PITCH_DOWN, PITCH_UP) - pose.current.pitch) * blend;
      if (globe.current) globe.current.rotation.y = clock.elapsedTime * 0.12;
    }

    group.rotation.set(-pose.current.pitch, pose.current.yaw, 0, 'YXZ');
  });

  return (
    <group>
      <mesh geometry={parts.metal} material={getPropMetal()} />
      <mesh geometry={parts.pools} material={getPoolMaterial()} />
      <mesh geometry={parts.traces} material={getTraceMaterial()} />
      <mesh geometry={parts.screens} material={screenMaterial} />
      <mesh geometry={parts.glows} material={getGlowMaterial()} />
      {quality !== 'low' ? <mesh geometry={parts.beams} material={getBeamMaterial()} /> : null}

      <group ref={hologram} position={[AXIS[0], GLOBE_Y, AXIS[2]]}>
        <mesh geometry={parts.stippleDisc} material={screenMaterial} />
        <group position={[0, -BUST_DROP, 0]} scale={BUST_SCALE}>
          <mesh geometry={getBustGeometry()} material={parts.bustMaterial} />
          <mesh geometry={parts.bustWire} material={getTraceMaterial()} />
          {quality !== 'low' ? <mesh geometry={parts.bustDust} material={getGlowMaterial()} /> : null}
        </group>
        <mesh geometry={parts.halo} material={getTraceMaterial()} />
        <mesh geometry={parts.haloGlows} material={getGlowMaterial()} />
        <group ref={globe}>
          <mesh geometry={parts.globeLines} material={getTraceMaterial()} />
        </group>
      </group>
    </group>
  );
}
