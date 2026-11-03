import { TAU } from './geometry';

/**
 * The two ways the island is framed: 'hero' (about 30 degrees above, drifting
 * clouds round the base) and 'panorama' (lower, slower, a bank of cloud that
 * runs off the bottom of the final call-to-action band). All distances are in
 * island units: the island's radius is about 1 on screen.
 */

export type IslandVariant = 'hero' | 'panorama';

export interface CloudSpec {
  sprite: number;
  /** Centre, in island units from the island's centre on screen. */
  x: number;
  y: number;
  /** Width in island units. */
  w: number;
  alpha: number;
  drift: number;
  period: number;
  phase: number;
  front: boolean;
}

export interface VariantConfig {
  /** Default camera elevation, radians. */
  phi: number;
  /** Auto-spin, radians per second. */
  spin: number;
  /** A pleasant angle for the still frame and the first frame. */
  theta0: number;
  /** Bob amplitude as a fraction of the scale. */
  bob: number;
  clouds: CloudSpec[];
  /** Framing in island units: half width, and extent above and below the centre. */
  frame: { half: number; top: number; bottom: number };
  /** Fraction of the height, at the bottom, over which the canvas fades out (0 for none). */
  fade: number;
  /** Elevation range the pointer may nudge, radians. */
  nudge: number;
}

export const DEG = Math.PI / 180;

/** The cloud sprites the layouts pick from, by index: width (island units), shape, seed. */
export const CLOUD_SPRITES: { w: number; aspect: number; bank: boolean; seed: number }[] = [
  { w: 1.0, aspect: 0.5, bank: false, seed: 11 },
  { w: 0.85, aspect: 0.48, bank: false, seed: 23 },
  { w: 0.6, aspect: 0.58, bank: false, seed: 37 },
  { w: 1.35, aspect: 0.3, bank: true, seed: 41 },
  { w: 1.7, aspect: 0.27, bank: true, seed: 53 },
];

export const VARIANTS: Record<IslandVariant, VariantConfig> = {
  hero: {
    phi: 30 * DEG,
    spin: TAU / 80,
    // The "R" turned toward the light, a waterfall at the front right.
    theta0: -2.45,
    bob: 0.022,
    nudge: 4 * DEG,
    frame: { half: 1.27, top: 1.08, bottom: 1.14 },
    fade: 0,
    clouds: [
      { sprite: 0, x: -0.84, y: 0.02, w: 0.9, alpha: 1, drift: 0.03, period: 46, phase: 0, front: false },
      { sprite: 1, x: 0.86, y: 0.14, w: 0.8, alpha: 0.97, drift: 0.03, period: 52, phase: 1.3, front: false },
      { sprite: 2, x: 0.8, y: -0.52, w: 0.4, alpha: 0.45, drift: 0.025, period: 40, phase: 2.2, front: false },
      { sprite: 4, x: -0.04, y: 0.95, w: 1.62, alpha: 1, drift: 0.02, period: 54, phase: 0.6, front: true },
      { sprite: 0, x: -0.8, y: 0.72, w: 0.72, alpha: 0.97, drift: 0.03, period: 38, phase: 3.3, front: true },
      { sprite: 2, x: 0.36, y: 0.88, w: 0.62, alpha: 0.95, drift: 0.025, period: 47, phase: 1.9, front: true },
      { sprite: 1, x: 0.86, y: 0.8, w: 0.62, alpha: 0.97, drift: 0.028, period: 42, phase: 5, front: true },
    ],
  },
  panorama: {
    phi: 22 * DEG,
    spin: TAU / 140,
    theta0: -2.45,
    bob: 0.016,
    nudge: 0,
    // The bank of cloud runs off the bottom edge, where the canvas fades out.
    frame: { half: 1.3, top: 1.1, bottom: 0.74 },
    fade: 0.14,
    clouds: [
      { sprite: 4, x: -0.95, y: 0.12, w: 1.0, alpha: 0.85, drift: 0.03, period: 60, phase: 0.4, front: false },
      { sprite: 4, x: 0.98, y: 0.16, w: 0.95, alpha: 0.85, drift: 0.03, period: 64, phase: 2.1, front: false },
      { sprite: 1, x: -1.06, y: -0.16, w: 0.5, alpha: 0.6, drift: 0.03, period: 52, phase: 1.1, front: false },
      { sprite: 2, x: 1.08, y: -0.22, w: 0.42, alpha: 0.55, drift: 0.03, period: 48, phase: 3.7, front: false },
      { sprite: 3, x: -0.64, y: 0.58, w: 1.25, alpha: 1, drift: 0.025, period: 56, phase: 0.9, front: true },
      { sprite: 3, x: 0.68, y: 0.6, w: 1.25, alpha: 1, drift: 0.025, period: 58, phase: 4.4, front: true },
      { sprite: 4, x: 0.02, y: 0.74, w: 1.75, alpha: 1, drift: 0.02, period: 70, phase: 2.8, front: true },
    ],
  },
};
