'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { islands, placeholderLabel } from '@/data/universe';
import { useUniverse } from '../../state/store';
import { clamp } from '../../world/vec';
import { world } from '../../world/world';
import { ACCENT, COLORS, hdr } from '../palette';
import { buildArchitectureModel, nodeExtent, type ArchitectureModel } from './architectureModel';
import { ArchitectureHologram, type ModelPose } from './ArchitectureHologram';
import { holoCopy, stationModelSpec, type HoloCopy } from './holoContent';
import { createFrameGeometry, createRaysGeometry } from './holoGeometry';
import { holoScale, narrowFit, PANEL } from './holoLayout';
import {
  createGlassMaterial,
  createLineMaterial,
  createRaysMaterial,
  HOLO_ORDER,
} from './holoMaterials';
import { HOLO_FONT, HoloText, SOLID, type TextMesh } from './HoloText';

/**
 * The display that materialises at a station. It opens from a thin line, shows
 * the current beat's copy beside a 3D model of the project, and on the
 * 'architecture' beat the model comes forward to fill the display while the text
 * recedes to a single header. Only one exists at a time, mounted on demand by
 * `StationsLayer`.
 */

const PADDING = 0.28;
const TEXT_WIDTH = 2.62;
const FOOTER_HEIGHT = 0.24;
const FOOTER_GAP = 0.14;

const OPEN_SECONDS = 0.62;
const CLOSE_SECONDS = 0.24;
/** The share of the scan-in spent drawing the line, before it opens. */
const LINE_SHARE = 0.34;
/** Squashed height at the very start of the scan-in: a line, not nothing. */
const LINE_THICKNESS = 0.008;
const EXPAND_RATE = 5.5;
const FADE_OUT_SECONDS = 0.13;
const FADE_IN_SECONDS = 0.3;
const DIVIDER_WIDTH = 0.62;

/** The model beside the text: the column it has to fit, and how much to turn it. */
const INSET = { centerX: 1.42, y: -0.06, z: 0.22, width: 2.74, maxScale: 0.62 };
const FULL_POSE: ModelPose = {
  position: [0.08, -0.18, 0.2],
  rotation: [0.07, 0],
  scale: 0.85,
};

const TITLE_COLOR = hdr(COLORS.white, 1.22);
const BODY_COLOR = hdr('#c6d3f2', 0.98);
const EYEBROW_COLOR = hdr(COLORS.cyan, 1.05);
const TAG_COLOR = hdr('#93a9e6', 0.95);
const WARN_COLOR = hdr(COLORS.amber, 1.25);

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Fits the boxes themselves to the column: the rail's labels are not shown at this size. */
function insetPose(model: ArchitectureModel): ModelPose {
  const { left, right } = nodeExtent(model);
  const scale = Math.min(INSET.maxScale, INSET.width / (right - left));
  return {
    position: [INSET.centerX - ((left + right) / 2) * scale, INSET.y, INSET.z],
    rotation: [0.2, -0.34],
    scale,
  };
}

function accentOf(stationId: string): string {
  const { islandId } = world.station(stationId);
  const island = islands.find((entry) => entry.id === islandId);
  return island ? ACCENT[island.accent] : COLORS.cyan;
}

interface StackEntry {
  object: THREE.Object3D;
  gap: number;
}

/**
 * Text lays out asynchronously and wraps, so the column is stacked from measured
 * heights. Returns the height used.
 */
function placeStack(entries: (StackEntry | undefined)[]): number {
  let y = 0;
  for (const entry of entries) {
    if (!entry) continue;
    y -= entry.gap;
    entry.object.position.y = y;
    const bounds = (entry.object as TextMesh).textRenderInfo?.blockBounds;
    if (bounds) y -= bounds[3] - bounds[1];
  }
  return -y;
}

interface PanelTextProps {
  copy: HoloCopy;
  accent: string;
  fade: RefObject<number>;
  width: number;
  /** Height available. A column taller than this scales down to fit. */
  room: number;
}

