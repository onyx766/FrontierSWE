'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse } from '@/universe/state/store';
import { world } from '@/universe/world/world';
import { getKit } from '../kit';
import { buildRoads } from './buildRoads';
import { Glows } from './Glows';
import { getRoadMaterials, stripPixelFor, toGeometry, type RoadMaterials } from './materials';
import {
  DECK_FAMILIES,
  type DeckFamily,
  type GlowPlacement,
  type PostPlacement,
} from './roadTypes';
import { addBeam, MeshBuffer } from './sweep';
import { Traffic } from './Traffic';

/**
 * Every road in the world, generated from `world.network`. Static geometry is
 * merged per material, so the network costs a handful of draw calls; see
 * `buildRoads.ts` for what goes where.
 */

/** Seconds for a pulse to travel one flow tile. */
const FLOW_PERIOD = 4.5;

interface RoadAssets {
  decks: Record<DeckFamily, THREE.BufferGeometry>;
  hull: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
  decals: THREE.BufferGeometry;
  plates: THREE.BufferGeometry;
  posts: PostPlacement[];
  glows: GlowPlacement[];
  materials: RoadMaterials;
}

let assets: RoadAssets | null = null;

function getAssets(anisotropy: number): RoadAssets {
  if (assets) return assets;
  const build = buildRoads(world.network, world.surface);
  const decks = Object.fromEntries(
    DECK_FAMILIES.map((family) => [family, toGeometry(build.decks[family], true)]),
  ) as Record<DeckFamily, THREE.BufferGeometry>;

  assets = {
    decks,
    hull: toGeometry(build.hull, true),
    lights: toGeometry(build.lights, false),
    decals: toGeometry(build.decals, false),
    plates: toGeometry(build.plates, true),
    posts: build.posts,
    glows: build.glows,
    materials: getRoadMaterials(anisotropy),
  };
  return assets;
}

/** A rail post: a tapered stem on a small foot, unit height. */
function postGeometry(): THREE.BufferGeometry {
  const buffer = new MeshBuffer();
  const tile = { tile: 1 };
  const up = { x: 0, y: 0, z: 1 };
  addBeam(buffer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0.08, z: 0 }, 0.15, 0.2, { ...tile, up, taper: 0.8 });
  addBeam(buffer, { x: 0, y: 0.06, z: 0 }, { x: 0, y: 1, z: 0 }, 0.05, 0.085, {
    ...tile,
    up,
    taper: 0.62,
    caps: true,
  });
  return toGeometry(buffer, true);
}

function Posts({ posts }: { posts: readonly PostPlacement[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(postGeometry, []);
  const material = getKit().metal;

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    posts.forEach((post, index) => {
      dummy.position.set(post.x, post.y, post.z);
      dummy.rotation.set(0, post.yaw, 0);
      dummy.scale.set(1, post.height, 1);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [posts]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, posts.length]}
      frustumCulled={false}
    />
  );
}

export default function RoadsLayer() {
  const gl = useThree((state) => state.gl);
  const { decks, hull, lights, decals, plates, posts, glows, materials } = useMemo(
    () => getAssets(Math.min(8, gl.capabilities.getMaxAnisotropy())),
    [gl],
  );
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);

  const height = useThree((state) => state.size.height * state.viewport.dpr);
  useLayoutEffect(() => {
    materials.stripPixel.value = stripPixelFor(height);
  }, [materials, height]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const offset = materials.flow.offset;
    offset.y = (offset.y - Math.min(delta, 0.1) / FLOW_PERIOD) % 1;
  });

  return (
    <group>
      {DECK_FAMILIES.map((family) => (
        <mesh
          key={family}
          geometry={decks[family]}
          material={materials.decks[family]}
          frustumCulled={false}
        />
      ))}
      <mesh geometry={hull} material={materials.hull} frustumCulled={false} />
      <mesh geometry={plates} material={materials.plates} frustumCulled={false} />
      <mesh geometry={lights} material={materials.lights} frustumCulled={false} />
      <mesh geometry={decals} material={materials.decals} frustumCulled={false} renderOrder={1} />
      {quality !== 'low' ? <Posts posts={posts} /> : null}
      <Glows glows={glows} />
      <Traffic />
    </group>
  );
}
