'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { createRng, rngBetween } from '@/lib/rng';
import { useUniverse } from '../../../state/store';
import { getKit } from '../../kit';
import { COLORS, hdr } from '../../palette';
import {
  canvasTexture,
  chamferedBox,
  extendEmissive,
  fitUv,
  getHardware,
  mergeParts,
  paintCanvas,
  pipe,
  placed,
  rackFaces,
  rackUv,
  revolve,
  surfaceStyle,
  vertexColor,
  type BoxFaces,
  type Profile,
} from './hardware';

/**
 * The Data Vault: database cylinders stacked in tiers, the visual anchor of the
 * bottom of the frame. Steel drums with blue rings left and right of a hot
 * orange one, a smaller unit behind that feeds the energy column, and control
 * boxes either side.
 *
 * The reference's drums stand further out than the loop road allows, so these
 * are taller and packed tighter: at the opening shot the plate hides their feet
 * and what remains is the same mass, in the same place.
 */

type DrumBody = 'steel' | 'hot';

interface Drum {
  x: number;
  z: number;
  radius: number;
  tiers: number;
  tierHeight: number;
  body: DrumBody;
  /** Multiplies the wall's albedo. */
  tint: string;
  ring: THREE.Color;
  halo: THREE.Color;
  /** Lid colours from hub to rim. The hub alone goes above 1, so it alone flares. */
  lid: readonly [THREE.Color, THREE.Color, THREE.Color];
  /** Sky caught on the far side of the lid, if any. */
  sheen?: THREE.Color;
  /** The pale bevel around the lid. */
  rim: THREE.Color;
}

const PLINTH_HEIGHT = 0.5;
const SEGMENTS = 72;

const BLUE_RING = hdr('#b7dcff', 5.6);
const BLUE_HALO = hdr(COLORS.blue, 0.44);
const HOT_RING = hdr('#ffcf9e', 9);
const HOT_HALO = hdr(COLORS.orange, 1.5);

const DRUMS: readonly Drum[] = [
  {
    x: -4.75,
    z: -1.5,
    radius: 3.1,
    tiers: 5,
    tierHeight: 2.5,
    body: 'steel',
    tint: '#9fb0d6',
    ring: BLUE_RING,
    halo: BLUE_HALO,
    lid: [hdr('#d6f0ff', 4), hdr('#8fa4ff', 1.04), hdr('#7a8cf6', 0.94)],
    rim: hdr('#9fb4ff', 0.62),
  },
  {
    x: 4.9,
    z: -1.5,
    radius: 2.95,
    tiers: 4,
    tierHeight: 2.65,
    body: 'steel',
    tint: '#9c92e0',
    ring: BLUE_RING,
    halo: hdr(COLORS.violet, 0.36),
    lid: [hdr('#e6f2ff', 4), hdr('#9e96ff', 1), hdr('#8074ee', 0.9)],
    rim: hdr('#ada4ff', 0.6),
  },
  {
    x: 0.1,
    z: 2.9,
    radius: 3.45,
    tiers: 5,
    tierHeight: 2.4,
    body: 'hot',
    tint: '#d9a15e',
    ring: HOT_RING,
    halo: HOT_HALO,
    lid: [hdr('#7cc8ff', 4), hdr('#ffd0bc', 1.2), hdr('#ffb49c', 1.06)],
    sheen: hdr('#b9a6e8', 0.9),
    rim: hdr('#ffd2b4', 0.72),
  },
  {
    x: 0.1,
    z: -5.3,
    radius: 2.5,
    tiers: 5,
    tierHeight: 2.24,
    body: 'hot',
    tint: '#b4ab9f',
    ring: HOT_RING,
    halo: HOT_HALO,
    lid: [hdr('#fff0dc', 6), hdr('#ffb46e', 1.7), hdr('#ff8a3c', 1.1)],
    rim: hdr('#ffb98a', 0.7),
  },
];

/** Lamps sit on the camera-right flank of each drum, as in the reference. */
const BADGE_ANGLE = 0.95;
const BADGE_LIGHT = hdr(COLORS.amber, 2.4);
/** A lamp's lens samples the steady middle of the ring texture, not its banded edges. */
const LENS_UV = { u0: 0, u1: 0, v0: 0.5, v1: 0.5 };

const WALL_WIDTH = 2048;
const WALL_HEIGHT = 256;
const WALL_LIP = 34;
const WALL_SEAMS = 8;
const WALL_HATCH_WIDTH = 150;

/** Pairs of fasteners along both lips, either side of each panel seam. */
function fastenerSpots(): (readonly [number, number])[] {
  const spots: (readonly [number, number])[] = [];
  for (let seam = 0; seam < WALL_SEAMS; seam += 1) {
    const x = (seam / WALL_SEAMS) * WALL_WIDTH;
    for (const y of [WALL_LIP * 0.25, WALL_HEIGHT - WALL_LIP * 0.25]) {
      spots.push([x - 34, y], [x + 34, y]);
    }
  }
  return spots;
}

