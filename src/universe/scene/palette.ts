import * as THREE from 'three';
import type { IslandAccent } from '@/data/universe';

/**
 * The world's colours. The 3D world deliberately leaves the site's single-accent
 * rule behind: it follows the Engineering Universe art direction, in which
 * electric blue and violet read as cool data and orange reads as warm energy.
 */

export const COLORS = {
  void: '#02040b',
  blue: '#3f9dff',
  cyan: '#58d8ff',
  violet: '#8a5cff',
  magenta: '#c95cff',
  orange: '#ff9238',
  amber: '#ffc26b',
  white: '#eaf2ff',
  green: '#3dd68c',
  metalDeep: '#10141d',
  metalDark: '#1b212d',
  metal: '#2c3442',
  metalLight: '#59657a',
  rock: '#2b2420',
  rockWarm: '#47342a',
} as const;

export const ACCENT: Record<IslandAccent, string> = {
  violet: COLORS.violet,
  blue: COLORS.blue,
  orange: COLORS.orange,
  cyan: COLORS.cyan,
};

/**
 * A colour above 1.0, for anything that should bloom. Bloom is keyed on
 * brightness over 1, so ordinary lit surfaces stay crisp and only values made
 * with this glow. Use with a material that has `toneMapped={false}`.
 */
export function hdr(color: string, intensity: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(intensity);
}
