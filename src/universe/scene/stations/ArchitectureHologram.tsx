'use client';

import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useUniverse } from '../../state/store';
import type { Vec3 } from '../../world/vec';
import { getKit } from '../kit';
import { COLORS, hdr } from '../palette';
import {
  MODEL,
  nodeLabelSize,
  routePoint,
  sampleRoute,
  type ArchitectureModel,
  type ModelNode,
  type RouteSample,
} from './architectureModel';
import { createNodesGeometry, createWiresGeometry } from './holoGeometry';
import {
  createNodeMaterial,
  createWireMaterial,
  HOLO_ORDER,
  MAX_MODEL_NODES,
} from './holoMaterials';
import { HOLO_FONT, HoloText, SOLID } from './HoloText';

/**
 * A project's architecture as a real object inside the hologram: one row per
 * layer, a glass box per node, glowing wires for the edges, and a packet of light
 * walking the first request path, lighting up each node it reaches.
 */

export interface ModelPose {
  position: [number, number, number];
  rotation: [number, number];
  scale: number;
}

interface ArchitectureHologramProps {
  model: ArchitectureModel;
  /** 0 for the inset, 1 when the model fills the display. */
  expand: RefObject<number>;
  inset: ModelPose;
  full: ModelPose;
  /** Where the route caption goes, in panel space. */
  captionAt: [number, number, number];
}

/** Rows come forward as they descend, so the lowest labels need room from the edge. */
const RAIL_INSET = 0.1;
const HEAT_RATE = 2.3;
const SWAY_RADIANS = 0.05;
const SWAY_RATE = 0.42;
const LABEL_COLOR = hdr(COLORS.white, 1.14);
const DETAIL_COLOR = hdr('#a9bcff', 1);
const RAIL_COLOR = hdr(COLORS.cyan, 0.85);
const CAPTION_COLOR = hdr(COLORS.amber, 1.2);

function nodeTextZ(node: ModelNode): number {
  return node.z + node.depth / 2 + 0.012;
}

function NodeLabel({
  node,
  detailFade,
  details,
}: {
  node: ModelNode;
  detailFade: RefObject<number>;
  details: boolean;
}) {
  const size = nodeLabelSize(node);
  const detail = details ? node.detail : undefined;
  const lifted = detail ? 0.055 : 0;

  return (
    <>
      <HoloText
        fade={SOLID}
        font={HOLO_FONT.medium}
        fontSize={size}
        color={LABEL_COLOR}
        position={[node.x, node.y + lifted, nodeTextZ(node)]}
        maxWidth={node.width - 0.06}
        textAlign="center"
      >
        {node.label}
      </HoloText>
      {detail ? (
        <HoloText
          fade={detailFade}
          font={HOLO_FONT.mono}
          fontSize={Math.min(size * 0.72, 0.094)}
          color={DETAIL_COLOR}
          opacity={0.85}
          position={[node.x, node.y - 0.095, nodeTextZ(node)]}
          maxWidth={node.width - 0.06}
          textAlign="center"
        >
          {detail}
        </HoloText>
      ) : null}
    </>
  );
}

/** Everything written on the model. Static, so it re-renders only when the model changes. */
const ModelLabels = memo(function ModelLabels({
  model,
  detailFade,
  details,
}: {
  model: ArchitectureModel;
  /** Rail names and details are only legible once the model fills the display. */
  detailFade: RefObject<number>;
  /** Each line of text is a draw call, so a struggling GPU keeps only the node names. */
  details: boolean;
}) {
  return (
    <>
      {model.rows.map((row, index) =>
        row.label && details ? (
          <HoloText
            key={index}
            fade={detailFade}
            font={HOLO_FONT.mono}
            fontSize={0.09}
            letterSpacing={0.1}
            color={RAIL_COLOR}
            position={[-MODEL.width / 2 + RAIL_INSET, row.y, row.z]}
            anchorX="left"
          >
            {row.label.toUpperCase()}
          </HoloText>
        ) : null,
      )}
      {model.nodes.map((node) => (
        <NodeLabel
          key={node.id}
          node={node}
          detailFade={detailFade}
          details={details}
        />
      ))}
    </>
  );
});

/**
 * Names the path, the node the packet has reached and the wire it came along, so
 * each hop explains itself as it happens. Re-renders only when that changes.
 */
function RouteCaption({
  model,
  stop,
  fade,
  position,
}: {
  model: ArchitectureModel;
  stop: number;
  fade: RefObject<number>;
  position: [number, number, number];
}) {
  const route = model.route;
  if (!route) return null;
  const node = model.nodes.find((entry) => entry.id === route.stops[stop]);
  const arrival = route.arrivals[stop];
  const place = arrival ? `${node?.label} · ${arrival}` : (node?.label ?? '');

  return (
    <HoloText
      fade={fade}
      font={HOLO_FONT.mono}
      fontSize={0.088}
      letterSpacing={0.1}
      color={CAPTION_COLOR}
      position={position}
      anchorX="right"
    >
      {`${route.label}  ›  ${place}`.toUpperCase()}
    </HoloText>
  );
}