/**
 * Fine heat slots around a hot drum. The spacing is about 0.7 of a texel at the mip
 * the opening shot samples: fine enough to average out into even light. Twice this
 * spacing beats against the mip chain and shows as bars.
 */
function forEachHeatSlot(draw: (x: number, top: number, height: number) => void) {
  const slots = 360;
  const top = WALL_LIP + 22;
  for (let slot = 0; slot < slots; slot += 1) {
    draw(((slot + 0.5) / slots) * WALL_WIDTH, top, WALL_HEIGHT - top * 2);
  }
}

/**
 * A wall tier, unrolled: `u` runs around the drum and `v` up one tier. Steel drums
 * carry panel seams and service hatches. The hot drums are clean barrels, because
 * any larger pattern shows through their glow as bands from the opening shot.
 */
function paintWallMaps(body: DrumBody) {
  const rng = createRng(0x7a017);
  const paneled = body === 'steel';
  const seamX = (seam: number) => (seam / WALL_SEAMS) * WALL_WIDTH;

  const albedo = paintCanvas(WALL_WIDTH, WALL_HEIGHT, (context) => {
    context.fillStyle = '#454d5c';
    context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

    /* Brushed around the drum, so highlights stretch the way real turned metal does. */
    for (let line = 0; line < 1500; line += 1) {
      context.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      context.fillRect(rng() * WALL_WIDTH, rng() * WALL_HEIGHT, 60 + rng() * 420, 1);
    }

    const soot = context.createLinearGradient(0, WALL_HEIGHT * 0.5, 0, WALL_HEIGHT);
    soot.addColorStop(0, 'rgba(10,12,18,0)');
    soot.addColorStop(1, 'rgba(10,12,18,0.45)');
    context.fillStyle = soot;
    context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

    context.fillStyle = '#6f7888';
    context.fillRect(0, 0, WALL_WIDTH, WALL_LIP);
    context.fillRect(0, WALL_HEIGHT - WALL_LIP, WALL_WIDTH, WALL_LIP);

    context.fillStyle = '#2b3039';
    context.fillRect(0, WALL_LIP * 0.5, WALL_WIDTH, 2);
    context.fillRect(0, WALL_HEIGHT - WALL_LIP * 0.5, WALL_WIDTH, 2);

    for (const [x, y] of fastenerSpots()) {
      context.fillStyle = '#1e2229';
      context.beginPath();
      context.arc(x, y, 4.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7d8696';
      context.beginPath();
      context.arc(x - 0.5, y - 0.5, 2.6, 0, Math.PI * 2);
      context.fill();
    }

    if (!paneled) return;

    for (let seam = 0; seam < WALL_SEAMS; seam += 1) {
      const x = seamX(seam);
      context.fillStyle = '#1a1d24';
      context.fillRect(x - 1.5, WALL_LIP, 3, WALL_HEIGHT - WALL_LIP * 2);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(x + 1.5, WALL_LIP, 1, WALL_HEIGHT - WALL_LIP * 2);
    }

    /* Service hatches, each with its own screws and data plate. */
    for (let hatch = 0; hatch < 4; hatch += 1) {
      const x = seamX(hatch * 2) + 64;
      const y = WALL_LIP + 22;
      const width = WALL_HATCH_WIDTH;
      const height = WALL_HEIGHT - (WALL_LIP + 22) * 2;
      context.fillStyle = '#343b48';
      context.fillRect(x, y, width, height);
      context.fillStyle = '#16191f';
      context.strokeStyle = '#16191f';
      context.lineWidth = 2;
      context.strokeRect(x, y, width, height);
      for (const [dotX, dotY] of [
        [x + 10, y + 10],
        [x + width - 10, y + 10],
        [x + 10, y + height - 10],
        [x + width - 10, y + height - 10],
      ] as const) {
        context.beginPath();
        context.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
        context.fill();
      }
      for (let row = 0; row < 5; row += 1) {
        context.fillRect(x + 22, y + 22 + row * 14, 40 + rng() * 70, 4);
      }
    }
  });

  const surface = paintCanvas(WALL_WIDTH / 2, WALL_HEIGHT / 2, (context) => {
    context.scale(0.5, 0.5);
    context.fillStyle = surfaceStyle(0.5, 0.24, 1);
    context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

    for (let line = 0; line < 500; line += 1) {
      context.fillStyle = surfaceStyle(rngBetween(rng, 0.46, 0.54), rngBetween(rng, 0.18, 0.34), 1);
      context.fillRect(rng() * WALL_WIDTH, rng() * WALL_HEIGHT, 80 + rng() * 420, 2);
    }

    context.fillStyle = surfaceStyle(0.74, 0.22, 1);
    context.fillRect(0, 0, WALL_WIDTH, WALL_LIP);
    context.fillRect(0, WALL_HEIGHT - WALL_LIP, WALL_WIDTH, WALL_LIP);

    context.fillStyle = surfaceStyle(0.3, 0.4, 1);
    context.fillRect(0, WALL_LIP * 0.5, WALL_WIDTH, 3);
    context.fillRect(0, WALL_HEIGHT - WALL_LIP * 0.5, WALL_WIDTH, 3);

    context.fillStyle = surfaceStyle(1, 0.3, 1);
    for (const [x, y] of fastenerSpots()) {
      context.beginPath();
      context.arc(x, y, 4.5, 0, Math.PI * 2);
      context.fill();
    }

    if (!paneled) {
      context.fillStyle = surfaceStyle(0.2, 0.5, 0.9);
      forEachHeatSlot((x, top, height) => context.fillRect(x - 1.5, top, 3, height));
      return;
    }

    context.fillStyle = surfaceStyle(0.08, 0.6, 0.8);
    for (let seam = 0; seam < WALL_SEAMS; seam += 1) {
      context.fillRect(seamX(seam) - 3, WALL_LIP, 6, WALL_HEIGHT - WALL_LIP * 2);
    }
    for (let hatch = 0; hatch < 4; hatch += 1) {
      context.fillStyle = surfaceStyle(0.66, 0.42, 0.9);
      context.fillRect(
        seamX(hatch * 2) + 64,
        WALL_LIP + 22,
        WALL_HATCH_WIDTH,
        WALL_HEIGHT - (WALL_LIP + 22) * 2,
      );
    }
  });

  /*
   * White, because each material tints it: light from the rings spilling up and
   * down the wall. Hot drums add their slots over a low base, which gives the glow
   * a structure to come from up close and melts into soft light from far away.
   */
  const emissive = paintCanvas(WALL_WIDTH, WALL_HEIGHT, (context) => {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

    const spill = context.createLinearGradient(0, 0, 0, WALL_HEIGHT);
    spill.addColorStop(0, 'rgba(255,255,255,0.34)');
    spill.addColorStop(0.09, 'rgba(255,255,255,0.08)');
    spill.addColorStop(0.24, 'rgba(255,255,255,0)');
    spill.addColorStop(0.76, 'rgba(255,255,255,0)');
    spill.addColorStop(0.91, 'rgba(255,255,255,0.08)');
    spill.addColorStop(1, 'rgba(255,255,255,0.34)');
    context.fillStyle = spill;
    context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

    if (paneled) return;

    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(0, WALL_LIP, WALL_WIDTH, WALL_HEIGHT - WALL_LIP * 2);
    context.fillStyle = '#ffffff';
    forEachHeatSlot((x, top, height) => {
      context.beginPath();
      context.roundRect(x - 1, top, 2, height, 1);
      context.fill();
    });
  });

  return {
    albedo: canvasTexture(albedo, 'color', true),
    surface: canvasTexture(surface, 'data', true),
    emissive: canvasTexture(emissive, 'color', true),
  };
}

/**
 * A drum lid: frosted sectors parted by a fine cross, as in the reference. The
 * values stay below bloom on purpose, so the pattern reads as a lit surface. Only
 * the hub, where the vertex colours go above 1, flares.
 */
function paintLid(): THREE.CanvasTexture {
  const size = 1024;
  const centre = size / 2;
  const radius = size / 2 - 4;

  const canvas = paintCanvas(size, size, (context) => {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, size, size);
    context.translate(centre, centre);

    const gap = 0.012;
    for (let sector = 0; sector < 4; sector += 1) {
      const start = (sector * Math.PI) / 2 + Math.PI / 4 + gap;
      const end = start + Math.PI / 2 - gap * 2;
      const middle = (start + end) / 2;
      const sheen = context.createLinearGradient(
        Math.cos(middle) * radius * 0.1,
        Math.sin(middle) * radius * 0.1,
        Math.cos(middle - 0.7) * radius,
        Math.sin(middle - 0.7) * radius,
      );
      const level = [0.74, 0.92, 0.82, 1][sector] as number;
      sheen.addColorStop(0, `rgba(255,255,255,${level * 0.82})`);
      sheen.addColorStop(0.6, `rgba(255,255,255,${level * 0.66})`);
      sheen.addColorStop(1, `rgba(255,255,255,${level})`);
      context.fillStyle = sheen;
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, start, end);
      context.closePath();
      context.fill();
    }

    context.strokeStyle = 'rgba(0,0,0,0.36)';
    context.lineWidth = 2.5;
    for (const fraction of [0.34, 0.66, 0.9]) {
      context.beginPath();
      context.arc(0, 0, radius * fraction, 0, Math.PI * 2);
      context.stroke();
    }

    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    for (let tick = 0; tick < 120; tick += 1) {
      const angle = (tick / 120) * Math.PI * 2;
      const inner = tick % 10 === 0 ? 0.91 : 0.935;
      context.beginPath();
      context.moveTo(Math.cos(angle) * radius * inner, Math.sin(angle) * radius * inner);
      context.lineTo(Math.cos(angle) * radius * 0.96, Math.sin(angle) * radius * 0.96);
      context.stroke();
    }

    for (let arm = 0; arm < 4; arm += 1) {
      const angle = (arm * Math.PI) / 2 + Math.PI / 4;
      const reach = Math.cos(angle) * radius;
      const fall = Math.sin(angle) * radius;
      const line = context.createLinearGradient(0, 0, reach, fall);
      line.addColorStop(0, 'rgba(255,255,255,1)');
      line.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      line.addColorStop(1, 'rgba(255,255,255,0.16)');
      context.strokeStyle = line;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(reach, fall);
      context.stroke();
    }

    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.beginPath();
    context.arc(0, 0, radius * 0.09, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(0, 0, radius * 0.05, 0, Math.PI * 2);
    context.fill();
  });

  return canvasTexture(canvas, 'color');
}

