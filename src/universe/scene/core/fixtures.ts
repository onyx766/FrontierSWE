import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The small steel cages around the crystal's two energy ports: one on the point
 * of the gem, one on its rear top corner. Parts are merged, so that the hardware
 * is a single draw call.
 *
 * The only thing lighting them is the beam they hold, and no scene light is in
 * the right place for that, so the light is baked into vertex colours instead:
 * faces turned towards the beam take its colour, the rest stay dark steel.
 */

export interface PortCage {
  origin: THREE.Vector3;
  /** Unit direction away from the gem. */
  axis: THREE.Vector3;
  length: number;
  radius: number;
  /** Colour of the beam the cage holds. */
  light: THREE.Color;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STEEL = new THREE.Color('#2d3442');
const SKY_SHEEN = new THREE.Color('#5b7fd0');

/** A short turned collar, drawn as a profile of radius and height. */
function collar(radius: number, height: number): THREE.BufferGeometry {
  const lip = radius * 0.1;
  const profile = [
    new THREE.Vector2(radius * 0.72, 0),
    new THREE.Vector2(radius + lip, 0),
    new THREE.Vector2(radius + lip, height * 0.22),
    new THREE.Vector2(radius, height * 0.3),
    new THREE.Vector2(radius, height * 0.7),
    new THREE.Vector2(radius + lip, height * 0.78),
    new THREE.Vector2(radius + lip, height),
    new THREE.Vector2(radius * 0.72, height),
    new THREE.Vector2(radius * 0.72, 0),
  ];
  return new THREE.LatheGeometry(profile, 40).toNonIndexed();
}

/** One bar running along the cage, flattened so that it reads as machined stock. */
function bar(length: number, thickness: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(thickness * 0.8, length, thickness * 1.5).toNonIndexed();
}

function cageParts({ length, radius }: PortCage): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];

  parts.push(collar(radius, length * 0.2));

  const foot = collar(radius * 0.96, length * 0.16);
  foot.translate(0, length * 0.84, 0);
  parts.push(foot);

  for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    const strut = bar(length * 0.72, radius * 0.17);
    strut.translate(radius * 1.02, length * 0.5, 0);
    strut.rotateY(angle);
    parts.push(strut);
  }

  return parts;
}

/** Bakes the beam's light into a cage part that is already in place. */
function paintCage(part: THREE.BufferGeometry, cage: PortCage) {
  const positions = part.getAttribute('position');
  const normals = part.getAttribute('normal');
  const colors = new Float32Array(positions.count * 3);

  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toBeam = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);
    normal.fromBufferAttribute(normals, index);

    const along = point.clone().sub(cage.origin).dot(cage.axis);
    toBeam.copy(cage.origin).addScaledVector(cage.axis, along).sub(point);
    const reach = toBeam.length();
    const facing = reach > 1e-4 ? Math.max(0, normal.dot(toBeam.normalize())) : 0;
    const nearGem = 1 - Math.min(1, along / cage.length) * 0.6;

    const steel = 0.55 + 0.45 * Math.max(0, normal.y);
    const sheen = 0.32 * (1 - facing) * Math.max(0, normal.y);
    const light = (0.14 + 2.4 * facing * facing) * nearGem;
    colors[index * 3] = STEEL.r * steel + SKY_SHEEN.r * sheen + cage.light.r * light;
    colors[index * 3 + 1] = STEEL.g * steel + SKY_SHEEN.g * sheen + cage.light.g * light;
    colors[index * 3 + 2] = STEEL.b * steel + SKY_SHEEN.b * sheen + cage.light.b * light;
  }

  part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function buildCageGeometry(cages: PortCage[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const orient = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();

  for (const cage of cages) {
    orient.setFromUnitVectors(Y_AXIS, cage.axis);
    matrix.compose(cage.origin, orient, new THREE.Vector3(1, 1, 1));
    for (const part of cageParts(cage)) {
      part.applyMatrix4(matrix);
      part.deleteAttribute('uv');
      part.computeVertexNormals();
      paintCage(part, cage);
      parts.push(part);
    }
  }

  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Could not merge the crystal cages');
  return merged;
}
