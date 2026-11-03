'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useUniverse } from '../../../state/store';
import { getKit } from '../../kit';
import { COLORS } from '../../palette';
import {
  chamferedBox,
  floorGlowGeometry,
  getHardware,
  mergeParts,
  pipe,
  placed,
  rackFaces,
  rackUv,
  vertexColor,
  type RackRegion,
} from './hardware';

/**
 * The Backend Engine: a tight cluster of server racks of varied heights, faces
 * packed with light, lids catching the sky. Everything draws from the one rack
 * atlas, so the whole island is one merged body plus its glow.
 *
 * The footprint is limited by the loop road, so where the reference spreads the
 * racks wide these stand tall and close: the same crowded skyline in less room.
 */

interface Rack {
  x: number;
  z: number;
  /** Radians. Racks share a heading, loosely, like machines bolted to one floor. */
  yaw: number;
  width: number;
  depth: number;
  height: number;
  faces: readonly [RackRegion, RackRegion, RackRegion, RackRegion];
  lid: RackRegion;
}

/**
 * The racks stand on a grid turned off the opening camera, so each shows it two
 * faces with an edge between them, as in the reference. Positions were checked
 * against each other and against `islandPropReach` with the lids included.
 */
const HEADING = -0.66;
const PLINTH = 0.32;

/** Faces are front, right, back, left. The opening camera sees each rack's front and right. */
const RACKS: readonly Rack[] = [
  {
    x: -1.15,
    z: -1.75,
    yaw: HEADING,
    width: 5,
    depth: 4.5,
    height: 12.6,
    faces: ['blades', 'display', 'service', 'bays'],
    lid: 'lidLit',
  },
  {
    x: -5.3,
    z: 0.63,
    yaw: HEADING + 0.015,
    width: 3.7,
    depth: 3.5,
    height: 10.2,
    faces: ['blades', 'bays', 'service', 'bays'],
    lid: 'lidLit',
  },
  {
    x: 4.6,
    z: -1.12,
    yaw: HEADING - 0.015,
    width: 3.9,
    depth: 3.6,
    height: 8.8,
    faces: ['blades', 'bays', 'service', 'blades'],
    lid: 'lidLit',
  },
  {
    x: 1.88,
    z: 2.1,
    yaw: HEADING,
    width: 3.9,
    depth: 3.7,
    height: 9.4,
    faces: ['blades', 'bays', 'service', 'display'],
    lid: 'lidLit',
  },
  {
    x: 2.09,
    z: -4.32,
    yaw: HEADING,
    width: 2.9,
    depth: 2.7,
    height: 8.8,
    faces: ['service', 'bays', 'service', 'blades'],
    lid: 'lidVent',
  },
  {
    x: -3.8,
    z: 4.9,
    yaw: HEADING + 0.02,
    width: 2.7,
    depth: 2.6,
    height: 7,
    faces: ['blades', 'bays', 'service', 'service'],
    lid: 'lidLit',
  },
  {
    x: 5.25,
    z: 3.42,
    yaw: HEADING - 0.02,
    width: 2.2,
    depth: 2,
    height: 4.8,
    faces: ['service', 'bays', 'service', 'service'],
    lid: 'lidVent',
  },
];

const BODY_COLOR = new THREE.Color('#ffffff');

type Shade = (point: THREE.Vector3, out: THREE.Color) => void;

/** Sink each rack's foot into shadow, so it stands in the deck rather than on it. */
function contactShade(baseY: number): Shade {
  return (point, out) => {
    const lift = THREE.MathUtils.smoothstep(point.y, baseY, baseY + 2.6);
    out.copy(BODY_COLOR).multiplyScalar(0.38 + 0.62 * lift);
  };
}

/** Square posts at a rack's corners, standing just proud of its faces. */
function rackPosts(rack: Rack, bodyHeight: number, shade: Shade): THREE.BufferGeometry[] {
  const faces = rackFaces({ front: 'plain', back: 'plain', left: 'plain', right: 'plain' });
  const cos = Math.cos(rack.yaw);
  const sin = Math.sin(rack.yaw);
  const posts: THREE.BufferGeometry[] = [];

  for (const across of [-1, 1]) {
    for (const along of [-1, 1]) {
      const localX = across * (rack.width / 2 - 0.08);
      const localZ = along * (rack.depth / 2 - 0.08);
      posts.push(
        vertexColor(
          placed(
            chamferedBox(0.32, bodyHeight, 0.32, 0.05, faces),
            rack.x + localX * cos + localZ * sin,
            PLINTH + bodyHeight / 2,
            rack.z - localX * sin + localZ * cos,
            rack.yaw,
          ),
          shade,
        ),
      );
    }
  }
  return posts;
}