/**
 * A ring's light tube. Across it, `v`, a white-hot core inside a coloured sheath,
 * so that a ring seen from a metre away is a tube of light and not a flat stripe.
 * Around it, `u`, bright bands that drift: the base stays lit and the bands make
 * it feel live.
 */
function paintRingPulse(): THREE.CanvasTexture {
  const width = 512;
  const height = 32;
  const canvas = paintCanvas(width, height, (context) => {
    context.fillStyle = '#b4b4b4';
    context.fillRect(0, 0, width, height);
    for (const [centre, reach] of [
      [90, 60],
      [250, 34],
      [400, 74],
    ] as const) {
      const band = context.createLinearGradient(centre - reach, 0, centre + reach, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, 'rgba(255,255,255,1)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = band;
      context.fillRect(centre - reach, 0, reach * 2, height);
    }

    const sheath = context.createLinearGradient(0, 0, 0, height);
    sheath.addColorStop(0, 'rgba(0,0,0,0.82)');
    sheath.addColorStop(0.3, 'rgba(0,0,0,0.6)');
    sheath.addColorStop(0.46, 'rgba(0,0,0,0)');
    sheath.addColorStop(0.54, 'rgba(0,0,0,0)');
    sheath.addColorStop(0.7, 'rgba(0,0,0,0.6)');
    sheath.addColorStop(1, 'rgba(0,0,0,0.82)');
    context.fillStyle = sheath;
    context.fillRect(0, 0, width, height);
  });
  return canvasTexture(canvas, 'color', true);
}

/** One tier's wall, bottom at y = 0: chamfered lips around a slightly recessed barrel. */
function tierProfile(radius: number, height: number): Profile {
  const chamfer = 0.07;
  const lip = 0.34;
  const recess = 0.05;
  const seam = 0.05;
  return [
    [radius - seam, 0],
    [radius - chamfer, seam],
    [radius, seam + chamfer],
    [radius, lip],
    [radius - recess, lip + recess],
    [radius - recess, height - lip - recess],
    [radius, height - lip],
    [radius, height - seam - chamfer],
    [radius - chamfer, height - seam],
    [radius - seam, height],
  ];
}

/** The cap of a drum: a rolled shoulder, a flat rim and a step down into the lit lid. */
function capProfile(radius: number): Profile {
  return [
    [radius - 0.05, 0],
    [radius, 0.05],
    [radius, 0.42],
    [radius - 0.1, 0.52],
    [radius - 0.34, 0.52],
    [radius - 0.4, 0.46],
    [radius - 0.42, 0.34],
  ];
}

/** A lid with extra rings, so the vertex colours can shade it from hub to rim. */
function lidGeometry(radius: number, colors: Drum['lid'], sheen?: THREE.Color): THREE.BufferGeometry {
  const steps = [1, 0.7, 0.4, 0.14, 0.05, 0.0001];
  const geometry = revolve(
    steps.map((step) => [radius * step, 0] as const),
    { segments: SEGMENTS },
  );

  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      position.getX(index) / (radius * 2) + 0.5,
      position.getZ(index) / (radius * 2) + 0.5,
    );
  }

  const [hub, middle, rim] = colors;
  return vertexColor(geometry, (point, out) => {
    const reach = Math.hypot(point.x, point.z) / radius;
    if (reach < 0.14) out.copy(hub).lerp(middle, THREE.MathUtils.smoothstep(reach, 0.04, 0.14));
    else out.copy(middle).lerp(rim, (reach - 0.14) / 0.86);

    if (sheen) {
      const across = (point.x * -0.6 + point.z * -0.8) / radius;
      out.lerp(sheen, 0.7 * THREE.MathUtils.smoothstep(across, 0.05, 0.75));
    }
  });
}