/** The full text column, for every beat but the architecture one. */
function PanelText({ copy, accent, fade, width, room }: PanelTextProps) {
  const column = useRef<THREE.Group>(null);
  const stack = useRef<(StackEntry | undefined)[]>([]);
  const kickerColor = useMemo(() => hdr(accent, 1.25), [accent]);
  const dividerMaterial = useMemo(() => createLineMaterial(accent, 2.6), [accent]);
  const dividerGeometry = useMemo(
    () => new THREE.PlaneGeometry(DIVIDER_WIDTH, 0.012).translate(DIVIDER_WIDTH / 2, 0, 0),
    [],
  );

  useEffect(
    () => () => {
      dividerGeometry.dispose();
      dividerMaterial.dispose();
    },
    [dividerGeometry, dividerMaterial],
  );
  useFrame(() => {
    const used = placeStack(stack.current);
    column.current?.scale.setScalar(Math.min(1, room / Math.max(used, 0.001)));
  });

  const slot = (index: number, gap: number) => (mesh: THREE.Mesh | null) => {
    stack.current[index] = mesh ? { object: mesh, gap } : undefined;
  };

  const noted = copy.lines.some((line) => line.note);
  const firstLine = 5;
  const tagsSlot = firstLine + copy.lines.length * 2;

  return (
    <group ref={column}>
      <HoloText
        onMesh={slot(0, 0)}
        fade={fade}
        font={HOLO_FONT.mono}
        fontSize={0.096}
        letterSpacing={0.16}
        color={EYEBROW_COLOR}
        anchorX="left"
        anchorY="top"
        maxWidth={width}
      >
        {copy.eyebrow.toUpperCase()}
      </HoloText>

      <HoloText
        onMesh={slot(1, 0.09)}
        fade={fade}
        font={HOLO_FONT.bold}
        fontSize={0.29}
        lineHeight={1.08}
        letterSpacing={-0.005}
        color={TITLE_COLOR}
        anchorX="left"
        anchorY="top"
        maxWidth={width}
      >
        {copy.title}
      </HoloText>

      <mesh
        ref={slot(2, 0.13)}
        geometry={dividerGeometry}
        material={dividerMaterial}
        renderOrder={HOLO_ORDER.text}
      />

      <HoloText
        onMesh={slot(3, 0.14)}
        fade={fade}
        font={HOLO_FONT.mono}
        fontSize={0.106}
        letterSpacing={0.14}
        color={kickerColor}
        anchorX="left"
        anchorY="top"
        maxWidth={width}
      >
        {copy.kicker.toUpperCase()}
      </HoloText>

      {copy.heading ? (
        <HoloText
          onMesh={slot(4, 0.07)}
          fade={fade}
          font={HOLO_FONT.semiBold}
          fontSize={0.172}
          lineHeight={1.16}
          color={TITLE_COLOR}
          anchorX="left"
          anchorY="top"
          maxWidth={width}
        >
          {copy.heading}
        </HoloText>
      ) : null}

      {copy.lines.map((line, index) => (
        <Fragment key={line.text}>
          <HoloText
            onMesh={slot(firstLine + index * 2, index === 0 ? 0.1 : noted ? 0.062 : 0.045)}
            fade={fade}
            font={noted ? HOLO_FONT.medium : HOLO_FONT.regular}
            fontSize={0.118}
            lineHeight={1.36}
            color={BODY_COLOR}
            anchorX="left"
            anchorY="top"
            maxWidth={width}
          >
            {copy.isList ? `›  ${line.text}` : line.text}
          </HoloText>
          {line.note ? (
            <HoloText
              onMesh={slot(firstLine + index * 2 + 1, 0.022)}
              fade={fade}
              font={HOLO_FONT.regular}
              fontSize={0.092}
              lineHeight={1.3}
              color={TAG_COLOR}
              position={[0.13, 0, 0]}
              anchorX="left"
              anchorY="top"
              maxWidth={width - 0.13}
            >
              {line.note}
            </HoloText>
          ) : null}
        </Fragment>
      ))}

      {copy.tags ? (
        <HoloText
          onMesh={slot(tagsSlot, 0.11)}
          fade={fade}
          font={HOLO_FONT.mono}
          fontSize={0.088}
          lineHeight={1.4}
          letterSpacing={0.04}
          color={TAG_COLOR}
          anchorX="left"
          anchorY="top"
          maxWidth={width}
        >
          {copy.tags}
        </HoloText>
      ) : null}
    </group>
  );
}

