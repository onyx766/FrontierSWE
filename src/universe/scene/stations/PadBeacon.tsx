'use client';

import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse } from '../../state/store';
import { clamp } from '../../world/vec';
import { world } from '../../world/world';
import { COLORS, hdr } from '../palette';
import { createGlassMaterial, HOLO_ORDER } from './holoMaterials';
import { HOLO_FONT, type TextMesh } from './HoloText';

/**
 * The name floating above a pad, so that a visitor can tell what a stop is before
 * walking onto it: a small tag in the same glass as the hologram. One at a time,
 * chosen in `StationsLayer`.
 */

const BEACON_HEIGHT = 3.4;
/** Held constant on screen, so the name is as readable from afar as from beside it. */
const FONT_PIXELS = 20;
const PADDING_X = 0.75;
const PADDING_Y = 0.42;
const PLATE_RADIUS = 0.34;
const OPEN_SECONDS = 0.2;
/** Squashed height at either end of the scan: a line, not nothing. */
const LINE_THICKNESS = 0.02;
const COLOR = hdr(COLORS.white, 1.16);

interface PadBeaconProps {
  stationId: string;
  /** False while it should scan away. It stays mounted until `onClosed`. */
  open: boolean;
  onClosed: () => void;
}

export default function PadBeacon({ stationId, open, onClosed }: PadBeaconProps) {
  const anchor = world.station(stationId);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const group = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Mesh>(null);
  const reveal = useRef(0);
  const closed = useRef(false);

  /* Drawn over everything: a name hidden behind the thing it names is no use. */
  const textMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );
  const glassMaterial = useMemo(() => {
    const material = createGlassMaterial(1, 1, PLATE_RADIUS);
    material.depthTest = false;
    return material;
  }, []);

  useEffect(
    () => () => {
      textMaterial.dispose();
      glassMaterial.dispose();
    },
    [textMaterial, glassMaterial],
  );

  const fitPlate = useCallback(
    (mesh: THREE.Mesh) => {
      const bounds = (mesh as TextMesh).textRenderInfo?.blockBounds;
      if (!bounds) return;
      const width = bounds[2] - bounds[0] + PADDING_X * 2;
      const height = bounds[3] - bounds[1] + PADDING_Y * 2;
      plate.current?.scale.set(width, height, 1);
      (glassMaterial.uniforms.uSize as THREE.IUniform<THREE.Vector2>).value.set(width, height);
    },
    [glassMaterial],
  );

  useFrame(({ camera, size }, delta) => {
    const root = group.current;
    if (!root) return;

    const step = Math.min(delta, 0.05) / OPEN_SECONDS;
    const settled = open ? 1 : 0;
    reveal.current = reducedMotion
      ? settled
      : clamp(reveal.current + (open ? step : -step), 0, 1);

    if (open) {
      closed.current = false;
    } else if (reveal.current === 0 && !closed.current) {
      closed.current = true;
      onClosed();
      return;
    }

    root.quaternion.copy(camera.quaternion);

    const { fov } = camera as THREE.PerspectiveCamera;
    const distance = root.position.distanceTo(camera.position);
    const frameHeight = 2 * Math.tan((fov * Math.PI) / 360) * distance;
    const scale = (frameHeight / size.height) * FONT_PIXELS;
    root.scale.set(scale, scale * Math.max(reveal.current, LINE_THICKNESS), scale);
  });

  return (
    <group ref={group} position={[anchor.pad.x, anchor.pad.y + BEACON_HEIGHT, anchor.pad.z]}>
      <mesh ref={plate} material={glassMaterial} renderOrder={HOLO_ORDER.packet + 1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <Text
        material={textMaterial}
        font={HOLO_FONT.medium}
        fontSize={1}
        color={COLOR}
        onSync={fitPlate}
        renderOrder={HOLO_ORDER.packet + 2}
      >
        {anchor.title}
      </Text>
    </group>
  );
}