/** A proud glowing band, thin enough at the opening shot to read as a line of light. */
function ringBand(radius: number, y: number, width = 0.095): THREE.BufferGeometry {
  return placed(
    revolve(
      [
        [radius - 0.03, -width],
        [radius + 0.035, 0],
        [radius - 0.03, width],
      ],
      { segments: SEGMENTS },
    ),
    0,
    y,
    0,
  );
}

function haloBand(radius: number, y: number, reach: number): THREE.BufferGeometry {
  return placed(
    revolve(
      [
        [radius, -reach],
        [radius, reach],
      ],
      { segments: SEGMENTS, vByHeight: true },
    ),
    0,
    y,
    0,
  );
}

/** A status lamp's housing, axis along +Y until placed. */
function badgeHousing(): THREE.BufferGeometry {
  return revolve(
    [
      [0.28, -0.02],
      [0.28, 0.08],
      [0.22, 0.14],
      [0.15, 0.14],
      [0.15, 0.11],
    ],
    { segments: 20, bevel: 0.1, vRange: [0.88, 0.89] },
  );
}

/** The flat of the cap, lit as a pale band: bare metal here only mirrors the black sky. */
function rimBevel(radius: number): THREE.BufferGeometry {
  return revolve(
    [
      [radius - 0.1, 0],
      [radius - 0.34, 0],
    ],
    { segments: SEGMENTS, vRange: [0.5, 0.5] },
  );
}

