'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { experience } from '@/data/experience';
import type { ExperienceEntry } from '@/lib/types';
import { useUniverse } from '../../../state/store';
import { getKit } from '../../kit';
import { COLORS, hdr } from '../../palette';
import {
  canvasTexture,
  chamferedBox,
  fitUv,
  floorGlowGeometry,
  getHardware,
  mergeParts,
  paintCanvas,
  pipe,
  placed,
  rackFaces,
  rackUv,
  revolve,
  roundedRectShape,
  vertexColor,
  type RackRegion,
} from './hardware';

/**
 * The Experience Archive: tall glass documents floating over a low server bank.
 * Each panel is a real page of the career record, drawn from
 * `src/data/experience.ts`, so walking up to one reads as walking up to the
 * archive rather than to a texture. From the opening shot the same pages melt
 * into the reference's blue headers and orange text blocks.
 *
 * Panels get a separate face per side, so they are never mirrored from behind:
 * the robot can walk all the way around the island.
 */

interface Panel {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Height of whatever the panel's light stem rises from. */
  foot: number;
}

const PANEL_WIDTH = 4.8;
const PANEL_HEIGHT = 10.6;
const PANEL_CORNER = 0.3;
const FRAME_WIDTH = 0.05;

/** Fanned along a row that recedes to the right, so tops climb the frame as in the reference. */
const PANELS: readonly Panel[] = [
  { x: -5.3, y: 10, z: 2.1, yaw: 0.3, foot: 3.8 },
  { x: 0, y: 10.2, z: -0.25, yaw: 0.24, foot: 1.5 },
  { x: 5.2, y: 10.4, z: -2.6, yaw: 0.18, foot: 4.2 },
];

const PAGE_WIDTH = 680;
const PAGE_HEIGHT = 1500;
/** Every page prints the timeline at this height, so it runs straight across all of them. */
const PAGE_RAIL_Y = 705;
const RAIL_HEIGHT = PANEL_HEIGHT / 2 - (PAGE_RAIL_Y / PAGE_HEIGHT) * PANEL_HEIGHT;

const SANS = '"Panel Sans", "Segoe UI", Helvetica, Arial, sans-serif';
const MONO = '"Panel Mono", Consolas, Menlo, monospace';

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  limit: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
      if (lines.length === limit) return lines;
    } else {
      line = next;
    }
  }
  if (line && lines.length < limit) lines.push(line);
  return lines;
}