/** What is left of the text on the architecture beat: two lines above the model. */
function ModelHeader({ copy, accent, fade }: Omit<PanelTextProps, 'width' | 'room'>) {
  const kickerColor = useMemo(() => hdr(accent, 1.25), [accent]);
  const label = copy.heading ? `${copy.kicker} · ${copy.heading}` : copy.kicker;

  return (
    <>
      <HoloText
        fade={fade}
        font={HOLO_FONT.mono}
        fontSize={0.088}
        letterSpacing={0.14}
        color={kickerColor}
        anchorX="left"
        anchorY="top"
      >
        {label.toUpperCase()}
      </HoloText>
      <HoloText
        fade={fade}
        font={HOLO_FONT.bold}
        fontSize={0.21}
        letterSpacing={-0.003}
        color={TITLE_COLOR}
        position={[0, -0.135, 0]}
        anchorX="left"
        anchorY="top"
      >
        {copy.title}
      </HoloText>
    </>
  );
}

interface PageMarksProps {
  page: number;
  pages: number;
  accent: string;
}

function PageMarks({ page, pages, accent }: PageMarksProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const size = 0.24;
  const gap = 0.045;
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    const lit = hdr(accent, 2.6);
    const dim = new THREE.Color(COLORS.metalLight);

    for (let index = 0; index < pages; index += 1) {
      matrix.makeTranslation(index * (size + gap) + size / 2, 0, 0);
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, index < page ? lit : dim);
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [page, pages, accent]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, material, pages]}
        renderOrder={HOLO_ORDER.text}
        frustumCulled={false}
      >
        <planeGeometry args={[size, 0.02]} />
      </instancedMesh>
      <HoloText
        fade={SOLID}
        font={HOLO_FONT.mono}
        fontSize={0.084}
        letterSpacing={0.08}
        color={TAG_COLOR}
        position={[pages * (size + gap) + 0.07, 0, 0]}
        anchorX="left"
      >
        {`${String(page).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`}
      </HoloText>
    </>
  );
}

interface HologramProps {
  stationId: string;
  /** False while it should scan out. It stays mounted until `onClosed`. */
  open: boolean;
  onClosed: () => void;
}