/**
 * Warm light thrown by the hot drum onto a neighbour: one soft blob on the flank
 * that faces it, in the same additive mesh as the pools of light on the dais. It
 * is what makes the drums look lit by each other and not merely placed together.
 * `u` spans twice the circle, so the round glow texture covers half of the wall.
 */
function bounceLight(drum: Drum, source: Drum, strength: number): THREE.BufferGeometry {
  const height = drum.tiers * drum.tierHeight;
  const flank = revolve(
    [
      [drum.radius + 0.05, 0],
      [drum.radius + 0.05, height],
    ],
    { segments: SEGMENTS, vByHeight: true, uRepeat: 2, uOffset: -0.5 },
  );
  const towardX = source.x - drum.x;
  const towardZ = source.z - drum.z;
  const yaw = Math.atan2(-towardX, -towardZ);
  return vertexColor(
    placed(flank, drum.x, PLINTH_HEIGHT, drum.z, yaw),
    hdr(COLORS.orange, strength),
  );
}

function drumHeight(drum: Drum): number {
  return PLINTH_HEIGHT + drum.tiers * drum.tierHeight;
}

/** Contact shadow, deepest at the plinth, so a drum grows out of it rather than sitting on it. */
function bodyShade(tint: string, baseY: number) {
  const color = new THREE.Color(tint);
  return (point: THREE.Vector3, out: THREE.Color) => {
    const lift = THREE.MathUtils.smoothstep(point.y, baseY, baseY + 2.4);
    out.copy(color).multiplyScalar(0.42 + 0.58 * lift);
  };
}

function buildDrum(drum: Drum, seed: number) {
  const rng = createRng(seed);
  const body: THREE.BufferGeometry[] = [];
  const lines: THREE.BufferGeometry[] = [];
  const halos: THREE.BufferGeometry[] = [];
  const shade = bodyShade(drum.tint, PLINTH_HEIGHT);

  for (let tier = 0; tier < drum.tiers; tier += 1) {
    const y = PLINTH_HEIGHT + tier * drum.tierHeight;
    const wall = revolve(tierProfile(drum.radius, drum.tierHeight), {
      segments: SEGMENTS,
      bevel: 0.16,
      vByHeight: true,
      uOffset: rng(),
    });
    body.push(vertexColor(placed(wall, 0, y, 0), shade));

    if (tier > 0) {
      const hot = drum.body === 'hot';
      lines.push(vertexColor(ringBand(drum.radius, y, hot ? 0.15 : 0.115), drum.ring));
      halos.push(vertexColor(haloBand(drum.radius + 0.05, y, hot ? 1 : 0.5), drum.halo));
    }

    const angle = BADGE_ANGLE + rngBetween(rng, -0.22, 0.22);
    const badgeY = y + drum.tierHeight * rngBetween(rng, 0.42, 0.58);
    const x = Math.sin(angle) * drum.radius;
    const z = Math.cos(angle) * drum.radius;
    body.push(vertexColor(placed(badgeHousing(), x, badgeY, z, angle, Math.PI / 2), shade));
    lines.push(
      vertexColor(
        placed(fitUv(new THREE.CircleGeometry(0.15, 20), LENS_UV), x * 1.046, badgeY, z * 1.046, angle),
        BADGE_LIGHT,
      ),
    );
  }

  const top = drumHeight(drum);
  const cap = revolve(capProfile(drum.radius), {
    segments: SEGMENTS,
    bevel: 0.16,
    vRange: [0.88, 0.89],
  });
  body.push(vertexColor(placed(cap, 0, top, 0), shade));

  const lidRadius = drum.radius - 0.42;
  lines.push(
    vertexColor(
      placed(ringBand(lidRadius + 0.03, 0, 0.065), 0, top + 0.38, 0),
      drum.ring.clone().multiplyScalar(0.2),
    ),
    vertexColor(
      placed(ringBand(drum.radius - 0.03, 0, 0.06), 0, top + 0.49, 0),
      drum.ring.clone().multiplyScalar(0.13),
    ),
    vertexColor(placed(rimBevel(drum.radius), 0, top + 0.53, 0), drum.rim),
  );

  const offset = (geometry: THREE.BufferGeometry) => geometry.translate(drum.x, 0, drum.z);
  return {
    body: body.map(offset),
    lines: lines.map(offset),
    halos: halos.map(offset),
    lid: offset(placed(lidGeometry(lidRadius, drum.lid, drum.sheen), 0, top + 0.34, 0)),
  };
}