/** One page. It is drawn for additive glass: black is clear, so light is all that is painted. */
function paintPage(context: CanvasRenderingContext2D, entry: ExperienceEntry, index: number) {
  const left = 52;
  const width = PAGE_WIDTH - left * 2;

  const body = context.createLinearGradient(0, 0, 0, PAGE_HEIGHT);
  body.addColorStop(0, 'rgba(78,112,206,0.46)');
  body.addColorStop(0.5, 'rgba(104,96,178,0.36)');
  body.addColorStop(1, 'rgba(164,108,150,0.46)');
  context.fillStyle = body;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const sheen = context.createLinearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT * 0.5);
  sheen.addColorStop(0, 'rgba(200,216,255,0.2)');
  sheen.addColorStop(0.4, 'rgba(200,216,255,0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  let y = 78;
  context.textBaseline = 'alphabetic';

  context.fillStyle = '#8cc8ff';
  context.font = `500 24px ${MONO}`;
  context.fillText(`RECORD ${String(experience.length - index).padStart(2, '0')}`, left, y);
  y += 30;
  context.fillStyle = '#7898e2';
  context.font = `500 20px ${MONO}`;
  context.fillText(entry.period, left, y);
  y += 26;

  context.shadowColor = '#7fb4ff';
  context.shadowBlur = 16;
  context.fillStyle = '#eef5ff';
  context.font = `600 52px ${SANS}`;
  for (const line of wrapLines(context, entry.role, width, 3)) {
    y += 58;
    context.fillText(line, left, y);
  }
  context.shadowBlur = 0;
  y += 40;

  context.fillStyle = '#9ab8f2';
  context.font = `500 21px ${MONO}`;
  for (const line of wrapLines(context, entry.organisation, width, 2)) {
    context.fillText(line, left, y);
    y += 28;
  }
  y += 8;

  context.fillStyle = 'rgba(160,190,255,0.5)';
  context.fillRect(left, y, width, 2);
  y += 40;

  context.fillStyle = '#c6d2f6';
  context.font = `400 25px ${SANS}`;
  const summaryLines = Math.floor((PAGE_RAIL_Y - 30 - y) / 34);
  for (const line of wrapLines(context, entry.summary, width, summaryLines)) {
    context.fillText(line, left, y);
    y += 34;
  }

  context.fillStyle = 'rgba(170,200,255,0.75)';
  context.fillRect(0, PAGE_RAIL_Y - 2, PAGE_WIDTH, 4);
  experience.forEach((_, stop) => {
    const stopX = left + (stop / Math.max(1, experience.length - 1)) * width;
    const reached = stop === index;
    context.fillStyle = reached ? '#ffd6a6' : '#86a8ee';
    context.beginPath();
    context.arc(stopX, PAGE_RAIL_Y, reached ? 13 : 8, 0, Math.PI * 2);
    context.fill();
  });

  y = PAGE_RAIL_Y + 66;
  context.font = `400 26px ${SANS}`;
  for (const highlight of entry.highlights.slice(0, 4)) {
    context.fillStyle = '#ff9c4a';
    context.fillRect(left, y - 15, 16, 5);
    context.fillStyle = '#ffba7c';
    for (const line of wrapLines(context, highlight, width - 34, 2)) {
      context.fillText(line, left + 34, y);
      y += 34;
    }
    y += 12;
  }
  y += 24;

  context.font = `500 21px ${MONO}`;
  let chipX = left;
  for (const name of entry.stack) {
    const chipWidth = context.measureText(name).width + 28;
    if (chipX + chipWidth > left + width) {
      chipX = left;
      y += 46;
    }
    if (y > PAGE_HEIGHT - 170) break;
    context.strokeStyle = 'rgba(255,170,100,0.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(chipX, y - 25, chipWidth, 36, 8);
    context.stroke();
    context.fillStyle = '#ffc48f';
    context.fillText(name, chipX + 14, y);
    chipX += chipWidth + 12;
  }

  /* A strip of bars, one per technology on the record. Texture, not a metric: it has no axis. */
  const bars = entry.stack.length * 3;
  const baseline = PAGE_HEIGHT - 58;
  for (let bar = 0; bar < bars; bar += 1) {
    const rise = 0.5 + 0.5 * Math.sin((bar + index * 3) * 0.9);
    context.fillStyle = bar % 3 === 0 ? 'rgba(255,170,100,0.8)' : 'rgba(150,178,255,0.7)';
    const barHeight = 16 + rise * 64;
    context.fillRect(left + (bar * width) / bars, baseline - barHeight, width / bars - 6, barHeight);
  }
}

/**
 * The bright rail around a page is part of the texture, not of the geometry. At
 * the opening shot it is under a pixel wide, where a thin HDR mesh would break
 * into dashes, and the mip chain keeps this one smooth.
 */
function paintRail(context: CanvasRenderingContext2D) {
  const rail = context.createLinearGradient(0, 0, PAGE_WIDTH * 0.4, PAGE_HEIGHT);
  rail.addColorStop(0, '#d2d6ff');
  rail.addColorStop(0.5, '#ecc4f4');
  rail.addColorStop(1, '#ffc4b4');
  context.strokeStyle = rail;
  context.shadowColor = '#c8a8ff';
  context.shadowBlur = 24;
  context.lineWidth = 9;
  context.beginPath();
  context.roundRect(5, 5, PAGE_WIDTH - 10, PAGE_HEIGHT - 10, 40);
  context.stroke();
  context.shadowBlur = 0;
}

function paintPages(context: CanvasRenderingContext2D) {
  context.fillStyle = '#000000';
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);

  PANELS.forEach((_, index) => {
    const entry = experience[index];
    if (!entry) return;
    context.save();
    context.translate(index * PAGE_WIDTH, 0);
    context.beginPath();
    context.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.clip();
    paintPage(context, entry, index);
    paintRail(context);
    context.restore();
  });
}

async function loadPanelFonts(): Promise<void> {
  const faces = [
    new FontFace('Panel Sans', 'url(/fonts/Geist-SemiBold.ttf)', { weight: '600' }),
    new FontFace('Panel Sans', 'url(/fonts/Geist-Regular.ttf)', { weight: '400' }),
    new FontFace('Panel Mono', 'url(/fonts/GeistMono-Medium.ttf)', { weight: '500' }),
  ];
  const loaded = await Promise.all(faces.map((face) => face.load()));
  for (const face of loaded) document.fonts.add(face);
}

