'use client';

import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { islands } from '@/data/universe';
import { useUniverse } from '../../state/store';
import { WORLD } from '../../world/network';
import { world } from '../../world/world';
import { ACCENT, COLORS } from '../palette';
import {
  createPadGeometry,
  createPadGlowGeometry,
  createPadGlowMaterial,
  createPadMaterial,
  PAD_LIFT,
} from './padMeshes';

/** Pointer travel in pixels above which a press is a drag rather than a click. */
const DRAG_PIXELS = 4;
const VISIT_SECONDS = 1.4;
const FOCUS_RATE = 8;

function stationRadius(islandId: string | null): number {
  return islandId === null ? WORLD.corePadRadius : WORLD.padRadius;
}

function stationTint(islandId: string | null): THREE.Color {
  const island = islands.find((entry) => entry.id === islandId);
  return new THREE.Color(island ? ACCENT[island.accent] : COLORS.cyan);
}

/** A stable per-pad offset in 0–1, so that pads do not pulse in step. */
function padSeed(index: number): number {
  return (index * 0.618034) % 1;
}

interface StationPadsProps {
  /** The station of the pad under the pointer, for the beacon to name. */
  hovered: RefObject<string | null>;
}

export function StationPads({ hovered }: StationPadsProps) {
  const count = world.stations.length;
  const discRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  const visited = useUniverse((state) => state.visited);
  const near = useUniverse((state) => state.near);
  const reducedMotion = useUniverse((state) => state.reducedMotion);

  const hoveredPad = useRef<number | null>(null);
  const clock = useRef(0);

  const discGeometry = useMemo(createPadGeometry, []);
  const discMaterial = useMemo(createPadMaterial, []);
  const glowMaterial = useMemo(createPadGlowMaterial, []);

  const { glowGeometry, state } = useMemo(() => {
    const geometry = createPadGlowGeometry();
    const tints = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const stateAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    stateAttribute.setUsage(THREE.DynamicDrawUsage);

    world.stations.forEach((station, index) => {
      stationTint(station.islandId).toArray(tints, index * 3);
      seeds[index] = padSeed(index);
    });

    geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aState', stateAttribute);
    return { glowGeometry: geometry, state: stateAttribute };
  }, [count]);

  const targets = useRef(new Float32Array(count * 2));

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    world.stations.forEach((station, index) => {
      const radius = stationRadius(station.islandId);
      position.set(station.pad.x, station.pad.y + PAD_LIFT, station.pad.z);
      scale.set(radius, 1, radius);
      matrix.compose(position, rotation, scale);
      discRef.current?.setMatrixAt(index, matrix);
      glowRef.current?.setMatrixAt(index, matrix);
    });

    for (const mesh of [discRef.current, glowRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);

  /* A pad already visited on arrival shows green at once, with no celebration. */
  const settled = useRef(false);

  useEffect(() => {
    world.stations.forEach((station, index) => {
      const seen = visited.includes(station.id) ? 1 : 0;
      targets.current[index * 2] = seen;
      if (!settled.current) state.setX(index, seen);
    });
    state.needsUpdate = true;
    settled.current = true;
  }, [visited, state]);

  useEffect(() => {
    world.stations.forEach((station, index) => {
      targets.current[index * 2 + 1] = station.id === near || index === hoveredPad.current ? 1 : 0;
    });
  }, [near]);

  useEffect(
    () => () => {
      discGeometry.dispose();
      discMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
    },
    [discGeometry, discMaterial, glowGeometry, glowMaterial],
  );

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    if (!reducedMotion) clock.current += step;
    (glowMaterial.uniforms.uTime as THREE.IUniform<number>).value = clock.current;

    const focusEase = 1 - Math.exp(-step * FOCUS_RATE);
    const goals = targets.current;
    let changed = false;

    for (let index = 0; index < count; index += 1) {
      const visit = state.getX(index);
      const visitGoal = goals[index * 2] as number;
      if (visit !== visitGoal) {
        const move = reducedMotion ? 1 : step / VISIT_SECONDS;
        const next =
          visit < visitGoal ? Math.min(visitGoal, visit + move) : Math.max(visitGoal, visit - move);
        state.setX(index, next);
        changed = true;
      }

      const focus = state.getY(index);
      const focusGoal = goals[index * 2 + 1] as number;
      if (Math.abs(focus - focusGoal) > 0.002) {
        state.setY(index, focus + (focusGoal - focus) * focusEase);
        changed = true;
      } else if (focus !== focusGoal) {
        state.setY(index, focusGoal);
        changed = true;
      }
    }

    if (changed) state.needsUpdate = true;
  });

  const setHovered = useCallback(
    (index: number | null) => {
      const { near: standingOn } = useUniverse.getState();
      hoveredPad.current = index;
      hovered.current = index === null ? null : (world.stations[index]?.id ?? null);
      world.stations.forEach((station, entry) => {
        targets.current[entry * 2 + 1] = station.id === standingOn || entry === index ? 1 : 0;
      });
      document.body.style.cursor = index === null ? '' : 'pointer';
    },
    [hovered],
  );

  const onClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.delta > DRAG_PIXELS || event.instanceId === undefined) return;
    const station = world.stations[event.instanceId];
    if (!station) return;
    event.stopPropagation();
    useUniverse.getState().travelTo(station.id);
  }, []);

  const onPointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.instanceId === undefined) return;
      event.stopPropagation();
      setHovered(event.instanceId);
    },
    [setHovered],
  );

  const onPointerOut = useCallback(() => setHovered(null), [setHovered]);

  useEffect(() => () => setHovered(null), [setHovered]);

  return (
    <>
      <instancedMesh
        ref={discRef}
        args={[discGeometry, discMaterial, count]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      <instancedMesh
        ref={glowRef}
        args={[glowGeometry, glowMaterial, count]}
        frustumCulled={false}
        raycast={() => null}
      />
    </>
  );
}