export function ArchitectureHologram({
  model,
  expand,
  inset,
  full,
  captionAt,
}: ArchitectureHologramProps) {
  const group = useRef<THREE.Group>(null);
  const packet = useRef<THREE.Sprite>(null);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);

  const wires = useMemo(() => createWiresGeometry(model), [model]);
  const nodes = useMemo(() => createNodesGeometry(model), [model]);
  const wireMaterial = useMemo(createWireMaterial, []);
  const nodeMaterial = useMemo(createNodeMaterial, []);
  const packetMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getKit().glowTexture,
        color: hdr(COLORS.amber, 5),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const [stop, setStop] = useState(0);
  const clock = useRef(0);
  const shownStop = useRef(0);
  const sample = useRef<RouteSample>({ length: 0, stop: 0, progress: 0 });
  const point = useRef<Vec3>({ x: 0, y: 0, z: 0 });

  /* Which entry of `uHeat` each route stop lights. */
  const stopNodes = useMemo(
    () => (model.route?.stops ?? []).map((id) => model.nodes.findIndex((node) => node.id === id)),
    [model],
  );

  useEffect(
    () => () => {
      wires.dispose();
      nodes.dispose();
      wireMaterial.dispose();
      nodeMaterial.dispose();
      packetMaterial.dispose();
    },
    [wires, nodes, wireMaterial, nodeMaterial, packetMaterial],
  );

  useFrame((_, delta) => {
    const mesh = group.current;
    if (!mesh) return;

    const step = Math.min(delta, 0.05);
    if (!reducedMotion) clock.current += step;
    const time = clock.current;
    const amount = expand.current;

    const sway = reducedMotion
      ? 0
      : Math.sin(time * SWAY_RATE) * SWAY_RADIANS * (1 - amount * 0.55);
    mesh.position.set(
      THREE.MathUtils.lerp(inset.position[0], full.position[0], amount),
      THREE.MathUtils.lerp(inset.position[1], full.position[1], amount),
      THREE.MathUtils.lerp(inset.position[2], full.position[2], amount),
    );
    mesh.rotation.set(
      THREE.MathUtils.lerp(inset.rotation[0], full.rotation[0], amount),
      THREE.MathUtils.lerp(inset.rotation[1], full.rotation[1], amount) + sway,
      0,
    );
    mesh.scale.setScalar(THREE.MathUtils.lerp(inset.scale, full.scale, amount));

    const wireUniforms = wireMaterial.uniforms;
    (wireUniforms.uTime as THREE.IUniform<number>).value = time;

    const heat = (nodeMaterial.uniforms.uHeat as THREE.IUniform<Float32Array>).value;
    const route = model.route;

    if (!route) return;

    if (reducedMotion) {
      /* No moving light: show the whole path at once instead. */
      (wireUniforms.uHead as THREE.IUniform<number>).value = route.length;
      for (const index of stopNodes) if (index >= 0) heat[index] = 0.5;
      if (packet.current) packet.current.visible = false;
      return;
    }

    sampleRoute(route, time, sample.current);
    routePoint(route, sample.current.length, point.current);
    (wireUniforms.uHead as THREE.IUniform<number>).value = sample.current.length;

    const cool = Math.exp(-step * HEAT_RATE);
    for (let index = 0; index < MAX_MODEL_NODES; index += 1) {
      heat[index] = (heat[index] as number) * cool;
    }

    const reached = sample.current.stop;
    const node = stopNodes[reached] ?? -1;
    if (node >= 0) heat[node] = Math.max(heat[node] as number, 1);

    if (packet.current) {
      const { x, y, z } = point.current;
      packet.current.position.set(x, y, z + 0.02);
    }

    if (reached !== shownStop.current) {
      shownStop.current = reached;
      setStop(reached);
    }
  });

  return (
    <>
      <group ref={group}>
        <mesh geometry={wires} material={wireMaterial} renderOrder={HOLO_ORDER.wires} />
        <mesh geometry={nodes} material={nodeMaterial} renderOrder={HOLO_ORDER.nodes} />
        <ModelLabels
          model={model}
          detailFade={expand}
          details={quality !== 'low'}
        />
        {model.route ? (
          <sprite
            ref={packet}
            material={packetMaterial}
            scale={[0.46, 0.46, 1]}
            renderOrder={HOLO_ORDER.packet}
          />
        ) : null}
      </group>
      <RouteCaption model={model} stop={stop} fade={expand} position={captionAt} />
    </>
  );
}