export default function Hologram({ stationId, open, onClosed }: HologramProps) {
  const anchor = world.station(stationId);
  const briefing = useMemo(() => world.briefing(stationId), [stationId]);
  const accent = useMemo(() => accentOf(stationId), [stationId]);
  const model = useMemo(() => {
    const spec = stationModelSpec(anchor.content, briefing);
    return spec ? buildArchitectureModel(spec) : null;
  }, [anchor, briefing]);

  const inset = useMemo(() => (model ? insetPose(model) : null), [model]);

  const width = model ? PANEL.widthWithModel : PANEL.widthTextOnly;
  const height = PANEL.height;
  const aspect = useThree((state) => state.size.width / state.size.height);
  const scale = holoScale(anchor) * narrowFit(aspect);
  const textWidth = model ? TEXT_WIDTH : width - PADDING * 2;

  const liveBeat = useUniverse((state) => (state.active === stationId ? state.beat : null));
  const reducedMotion = useUniverse((state) => state.reducedMotion);

  /* The copy on show lags the store by a fade, so a page turn never swaps text in plain view. */
  const [beat, setBeat] = useState(0);
  const wantedBeat = useRef(0);
  useEffect(() => {
    if (liveBeat !== null) wantedBeat.current = liveBeat;
  }, [liveBeat]);

  const copy = useMemo(() => holoCopy(briefing, beat, model === null), [briefing, beat, model]);
  const architectureShowing = Boolean(briefing.beats[beat]?.architecture);

  const display = useRef<THREE.Group>(null);
  const reveal = useRef(0);
  const expand = useRef(0);
  const textFade = useRef(0);
  const clock = useRef(0);
  const closed = useRef(false);

  const frame = useMemo(() => createFrameGeometry(width, height, PANEL.radius), [width, height]);
  const rays = useMemo(
    () =>
      createRaysGeometry(
        width * scale,
        (-height / 2) * scale,
        Math.hypot(anchor.pad.x - anchor.holo.x, anchor.pad.z - anchor.holo.z) - 0.8,
        anchor.pad.y + 0.08 - anchor.holo.y,
      ),
    [width, height, scale, anchor],
  );
  const glassMaterial = useMemo(
    () => createGlassMaterial(width, height, PANEL.radius),
    [width, height],
  );
  const raysMaterial = useMemo(createRaysMaterial, []);
  const frameMaterial = useMemo(() => createLineMaterial(COLORS.cyan, 2.8), []);

  useEffect(
    () => () => {
      frame.dispose();
      rays.dispose();
      glassMaterial.dispose();
      raysMaterial.dispose();
      frameMaterial.dispose();
    },
    [frame, rays, glassMaterial, raysMaterial, frameMaterial],
  );

  useFrame((_, delta) => {
    const group = display.current;
    if (!group) return;

    const step = Math.min(delta, 0.05);
    if (!reducedMotion) clock.current += step;

    /* Scan in and out. */
    const rate = open ? step / OPEN_SECONDS : -step / CLOSE_SECONDS;
    const settled = open ? 1 : 0;
    reveal.current = reducedMotion ? settled : clamp(reveal.current + rate, 0, 1);

    if (open) {
      closed.current = false;
    } else if (reveal.current === 0 && !closed.current) {
      closed.current = true;
      onClosed();
      return;
    }

    const line = smooth(clamp(reveal.current / LINE_SHARE, 0, 1));
    const rise = smooth(clamp((reveal.current - LINE_SHARE) / (1 - LINE_SHARE), 0, 1));
    group.visible = reveal.current > 0;
    group.scale.set(Math.max(line, 0.001) * scale, Math.max(rise, LINE_THICKNESS) * scale, scale);

    /* Page turns: fade the old copy out, swap, fade the new copy in. */
    const beatPending = open && wantedBeat.current !== beat;
    const fadeStep = beatPending ? -step / FADE_OUT_SECONDS : step / FADE_IN_SECONDS;
    textFade.current = clamp(textFade.current + fadeStep, 0, 1);
    if (reducedMotion) textFade.current = 1;
    if (beatPending && (textFade.current === 0 || reducedMotion)) setBeat(wantedBeat.current);

    /* The architecture beat: the model comes forward and fills the display. */
    const expandGoal = architectureShowing ? 1 : 0;
    expand.current = reducedMotion
      ? expandGoal
      : expand.current + (expandGoal - expand.current) * (1 - Math.exp(-step * EXPAND_RATE));

    const glassUniforms = glassMaterial.uniforms;
    (glassUniforms.uTime as THREE.IUniform<number>).value = clock.current;
    (glassUniforms.uBoost as THREE.IUniform<number>).value = (1 - rise) * 0.22;
    (raysMaterial.uniforms.uStrength as THREE.IUniform<number>).value = rise * 0.16;
  });

  const left = -width / 2 + PADDING;
  const right = width / 2 - PADDING;
  const top = height / 2 - PADDING + 0.02;
  const bottom = -height / 2 + FOOTER_HEIGHT;

  return (
    <group position={[anchor.holo.x, anchor.holo.y, anchor.holo.z]} rotation-y={anchor.holoYaw}>
      <group ref={display} visible={false}>
        <mesh material={glassMaterial} renderOrder={HOLO_ORDER.glass}>
          <planeGeometry args={[width, height]} />
        </mesh>
        <mesh geometry={frame} material={frameMaterial} renderOrder={HOLO_ORDER.frame} />

        <group position={[left, top, 0.02]}>
          {architectureShowing ? (
            <ModelHeader copy={copy} accent={accent} fade={textFade} />
          ) : (
            <PanelText
              copy={copy}
              accent={accent}
              fade={textFade}
              width={textWidth}
              room={top - bottom - FOOTER_GAP}
            />
          )}
        </group>

        <group position={[left, bottom, 0.02]}>
          <PageMarks page={copy.page} pages={copy.pages} accent={accent} />
        </group>

        {briefing.placeholder ? (
          <HoloText
            fade={SOLID}
            font={HOLO_FONT.mono}
            fontSize={0.084}
            letterSpacing={0.14}
            color={WARN_COLOR}
            position={[right, bottom, 0.02]}
            anchorX="right"
          >
            {placeholderLabel.toUpperCase()}
          </HoloText>
        ) : null}

        {model && inset ? (
          <ArchitectureHologram
            model={model}
            expand={expand}
            inset={inset}
            full={FULL_POSE}
            captionAt={[right, top - 0.04, 0.02]}
          />
        ) : null}
      </group>

      <mesh geometry={rays} material={raysMaterial} renderOrder={HOLO_ORDER.rays} />
    </group>
  );
}