/** The dais every drum stands on: a stepped disc, inside the loop road. */
function plinthGeometry(): THREE.BufferGeometry {
  const geometry = revolve(
    [
      [8.1, 0],
      [8.1, 0.18],
      [8, 0.26],
      [7.54, 0.26],
      [7.46, PLINTH_HEIGHT - 0.06],
      [7.38, PLINTH_HEIGHT],
      [0.001, PLINTH_HEIGHT],
    ],
    { segments: SEGMENTS, bevel: 0.14, uRepeat: 1.5, vRange: [0.06, 0.94] },
  );
  return vertexColor(geometry, new THREE.Color('#5a6478'));
}

const DAIS_RADIUS = 7.38;

/** Light pooled around each drum's foot: `reach` is where a pool has faded out. */
const DAIS_POOLS: readonly { drum: number; color: string; strength: number; reach: number }[] = [
  { drum: 2, color: COLORS.orange, strength: 0.9, reach: 7.5 },
  { drum: 0, color: COLORS.blue, strength: 0.7, reach: 5.8 },
  { drum: 1, color: COLORS.violet, strength: 0.7, reach: 5.4 },
];

/**
 * The pools of light on the dais, baked into one disc. Separate quads would
 * overhang its edge and hang in the air, half a unit above the deck.
 */
function daisGlow(): THREE.BufferGeometry {
  const rings = 10;
  const profile = Array.from(
    { length: rings + 1 },
    (_, ring) => [DAIS_RADIUS * (1 - ring / rings) + 0.001, 0] as const,
  );
  const disc = fitUv(revolve(profile, { segments: 64 }), { u0: 0.5, u1: 0.5, v0: 0.5, v1: 0.5 });
  const pool = new THREE.Color();

  return vertexColor(placed(disc, 0, PLINTH_HEIGHT + 0.03, 0), (point, out) => {
    out.setRGB(0, 0, 0);
    for (const { drum, color, strength, reach } of DAIS_POOLS) {
      const { x, z } = DRUMS[drum] as Drum;
      const fall = Math.max(0, 1 - Math.hypot(point.x - x, point.z - z) / reach);
      out.add(pool.set(color).multiplyScalar(strength * fall * fall));
    }
    const edge = Math.hypot(point.x, point.z) / DAIS_RADIUS;
    out.multiplyScalar(1 - THREE.MathUtils.smoothstep(edge, 0.82, 1));
  });
}

interface ControlBox {
  x: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  depth: number;
}

/** Control boxes at the drums' feet, angled to follow the dais. */
const CONTROL_BOXES: readonly ControlBox[] = [
  { x: -5.4, z: 3.15, yaw: -0.5, width: 2.9, height: 3.1, depth: 2.3 },
  { x: 5.45, z: 3.15, yaw: 0.5, width: 2.7, height: 2.7, depth: 2.3 },
];

function buildControlBoxes(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shell = new THREE.Color('#8b97b4');
  const units: readonly BoxFaces[] = [
    rackFaces({
      front: 'unitLights',
      right: 'unitGrille',
      left: 'unitGrille',
      back: 'plate',
      top: 'plain',
    }),
    rackFaces({
      front: 'unitGrille',
      right: 'unitLights',
      left: 'unitLights',
      back: 'plate',
      top: 'lidLit',
    }),
  ];
  const finUv = rackFaces({ front: 'plain', back: 'plain', left: 'plain', right: 'plain', top: 'worn' });
  const base = rackFaces({ top: 'plain', front: 'grate', back: 'grate', left: 'grate', right: 'grate' });

  for (const box of CONTROL_BOXES) {
    parts.push(
      vertexColor(
        placed(
          chamferedBox(box.width + 0.24, 0.3, box.depth + 0.24, 0.05, base),
          box.x,
          PLINTH_HEIGHT + 0.15,
          box.z,
          box.yaw,
        ),
        shell,
      ),
    );
    const floor = PLINTH_HEIGHT + 0.3;
    const unitHeight = box.height / units.length;
    units.forEach((faces, level) => {
      parts.push(
        vertexColor(
          placed(
            chamferedBox(box.width - level * 0.06, unitHeight - 0.04, box.depth - level * 0.06, 0.09, faces),
            box.x,
            floor + (level + 0.5) * unitHeight,
            box.z,
            box.yaw,
          ),
          (point, out) => {
            const lift = THREE.MathUtils.smoothstep(point.y, PLINTH_HEIGHT, PLINTH_HEIGHT + 1.6);
            out.copy(shell).multiplyScalar(0.55 + 0.45 * lift);
          },
        ),
      );
    });

    /* Cooling fins along the back of each box's lid. */
    const fins = 9;
    const finTop = floor + box.height;
    const cos = Math.cos(box.yaw);
    const sin = Math.sin(box.yaw);
    for (let fin = 0; fin < fins; fin += 1) {
      const across = (fin / (fins - 1) - 0.5) * (box.width - 0.5);
      const away = -box.depth / 2 + 0.34;
      parts.push(
        vertexColor(
          placed(
            chamferedBox(0.07, 0.42, 0.44, 0.012, finUv),
            box.x + across * cos + away * sin,
            finTop + 0.2,
            box.z - across * sin + away * cos,
            box.yaw,
          ),
          shell,
        ),
      );
    }
  }
  return mergeParts(parts);
}