function pageTexture(): THREE.CanvasTexture {
  const canvas = paintCanvas(PAGE_WIDTH * PANELS.length, PAGE_HEIGHT);
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  paintPages(context);
  const texture = canvasTexture(canvas, 'color');

  /* The system fallback already looks right at a distance, so a failed font load just stays. */
  void loadPanelFonts()
    .then(() => {
      paintPages(context);
      texture.needsUpdate = true;
    })
    .catch(() => undefined);

  return texture;
}

/** The glass: rounded front and back faces, each reading the right way round. */
function glassGeometry(index: number): THREE.BufferGeometry {
  const front = new THREE.ShapeGeometry(
    roundedRectShape(PANEL_WIDTH, PANEL_HEIGHT, PANEL_CORNER),
    8,
  );
  const position = front.getAttribute('position') as THREE.BufferAttribute;
  const uv = front.getAttribute('uv') as THREE.BufferAttribute;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    uv.setXY(
      vertex,
      (index + position.getX(vertex) / PANEL_WIDTH + 0.5) / PANELS.length,
      position.getY(vertex) / PANEL_HEIGHT + 0.5,
    );
  }
  const back = front.clone().rotateY(Math.PI);
  return mergeParts([front, back]);
}

/** The physical edge of the glass. Quiet: `paintRail` carries the glow. */
function frameGeometry(): THREE.BufferGeometry {
  const outer = roundedRectShape(
    PANEL_WIDTH + FRAME_WIDTH * 2,
    PANEL_HEIGHT + FRAME_WIDTH * 2,
    PANEL_CORNER + FRAME_WIDTH,
  );
  outer.holes.push(roundedRectShape(PANEL_WIDTH, PANEL_HEIGHT, PANEL_CORNER));
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth: 0.05,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -0.025);

  const cool = hdr('#b4c6ff', 0.9);
  const warm = hdr('#ffc2b8', 1.1);
  return vertexColor(geometry, (point, out) => {
    const fall = THREE.MathUtils.clamp(0.5 - point.y / PANEL_HEIGHT, 0, 1);
    out.copy(cool).lerp(warm, fall);
  });
}

/** A point on a panel, in the island's frame, from the panel's own centre. */
function panelPoint(panel: Panel, across: number, up: number): THREE.Vector3 {
  return new THREE.Vector3(
    panel.x + across * Math.cos(panel.yaw),
    panel.y + up,
    panel.z - across * Math.sin(panel.yaw),
  );
}

/** Where the printed timeline leaves one page and reaches the next. */
function timelineBridges(): [THREE.Vector3, THREE.Vector3][] {
  return PANELS.slice(1).map((panel, index) => [
    panelPoint(PANELS[index] as Panel, PANEL_WIDTH / 2, RAIL_HEIGHT),
    panelPoint(panel, -PANEL_WIDTH / 2, RAIL_HEIGHT),
  ]);
}

interface BankSegment {
  angle: number;
  height: number;
  outer: RackRegion;
  inner: RackRegion;
}

const BANK_RADIUS = 6.55;
const BANK_WIDTH = 3.4;
const BANK_DEPTH = 2.1;
const BANK_PLINTH = 0.3;
/** Each segment is a stack of chassis about this tall, which suits the atlas's unit faces. */
const BANK_UNIT = 1.85;

/**
 * The server bank, a horseshoe open towards the opening camera so that the label
 * plate has room, tallest at the rear where it shows between the pages. `angle`
 * is degrees from +Z. Outer corners stay inside `islandPropReach`.
 */
const BANK: readonly BankSegment[] = [
  { angle: -165, height: 5, outer: 'unitGrille', inner: 'unitWarm' },
  { angle: -135, height: 5.4, outer: 'unitLights', inner: 'unitGrille' },
  { angle: -105, height: 4.4, outer: 'unitWarm', inner: 'unitLights' },
  { angle: -75, height: 3.8, outer: 'unitLights', inner: 'unitWarm' },
  { angle: -45, height: 2.3, outer: 'unitGrille', inner: 'plate' },
  { angle: 45, height: 2.4, outer: 'unitLights', inner: 'plate' },
  { angle: 75, height: 3.3, outer: 'unitWarm', inner: 'unitGrille' },
  { angle: 105, height: 4.2, outer: 'unitLights', inner: 'unitWarm' },
  { angle: 135, height: 4.9, outer: 'unitGrille', inner: 'unitLights' },
  { angle: 165, height: 5.7, outer: 'unitWarm', inner: 'unitGrille' },
];

function bankShade(point: THREE.Vector3, out: THREE.Color) {
  out.setScalar(0.42 + 0.58 * THREE.MathUtils.smoothstep(point.y, 0, 1.8));
}

