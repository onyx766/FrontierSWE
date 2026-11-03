'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse } from '../../state/store';
import { getIslandAssets, soupGeometry } from './islandAssets';
import { getIslandPlans } from './islandPlan';
import { buildShardRock, layOutShards, type ShardPlacement } from './rockGeometry';

/** The drift is so slow that twenty updates a second is indistinguishable from sixty. */
const UPDATE_INTERVAL = 1 / 20;

const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const axis = new THREE.Vector3();
const matrix = new THREE.Matrix4();

function writeShards(mesh: THREE.InstancedMesh, shards: ShardPlacement[], time: number): void {
  shards.forEach((shard, index) => {
    position.set(
      shard.position.x,
      shard.position.y + Math.sin(time * shard.bob + shard.phase) * 0.7,
      shard.position.z,
    );
    axis.set(shard.axis.x, shard.axis.y, shard.axis.z);
    rotation.setFromAxisAngle(axis, shard.angle + time * shard.tumble);
    scale.set(shard.scale.x, shard.scale.y, shard.scale.z);
    mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** Rocks broken off the islands, tumbling slowly in the space beneath them. */
export function IslandShards() {
  const gl = useThree((state) => state.gl);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef({ time: 0, sinceUpdate: 0 });

  const shards = useMemo(() => getIslandPlans().flatMap(layOutShards), []);
  const geometry = useMemo(
    () => soupGeometry(buildShardRock(), { surface: true, glow: true }),
    [],
  );
  const material = useMemo(() => getIslandAssets(gl).rockMaterial, [gl]);

  useLayoutEffect(() => {
    if (mesh.current) writeShards(mesh.current, shards, 0);
  }, [shards]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    const { reducedMotion, quality } = useUniverse.getState();
    if (!instanced) return;

    instanced.count = quality === 'low' ? Math.floor(shards.length / 2) : shards.length;
    if (reducedMotion) return;

    const state = clock.current;
    state.time += delta;
    state.sinceUpdate += delta;
    if (state.sinceUpdate < UPDATE_INTERVAL) return;

    state.sinceUpdate = 0;
    writeShards(instanced, shards, state.time);
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, shards.length]}
      frustumCulled={false}
    />
  );
}