/** Armoured conduit between the boxes and the drums, lying on the dais. */
function buildConduits(): THREE.BufferGeometry {
  const uv = rackUv('rubber');
  const color = new THREE.Color('#7c869a');
  const y = PLINTH_HEIGHT + 0.14;
  const runs: readonly (readonly [number, number, number])[][] = [
    [
      [-4.6, y + 0.4, 2.8],
      [-3.9, y, 2.2],
      [-3.7, y, 0.4],
      [-3.1, y + 0.3, -0.5],
    ],
    [
      [-4.2, y + 0.4, 3.6],
      [-3.2, y, 3.9],
      [-2.2, y, 5.2],
    ],
    [
      [4.6, y + 0.4, 2.7],
      [3.9, y, 2],
      [3.7, y, 0.3],
      [3.1, y + 0.3, -0.6],
    ],
    [
      [4.3, y + 0.4, 3.6],
      [3.3, y, 4],
      [2.3, y, 5.3],
    ],
  ];
  return mergeParts(
    runs.map((run) =>
      vertexColor(pipe(run.map(([a, b, c]) => [a, b, c]), 0.1, uv, 8), color),
    ),
  );
}

/** The short glass sleeve where the energy column comes down into the rear unit. */
function buildFeed(rear: Drum) {
  const top = drumHeight(rear) + 0.34;
  const collar = revolve(
    [
      [1.6, 0],
      [1.6, 0.26],
      [1.5, 0.34],
      [1.22, 0.34],
      [1.22, 0.86],
      [1.32, 0.92],
      [1.32, 1.12],
      [1.2, 1.2],
      [0.92, 1.2],
    ],
    { segments: 64, bevel: 0.14, vRange: [0.05, 0.3] },
  );
  const crown = revolve(
    [
      [1.1, 0],
      [1.22, 0.06],
      [1.22, 0.3],
      [1.1, 0.36],
      [0.9, 0.36],
    ],
    { segments: 64, bevel: 0.14, vRange: [0.05, 0.3] },
  );
  const crownY = top + 2.5;
  const shade = bodyShade(rear.tint, 0);
  const beamHeight = crownY - top + 0.9;

  const sleeve = vertexColor(
    placed(
      revolve(
        [
          [0.96, 0],
          [0.96, crownY - top - 1.2],
        ],
        { segments: 48, vByHeight: true },
      ),
      rear.x,
      top + 1.2,
      rear.z,
    ),
    hdr(COLORS.orange, 0.34),
  );

  const beam = vertexColor(
    placed(
      new THREE.CylinderGeometry(0.2, 0.26, beamHeight, 16, 1, true),
      rear.x,
      top + beamHeight / 2,
      rear.z,
    ),
    hdr('#ffd9a8', 9),
  );

  return {
    body: [
      vertexColor(placed(collar, rear.x, top, rear.z), shade),
      vertexColor(placed(crown, rear.x, crownY, rear.z), shade),
    ],
    sleeve,
    beam,
  };
}

interface VaultAssets {
  steelBody: THREE.BufferGeometry;
  hotBody: THREE.BufferGeometry;
  boxes: THREE.BufferGeometry;
  lids: THREE.BufferGeometry;
  lines: THREE.BufferGeometry;
  halos: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
  steel: THREE.MeshStandardMaterial;
  hot: THREE.MeshStandardMaterial;
  lidMaterial: THREE.MeshBasicMaterial;
  lineMaterial: THREE.MeshBasicMaterial;
  animate(time: number): void;
}

let assets: VaultAssets | null = null;