/** A slim column closing the wedge between two neighbouring segments. */
function bankPost(angle: number, height: number): THREE.BufferGeometry {
  const yaw = THREE.MathUtils.degToRad(angle);
  const faces = rackFaces({ front: 'plain', back: 'plain', left: 'plain', right: 'plain', top: 'plain' });
  return vertexColor(
    placed(
      chamferedBox(0.62, height, BANK_DEPTH + 0.16, 0.08, faces),
      Math.sin(yaw) * BANK_RADIUS,
      height / 2,
      Math.cos(yaw) * BANK_RADIUS,
      yaw,
    ),
    bankShade,
  );
}

function buildBank(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const footFaces = rackFaces({ front: 'grate', back: 'grate', left: 'grate', right: 'grate' });

  BANK.forEach((segment, index) => {
    const yaw = THREE.MathUtils.degToRad(segment.angle);
    const x = Math.sin(yaw) * BANK_RADIUS;
    const z = Math.cos(yaw) * BANK_RADIUS;
    const bodyHeight = segment.height - BANK_PLINTH;
    const units = Math.max(1, Math.round(bodyHeight / BANK_UNIT));
    const unitHeight = bodyHeight / units;

    parts.push(
      vertexColor(
        placed(
          chamferedBox(BANK_WIDTH + 0.16, BANK_PLINTH, BANK_DEPTH + 0.16, 0.05, footFaces),
          x,
          BANK_PLINTH / 2,
          z,
          yaw,
        ),
        bankShade,
      ),
    );

    for (let unit = 0; unit < units; unit += 1) {
      const flipped = unit % 2 === 1 && segment.inner !== 'plate';
      const faces = rackFaces({
        front: flipped ? segment.inner : segment.outer,
        back: flipped ? segment.outer : segment.inner,
        left: 'plate',
        right: 'plate',
        top: 'lidVent',
      });
      const inset = unit * 0.05;
      parts.push(
        vertexColor(
          placed(
            chamferedBox(BANK_WIDTH - inset, unitHeight - 0.04, BANK_DEPTH - inset, 0.08, faces),
            x,
            BANK_PLINTH + (unit + 0.5) * unitHeight,
            z,
            yaw,
          ),
          bankShade,
        ),
      );
    }

    const next = BANK[index + 1];
    if (next && next.angle - segment.angle === 30) {
      parts.push(
        bankPost(segment.angle + 15, Math.max(segment.height, next.height) + 0.26),
      );
    }
  });

  parts.push(bankPost(180, 6));
  return parts;
}

/** A round projector, the hardware a page's light appears to come from. */
function projector(x: number, y: number, z: number): THREE.BufferGeometry {
  const geometry = fitUv(
    revolve(
      [
        [0.92, 0],
        [0.92, 0.14],
        [0.8, 0.26],
        [0.44, 0.34],
        [0.34, 0.5],
        [0.2, 0.5],
      ],
      { segments: 32, bevel: 0.14 },
    ),
    rackUv('plain'),
  );
  return vertexColor(placed(geometry, x, y, z), new THREE.Color('#ffffff'));
}

/** The round dais under the middle page, and the conduit tying it to the bank. */
function buildDais(): THREE.BufferGeometry[] {
  const dais = fitUv(
    revolve(
      [
        [3.3, 0],
        [3.3, 0.5],
        [3.16, 0.64],
        [2.5, 0.64],
        [2.44, 0.76],
        [2.3, 0.82],
        [0.001, 0.82],
      ],
      { segments: 64, bevel: 0.16, uRepeat: 1 },
    ),
    rackUv('plate'),
  );
  const conduit = rackUv('rubber');
  const color = new THREE.Color('#aab4ca');
  return [
    vertexColor(placed(dais, 0, 0, -0.25), bankShade),
    vertexColor(
      pipe(
        [
          [-2.2, 0.5, -1.8],
          [-3.1, 0.14, -2.6],
          [-3.6, 0.14, -3.2],
          [-4.1, 0.7, -4.1],
        ],
        0.1,
        conduit,
      ),
      color,
    ),
    vertexColor(
      pipe(
        [
          [2.2, 0.5, -1.8],
          [3, 0.14, -2.5],
          [3.5, 0.14, -3],
          [4.1, 0.7, -3.9],
        ],
        0.1,
        conduit,
      ),
      color,
    ),
  ];
}