function buildRack(rack: Rack): THREE.BufferGeometry[] {
  const [front, right, back, left] = rack.faces;
  const bodyFaces = rackFaces({ front, right, back, left, top: 'plain' });
  /* Rubber on top: a bare metal step this low catches the sun at a grazing angle and blooms. */
  const plinthFaces = rackFaces({
    front: 'grate',
    right: 'grate',
    back: 'grate',
    left: 'grate',
    top: 'rubber',
    edge: 'rubber',
  });
  const lidFaces = rackFaces({
    front: 'plate',
    right: 'plate',
    back: 'plate',
    left: 'plate',
    top: rack.lid,
  });

  const lidHeight = 0.34;
  const bodyHeight = rack.height - PLINTH - lidHeight;
  const shade = contactShade(0);

  return [
    ...rackPosts(rack, bodyHeight, shade),
    vertexColor(
      placed(
        chamferedBox(rack.width + 0.28, PLINTH, rack.depth + 0.28, 0.05, plinthFaces),
        rack.x,
        PLINTH / 2,
        rack.z,
        rack.yaw,
      ),
      shade,
    ),
    vertexColor(
      placed(
        chamferedBox(rack.width, bodyHeight, rack.depth, 0.1, bodyFaces),
        rack.x,
        PLINTH + bodyHeight / 2,
        rack.z,
        rack.yaw,
      ),
      shade,
    ),
    vertexColor(
      placed(
        chamferedBox(rack.width + 0.14, lidHeight, rack.depth + 0.14, 0.09, lidFaces),
        rack.x,
        rack.height - lidHeight / 2,
        rack.z,
        rack.yaw,
      ),
      shade,
    ),
  ];
}

/** Conduit on the deck, as `u`, `v`, height in the racks' own grid (see `RACKS`). */
const CONDUIT_FLOOR = 0.16;
const CONDUITS: readonly (readonly [number, number, number])[][] = [
  [
    [-2.2, 3, CONDUIT_FLOOR],
    [-0.8, 3.2, CONDUIT_FLOOR],
    [0.6, 3.1, CONDUIT_FLOOR],
    [1.5, 2.6, CONDUIT_FLOOR],
    [1.6, 1.9, CONDUIT_FLOOR],
  ],
  [
    [-2.2, 3.6, CONDUIT_FLOOR],
    [-0.8, 3.8, CONDUIT_FLOOR],
    [1, 3.6, CONDUIT_FLOOR],
    [2.2, 2.9, CONDUIT_FLOOR],
    [2.3, 1.9, CONDUIT_FLOOR],
  ],
  /* This one has to cross the two above, so it rides over them. */
  [
    [-0.6, 5.2, CONDUIT_FLOOR],
    [-0.7, 4.4, CONDUIT_FLOOR + 0.04],
    [-0.75, 3.5, CONDUIT_FLOOR + 0.28],
    [-0.8, 2.6, CONDUIT_FLOOR + 0.04],
    [-0.9, 1.4, CONDUIT_FLOOR],
  ],
  [
    [4.6, -2.7, CONDUIT_FLOOR],
    [5.3, -2.6, CONDUIT_FLOOR],
    [5.7, -2.2, CONDUIT_FLOOR],
    [5.75, -1.3, CONDUIT_FLOOR],
  ],
  [
    [4.5, 0.1, CONDUIT_FLOOR],
    [4.9, -0.1, CONDUIT_FLOOR],
    [5.3, -0.3, CONDUIT_FLOOR],
  ],
];

/** Conduit bundles over the deck. Every run starts and ends inside a rack's plinth. */
function buildConduits(): THREE.BufferGeometry[] {
  const uv = rackUv('rubber');
  const color = new THREE.Color('#99a4bc');
  const cos = Math.cos(HEADING);
  const sin = Math.sin(HEADING);
  return CONDUITS.map((run) =>
    vertexColor(
      pipe(
        run.map(([u, v, y]) => [u * cos + v * sin, y, -u * sin + v * cos]),
        0.11,
        uv,
        8,
      ),
      color,
    ),
  );
}

interface EngineAssets {
  body: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
}

let assets: EngineAssets | null = null;

function getEngineAssets(): EngineAssets {
  if (assets) return assets;
  assets = {
    body: mergeParts([...RACKS.flatMap(buildRack), ...buildConduits()]),
    floor: floorGlowGeometry([
      { x: 0.2, z: 0.6, radius: 7.5, color: COLORS.violet, strength: 0.42 },
      { x: -1.5, z: -1, radius: 6.3, color: COLORS.blue, strength: 0.34 },
      { x: 2.6, z: 0.6, radius: 5.2, color: COLORS.magenta, strength: 0.22 },
    ]),
  };
  return assets;
}

export function BackendEngineProps() {
  const engine = useMemo(getEngineAssets, []);
  const hardware = useMemo(getHardware, []);
  const glow = useMemo(() => getKit().sprite(COLORS.blue, 0.26), []);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);

  useFrame(({ clock }) => {
    if (!reducedMotion) hardware.animateLights(clock.elapsedTime);
  });

  const tall = RACKS[0] as Rack;

  return (
    <group>
      <mesh geometry={engine.body} material={hardware.rack} />
      <mesh geometry={engine.floor} material={hardware.floorGlow} />
      {quality !== 'low' ? (
        <sprite material={glow} position={[tall.x, tall.height + 0.5, tall.z]} scale={[9, 6, 1]} />
      ) : null}
    </group>
  );
}