function getVaultAssets(): VaultAssets {
  if (assets) return assets;

  const steelMaps = paintWallMaps('steel');
  const hotMaps = paintWallMaps('hot');

  const steel = new THREE.MeshStandardMaterial({
    map: steelMaps.albedo,
    roughnessMap: steelMaps.surface,
    metalnessMap: steelMaps.surface,
    bumpMap: steelMaps.surface,
    bumpScale: 1.1,
    metalness: 1,
    roughness: 1,
    emissive: new THREE.Color(COLORS.blue),
    emissiveMap: steelMaps.emissive,
    emissiveIntensity: 1.2,
    vertexColors: true,
  });
  extendEmissive(
    steel,
    'vault-steel',
    { uRim: { value: hdr('#4f8dff', 0.8) } },
    'uniform vec3 uRim;',
    `float rim = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
     rim *= rim;
     totalEmissiveRadiance += uRim * rim * rim;`,
  );

  /*
   * Lit from inside: the glow follows the face turned to the viewer, so it holds at
   * any orbit. A narrow beam inside a broad wash, the reference's hot centre line.
   */
  const hot = new THREE.MeshStandardMaterial({
    map: hotMaps.albedo,
    roughnessMap: hotMaps.surface,
    metalnessMap: hotMaps.surface,
    bumpMap: hotMaps.surface,
    bumpScale: 1.1,
    metalness: 1,
    roughness: 1,
    emissive: new THREE.Color('#ff7d2a'),
    emissiveMap: hotMaps.emissive,
    emissiveIntensity: 3.8,
    vertexColors: true,
  });
  extendEmissive(
    hot,
    'vault-hot',
    {},
    '',
    `float facing = saturate(dot(normal, normalize(vViewPosition)));
     float wash = facing * facing;
     wash *= wash;
     float beam = wash * wash;
     beam *= beam;
     beam *= beam;
     totalEmissiveRadiance *= 0.05 + 0.4 * wash + 1.5 * beam;`,
  );

  const steelParts: THREE.BufferGeometry[] = [];
  const hotParts: THREE.BufferGeometry[] = [];
  const lineParts: THREE.BufferGeometry[] = [];
  const haloParts: THREE.BufferGeometry[] = [];
  const lidParts: THREE.BufferGeometry[] = [];

  DRUMS.forEach((drum, index) => {
    const built = buildDrum(drum, 0x3100 + index * 97);
    (drum.body === 'hot' ? hotParts : steelParts).push(...built.body);
    lineParts.push(...built.lines);
    haloParts.push(...built.halos);
    lidParts.push(built.lid);
  });

  const rear = DRUMS[3] as Drum;
  const feed = buildFeed(rear);
  steelParts.push(...feed.body);
  haloParts.push(feed.sleeve);
  lineParts.push(feed.beam);
  steelParts.push(plinthGeometry());

  const pulse = paintRingPulse();

  const lidMaterial = new THREE.MeshBasicMaterial({
    map: paintLid(),
    vertexColors: true,
    toneMapped: false,
  });
  const lineMaterial = new THREE.MeshBasicMaterial({
    map: pulse,
    vertexColors: true,
    toneMapped: false,
  });

  assets = {
    steelBody: mergeParts(steelParts),
    hotBody: mergeParts(hotParts),
    boxes: mergeParts([buildControlBoxes(), buildConduits()]),
    lids: mergeParts(lidParts),
    lines: mergeParts(lineParts),
    halos: mergeParts(haloParts),
    floor: mergeParts([
      daisGlow(),
      bounceLight(DRUMS[0] as Drum, DRUMS[2] as Drum, 0.7),
      bounceLight(DRUMS[1] as Drum, DRUMS[2] as Drum, 0.7),
    ]),
    steel,
    hot,
    lidMaterial,
    lineMaterial,
    animate(time) {
      pulse.offset.x = (time * 0.035) % 1;
      lineMaterial.color.setScalar(1 + 0.08 * Math.sin(time * 1.3));
    },
  };
  return assets;
}

export function DataVaultProps() {
  const vault = useMemo(getVaultAssets, []);
  const hardware = useMemo(getHardware, []);
  const glow = useMemo(() => getKit().sprite(COLORS.orange, 0.4), []);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);
  const rich = quality !== 'low';

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    vault.animate(clock.elapsedTime);
    hardware.animateLights(clock.elapsedTime);
  });

  const rear = DRUMS[3] as Drum;

  return (
    <group>
      <mesh geometry={vault.steelBody} material={vault.steel} />
      <mesh geometry={vault.hotBody} material={vault.hot} />
      <mesh geometry={vault.boxes} material={hardware.rack} />
      <mesh geometry={vault.lids} material={vault.lidMaterial} />
      <mesh geometry={vault.lines} material={vault.lineMaterial} />
      <mesh geometry={vault.floor} material={hardware.floorGlow} />
      {rich ? <mesh geometry={vault.halos} material={hardware.halo} /> : null}
      {rich ? (
        <sprite
          material={glow}
          position={[rear.x, drumHeight(rear) + 1.6, rear.z]}
          scale={[6.5, 6.5, 1]}
        />
      ) : null}
    </group>
  );
}