/** The stems the pages float on, their projector lenses, and the bridges between pages. */
function buildLight(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = hdr('#ffb98a', 1.3);
  const lens = hdr('#ffe2c4', 5);
  const bridge = hdr('#d0c8ff', 2);
  const stemRadius = 0.022;

  for (const panel of PANELS) {
    const top = panel.y - PANEL_HEIGHT / 2;
    const base = panel.foot + 0.5;
    if (top > base) {
      parts.push(
        vertexColor(
          placed(
            new THREE.CylinderGeometry(stemRadius, stemRadius * 1.6, top - base, 8, 1, true),
            panel.x,
            (top + base) / 2,
            panel.z,
          ),
          stem,
        ),
      );
    }
    parts.push(
      vertexColor(
        placed(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), panel.x, base + 0.012, panel.z),
        lens,
      ),
    );
  }

  for (const [start, end] of timelineBridges()) {
    parts.push(
      vertexColor(
        pipe(
          [
            [start.x, start.y, start.z],
            [end.x, end.y, end.z],
          ],
          0.03,
          rackUv('plain'),
          6,
        ),
        bridge,
      ),
    );
  }
  return mergeParts(parts);
}

interface ArchiveAssets {
  bank: THREE.BufferGeometry;
  light: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
  frame: THREE.BufferGeometry;
  glass: THREE.BufferGeometry[];
  glassMaterial: THREE.MeshBasicMaterial;
  frameMaterial: THREE.MeshBasicMaterial;
  lightMaterial: THREE.MeshBasicMaterial;
}

let assets: ArchiveAssets | null = null;

function getArchiveAssets(): ArchiveAssets {
  if (assets) return assets;
  assets = {
    bank: mergeParts([
      ...buildBank(),
      ...buildDais(),
      ...PANELS.map((panel) => projector(panel.x, panel.foot, panel.z)),
    ]),
    light: buildLight(),
    floor: floorGlowGeometry([
      { x: -2.6, z: 0.8, radius: 5.2, color: COLORS.orange, strength: 0.34 },
      { x: 0, z: -0.2, radius: 5.2, color: COLORS.violet, strength: 0.34 },
      { x: 2.6, z: -1, radius: 5.2, color: COLORS.blue, strength: 0.3 },
    ]),
    frame: frameGeometry(),
    glass: PANELS.map((_, index) => glassGeometry(index)),
    glassMaterial: new THREE.MeshBasicMaterial({
      map: pageTexture(),
      color: hdr('#ffffff', 1.65),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    frameMaterial: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    lightMaterial: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
  return assets;
}

export function ExperienceArchiveProps() {
  const archive = useMemo(getArchiveAssets, []);
  const hardware = useMemo(getHardware, []);
  const glints = useMemo(() => {
    const [first, , last] = PANELS as readonly [Panel, Panel, Panel];
    const gaps = timelineBridges().map(([start, end]) => start.clone().lerp(end, 0.5));
    return {
      gapA: gaps[0],
      gapB: gaps[1],
      cornerA: panelPoint(first, -PANEL_WIDTH / 2, PANEL_HEIGHT / 2),
      cornerB: panelPoint(last, PANEL_WIDTH / 2, PANEL_HEIGHT / 2),
    };
  }, []);
  const node = useMemo(() => getKit().sprite(COLORS.cyan, 0.9), []);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);
  const panels = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.elapsedTime;
    hardware.animateLights(time);
    PANELS.forEach((panel, index) => {
      const group = panels.current[index];
      if (group) group.position.y = panel.y + Math.sin(time * 0.6 + index * 1.7) * 0.07;
    });
  });

  return (
    <group>
      <mesh geometry={archive.bank} material={hardware.rack} />
      <mesh geometry={archive.light} material={archive.lightMaterial} />
      <mesh geometry={archive.floor} material={hardware.floorGlow} />
      {PANELS.map((panel, index) => (
        <group
          key={panel.x}
          ref={(group) => {
            panels.current[index] = group;
          }}
          position={[panel.x, panel.y, panel.z]}
          rotation={[0, panel.yaw, 0]}
        >
          <mesh geometry={archive.glass[index]} material={archive.glassMaterial} />
          <mesh geometry={archive.frame} material={archive.frameMaterial} />
        </group>
      ))}
      {quality !== 'low' ? (
        <>
          <sprite material={node} position={glints.gapB} scale={[1.2, 1.2, 1]} />
          <sprite material={hardware.glint} position={glints.gapA} scale={[2.4, 2.4, 1]} />
          <sprite material={hardware.glint} position={glints.cornerA} scale={[2, 2, 1]} />
          <sprite material={hardware.glint} position={glints.cornerB} scale={[2, 2, 1]} />
        </>
      ) : null}
    </group>
  );
}
