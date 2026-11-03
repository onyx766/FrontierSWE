import * as THREE from 'three';
import { REFERENCE_FRAME } from '../../world/world';
import { heroPoint, heroReferenceCamera } from '../heroCamera';

/**
 * Where the sky's big objects sit, solved from the reference composition.
 *
 * Every position here starts as frame coordinates at the opening shot. Solving
 * them through `heroPoint` means the composition survives a re-fit of the shot:
 * the Earth's limb stays on the same pixels because the sphere is derived from
 * those pixels, not typed in.
 *
 * Scale is roughly one world unit to one kilometre, which is also why the Earth
 * reads as real: the world floats in low orbit, some 860 units up.
 */

export type FramePoint = readonly [u: number, v: number];

export interface Sphere {
  center: THREE.Vector3;
  radius: number;
}

/** A circular cone of view rays: what a sphere's silhouette is to a camera. */
export interface LimbCone {
  axis: THREE.Vector3;
  /** Half-angle in radians. */
  angle: number;
}

/** Traced from the brightest line of the limb in the reference image. */
export const EARTH_LIMB: readonly FramePoint[] = [
  [0.0012, 0.6249],
  [0.1196, 0.6397],
  [0.1495, 0.6461],
  [0.1734, 0.6525],
  [0.1973, 0.6578],
  [0.3827, 0.729],
  [0.4007, 0.7386],
  [0.4186, 0.7471],
  [0.4306, 0.7534],
  [0.6639, 0.8884],
  [0.6758, 0.898],
  [0.6938, 0.9118],
  [0.7177, 0.932],
  [0.7656, 0.9734],
  [0.7775, 0.9872],
  [0.7895, 0.9979],
];

/** Traced from the lit crescent of the second planet in the reference image. */
export const PLANET_LIMB: readonly FramePoint[] = [
  [0.8601, 0.2997],
  [0.8702, 0.2848],
  [0.8774, 0.2625],
  [0.8876, 0.2444],
  [0.8983, 0.2263],
  [0.9097, 0.2115],
  [0.9229, 0.1998],
  [0.9354, 0.1902],
  [0.96, 0.1722],
  [0.9982, 0.1605],
];

/** Camera to Earth centre. Only sets the scale: the limb stays on its pixels. */
const EARTH_DISTANCE = 7000;
/** Camera to the second planet's centre. Far enough to clear the Earth and every orbit. */
const PLANET_DISTANCE = 6400;

/** Unit direction of the opening camera's ray through a frame point. */
export function heroRay(u: number, v: number): THREE.Vector3 {
  return heroPoint(u, v, 1).sub(heroReferenceCamera().position).normalize();
}

/**
 * Fit the cone through a sphere's silhouette. Every limb ray `d` makes the same
 * angle with the axis, so `d · (axis / cos angle) = 1`: linear in one unknown
 * vector, solved by least squares.
 */
export function solveLimbCone(limb: readonly FramePoint[]): LimbCone {
  const normal = new Array<number>(9).fill(0);
  const moment = new THREE.Vector3();

  for (const [u, v] of limb) {
    const ray = heroRay(u, v);
    const row = ray.toArray();
    row.forEach((a, i) => {
      row.forEach((b, j) => {
        normal[i * 3 + j] = (normal[i * 3 + j] ?? 0) + a * b;
      });
    });
    moment.add(ray);
  }

  const inverse = new THREE.Matrix3().fromArray(normal).invert();
  const solution = moment.applyMatrix3(inverse);
  const cosine = 1 / solution.length();
  return { axis: solution.normalize(), angle: Math.acos(cosine) };
}

/** The sphere with a given silhouette, `distance` from the opening camera. */
export function sphereFromCone(cone: LimbCone, distance: number): Sphere {
  const camera = heroReferenceCamera();
  return {
    center: camera.position.clone().addScaledVector(cone.axis, distance),
    radius: distance * Math.sin(cone.angle),
  };
}

export interface Composition {
  earth: Sphere;
  planet: Sphere;
  /** Unit direction of the sun that sits on the Earth's horizon at the left of frame. */
  sunDirection: THREE.Vector3;
  /** Where that sun flare sits, on the limb. */
  sunPosition: THREE.Vector3;
}

let composition: Composition | null = null;

export function getComposition(): Composition {
  if (composition) return composition;

  const earth = sphereFromCone(solveLimbCone(EARTH_LIMB), EARTH_DISTANCE);
  const planet = sphereFromCone(solveLimbCone(PLANET_LIMB), PLANET_DISTANCE);

  const limbDistance = Math.sqrt(EARTH_DISTANCE ** 2 - earth.radius ** 2);
  const sunPosition = heroPoint(0, 0.622, limbDistance);

  composition = {
    earth,
    planet,
    sunDirection: sunPosition.clone().normalize(),
    sunPosition,
  };
  return composition;
}

/** World-space width of an object that spans `pixels` of the reference frame at `distance`. */
export function worldSizeAt(pixels: number, distance: number): number {
  const camera = heroReferenceCamera();
  const frameHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  return (pixels / REFERENCE_FRAME.height) * frameHeight * distance;
}
