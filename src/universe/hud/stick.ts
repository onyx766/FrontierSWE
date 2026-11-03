/** Fraction of the stick's travel that is ignored, so a resting thumb does not walk. */
const DEAD_ZONE = 0.14;

/**
 * Converts a thumb offset from the stick's centre, in screen pixels with y down,
 * into walking input: each axis −1 to 1, and +y away from the camera, as
 * `runtime.input` expects. The result never leaves the unit circle, and speed
 * rises from zero at the edge of the dead zone rather than jumping.
 */
export function stickVector(
  offsetX: number,
  offsetY: number,
  radius: number,
): { x: number; y: number } {
  const reach = Math.hypot(offsetX, offsetY) / radius;
  if (reach <= DEAD_ZONE) return { x: 0, y: 0 };

  const strength = Math.min(1, (reach - DEAD_ZONE) / (1 - DEAD_ZONE));
  return {
    x: (offsetX / (reach * radius)) * strength,
    y: (-offsetY / (reach * radius)) * strength,
  };
}
