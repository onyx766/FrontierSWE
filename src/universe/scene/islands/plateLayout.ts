import * as THREE from 'three';
import { islands, type IslandContent, type IslandId } from '@/data/universe';
import { islandCenter } from '../../world/network';
import { REFERENCE_FRAME } from '../../world/world';
import type { Vec3 } from '../../world/vec';
import { heroPoint, heroReferenceCamera } from '../heroCamera';

/**
 * Where the label plates go. They are measured from the reference in its own
 * pixels, and the world placement is solved from those measurements, so that at
 * the opening shot each plate lands on its pixels by construction, and it keeps
 * the same relation to its island from any other angle.
 */

/** A plate in the reference image, in pixels. Offsets are from the plate's centre, up. */
export interface PlateMeasure {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  titleSize: number;
  subSize: number;
  titleY: number;
  subY: number;
}

export interface PlateLayout {
  island: IslandContent;
  center: Vec3;
  measure: PlateMeasure;
  /** Offsets from the island's centre: towards the camera, to its right, and up. */
  out: number;
  side: number;
  up: number;
  /** World units per reference pixel. The plate is authored in reference pixels. */
  pixel: number;
}

const MEASURED: Record<IslandId, PlateMeasure> = {
  'ai-core': {
    x: 905.5,
    y: 194,
    width: 165,
    height: 62,
    radius: 13,
    titleSize: 19.7,
    subSize: 13.5,
    titleY: 8.4,
    subY: -13,
  },
  about: {
    x: 1313,
    y: 293,
    width: 169,
    height: 63,
    radius: 13,
    titleSize: 19.7,
    subSize: 13.5,
    titleY: 9,
    subY: -13,
  },
  'experience-archive': {
    x: 1375,
    y: 572.5,
    width: 184,
    height: 85,
    radius: 14,
    titleSize: 19.4,
    subSize: 14.2,
    titleY: 8.5,
    subY: -25,
  },
  'data-vault': {
    x: 921.5,
    y: 743,
    width: 225,
    height: 74,
    radius: 14,
    titleSize: 22.7,
    subSize: 15.5,
    titleY: 10,
    subY: -16,
  },
  'backend-engine': {
    x: 457,
    y: 570,
    width: 217,
    height: 67,
    radius: 14,
    titleSize: 21.5,
    subSize: 14.4,
    titleY: 9.5,
    subY: -13.5,
  },
  'project-lab': {
    x: 528,
    y: 320,
    width: 170,
    height: 63,
    radius: 13,
    titleSize: 19.7,
    subSize: 13.5,
    titleY: 9,
    subY: -13,
  },
};

/** How far a plate stands in front of its island's centre, clear of the props. */
const PLATE_OUT = 9;

function solvePlate(island: IslandContent): PlateLayout {
  const measure = MEASURED[island.id];
  const center = islandCenter(island);
  const camera = heroReferenceCamera();

  const toCamera = new THREE.Vector3(
    camera.position.x - center.x,
    0,
    camera.position.z - center.z,
  ).normalize();
  const right = new THREE.Vector3(toCamera.z, 0, -toCamera.x);

  /* Follow the plate's reference pixel out to the upright plane in front of the island. */
  const ray = heroPoint(measure.x / REFERENCE_FRAME.width, measure.y / REFERENCE_FRAME.height, 1)
    .sub(camera.position)
    .normalize();
  const fromCenter = camera.position.clone().sub(new THREE.Vector3(center.x, center.y, center.z));
  const travel = (PLATE_OUT - fromCenter.dot(toCamera)) / ray.dot(toCamera);
  const point = camera.position.clone().addScaledVector(ray, travel);
  const offset = point.clone().sub(new THREE.Vector3(center.x, center.y, center.z));

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const depth = point.clone().sub(camera.position).dot(forward);
  const halfView = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const pixelsPerUnit = REFERENCE_FRAME.height / 2 / (halfView * depth);

  return {
    island,
    center,
    measure,
    out: PLATE_OUT,
    side: offset.dot(right),
    up: offset.y,
    pixel: 1 / pixelsPerUnit,
  };
}

let layouts: PlateLayout[] | null = null;

export function getPlateLayouts(): PlateLayout[] {
  layouts ??= islands.map(solvePlate);
  return layouts;
}
