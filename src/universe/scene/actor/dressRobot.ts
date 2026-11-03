import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { COLORS, hdr } from '../palette';

/**
 * Turns the stock robot into this world's robot: pearl armour over gunmetal
 * joints, smooth shading instead of the model's hard facets, and glowing cyan
 * eyes and a chest core. The GLB is cached by the loader, so all of this happens
 * to a private copy.
 */

/** Faces meeting at less than this shade as one surface. Harder edges stay crisp. */
const CREASE_ANGLE = (52 * Math.PI) / 180;
/**
 * `toCreasedNormals` finds matching corners by rounding positions to 0.01. This
 * model is authored around a hundred times smaller than that, so everything
 * would count as one corner. Scaling up for the calculation avoids it.
 */
const CREASE_SCALE = 1000;

/* Measured from the vertices, in the head and torso meshes' own space, where −y is
   the way the robot faces and +z is up. */
const EYE = { x: 0.0071, y: -0.01308, z: -0.00059, pupil: 0.00165 };
const CHEST = { y: -0.00702, z: 0.00095, core: 0.00125 };

export interface RobotLook {
  Main: THREE.MeshStandardMaterial;
  Grey: THREE.MeshStandardMaterial;
  Black: THREE.MeshStandardMaterial;
  /** Eyes and chest. Its own material, so that it can pulse while the robot talks. */
  glow: THREE.MeshBasicMaterial;
}

export function createRobotLook(): RobotLook {
  return {
    Main: new THREE.MeshStandardMaterial({
      name: 'Main',
      color: '#c3cddd',
      metalness: 0.72,
      roughness: 0.27,
    }),
    Grey: new THREE.MeshStandardMaterial({
      name: 'Grey',
      color: COLORS.metalDark,
      metalness: 0.92,
      roughness: 0.34,
    }),
    Black: new THREE.MeshStandardMaterial({
      name: 'Black',
      color: '#04060b',
      metalness: 0.8,
      roughness: 0.14,
    }),
    glow: new THREE.MeshBasicMaterial({ color: hdr(COLORS.cyan, 3), toneMapped: false }),
  };
}

function isLookName(name: string): name is 'Main' | 'Grey' | 'Black' {
  return name === 'Main' || name === 'Grey' || name === 'Black';
}

function smoothShading(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const scaled = geometry.clone();
  scaled.scale(CREASE_SCALE, CREASE_SCALE, CREASE_SCALE);
  const creased = toCreasedNormals(scaled, CREASE_ANGLE);
  creased.scale(1 / CREASE_SCALE, 1 / CREASE_SCALE, 1 / CREASE_SCALE);
  return creased;
}

/** A shallow lens lying on a surface that faces −y. */
function lens(x: number, y: number, z: number, radius: number): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius, 20, 12);
  geometry.scale(1, 0.32, 1);
  geometry.translate(x, y, z);
  return geometry;
}

function attachGlow(model: THREE.Object3D, look: RobotLook): THREE.BufferGeometry[] {
  const made: THREE.BufferGeometry[] = [];

  const attach = (parent: THREE.Object3D, geometry: THREE.BufferGeometry) => {
    const mesh = new THREE.Mesh(geometry, look.glow);
    mesh.frustumCulled = false;
    parent.add(mesh);
    made.push(geometry);
  };

  let head: THREE.Object3D | null = null;
  let torso: THREE.Object3D | null = null;
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.material === look.Black) head = mesh.parent;
    if (mesh.name.startsWith('Torso')) torso = mesh.parent;
  });

  if (head) {
    attach(
      head,
      mergeGeometries([
        lens(-EYE.x, EYE.y, EYE.z, EYE.pupil),
        lens(EYE.x, EYE.y, EYE.z, EYE.pupil),
      ]),
    );
  }
  if (torso) attach(torso, lens(0, CHEST.y, CHEST.z, CHEST.core));

  return made;
}

export interface DressedRobot {
  model: THREE.Object3D;
  dispose(): void;
}

export function dressRobot(source: THREE.Object3D, look: RobotLook): DressedRobot {
  const model = cloneSkinned(source);
  const owned: THREE.BufferGeometry[] = [];

  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;

    /* Bounds do not follow the skeleton, and the robot is hardly ever out of view. */
    mesh.frustumCulled = false;
    mesh.geometry = smoothShading(mesh.geometry);
    owned.push(mesh.geometry);

    const { name } = mesh.material as THREE.Material;
    if (isLookName(name)) mesh.material = look[name];
  });

  owned.push(...attachGlow(model, look));

  return {
    model,
    dispose() {
      for (const geometry of owned) geometry.dispose();
    },
  };
}
