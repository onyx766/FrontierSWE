import * as THREE from 'three';
import { HERO_SHOT, REFERENCE_FRAME } from '../world/world';

/**
 * The opening shot. Fitted numerically so that the Ring lands on the same pixels
 * as the reference composition; see `HERO_SHOT` in `world.ts`.
 *
 * The scene sits right of frame to leave room for the statement. That is done
 * with a lens shift rather than by aiming the camera to one side: aiming would
 * rotate the view and skew the Ring, whereas a shift moves the image in the
 * frame and leaves the perspective untouched.
 */

/** Distance multiplier that keeps the whole world in frame on narrow screens. */
export function heroFit(aspect: number): number {
  const reference = REFERENCE_FRAME.width / REFERENCE_FRAME.height;
  return Math.max(1, reference / aspect);
}

/** Where the opening shot puts the camera. */
export function heroPosition(aspect: number, out = new THREE.Vector3()): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(HERO_SHOT.elevation);
  const azimuth = THREE.MathUtils.degToRad(HERO_SHOT.azimuth);
  const distance = HERO_SHOT.distance * heroFit(aspect);
  return out.set(
    HERO_SHOT.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    HERO_SHOT.target.y + distance * Math.sin(elevation),
    HERO_SHOT.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  );
}

/**
 * Shift the image within the frame. `shiftX` and `shiftY` are fractions of the
 * frame; positive moves the picture right and up. Pass zeros to clear it.
 */
export function applyLensShift(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  shiftX: number,
  shiftY: number,
): void {
  if (shiftX === 0 && shiftY === 0) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(width, height, -shiftX * width, shiftY * height, width, height);
  }
}

/** Put a live camera on the opening shot. */
export function poseHeroCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): void {
  camera.fov = HERO_SHOT.fov;
  heroPosition(width / height, camera.position);
  camera.lookAt(HERO_SHOT.target.x, HERO_SHOT.target.y, HERO_SHOT.target.z);
  camera.updateMatrixWorld(true);
  applyLensShift(camera, width, height, HERO_SHOT.shiftX, HERO_SHOT.shiftY);
  camera.updateProjectionMatrix();
}

let referenceCamera: THREE.PerspectiveCamera | null = null;

/** A detached copy of the opening camera at the reference frame's aspect. */
export function heroReferenceCamera(): THREE.PerspectiveCamera {
  if (referenceCamera) return referenceCamera;
  const camera = new THREE.PerspectiveCamera(
    HERO_SHOT.fov,
    REFERENCE_FRAME.width / REFERENCE_FRAME.height,
    0.5,
    9000,
  );
  poseHeroCamera(camera, REFERENCE_FRAME.width, REFERENCE_FRAME.height);
  referenceCamera = camera;
  return camera;
}

/**
 * The world point that the opening shot shows at frame coordinates `(u, v)`,
 * `distance` units from the camera. `u` and `v` run 0–1 from the top-left, the
 * same as pixel ÷ size in the reference image. Use it to place sky objects so
 * that they sit where the composition wants them even if the shot is re-fitted.
 */
export function heroPoint(u: number, v: number, distance: number): THREE.Vector3 {
  const camera = heroReferenceCamera();
  const ndc = new THREE.Vector3(u * 2 - 1, 1 - v * 2, 0.5);
  const point = ndc.unproject(camera);
  const direction = point.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(direction, distance);
}
