import type { FacadeStyle } from './model';

/**
 * Colours for the island. Pastel sunset: lit faces lean peach and pink, shade
 * leans lavender, glass is blue to violet, and the accent glow is the page's
 * violet. Kept apart from the drawing code so the look can be tuned in one place.
 */

export interface FacadeLook {
  /** How the facade is patterned. */
  kind: 'glass' | 'grid' | 'ribbon' | 'tower' | 'crown' | 'podium' | 'house' | 'pavilion';
  /** Wall or glass gradient, top to bottom. */
  top: string;
  bottom: string;
  /** Mullions and slab lines. */
  frame: string;
  /** Unlit window glass. */
  dark: string;
  /** Lit window colours, picked at random. */
  lit: readonly string[];
  litChance: number;
  /** Window module, in world units. */
  cellW: number;
  cellH: number;
  roof: string;
  roofEdge: string;
}

export const FACADES: Record<FacadeStyle, FacadeLook> = {
  towerMain: {
    kind: 'tower',
    top: '#4a46b8',
    bottom: '#1d1b57',
    frame: '#6f6fe0',
    dark: '#191848',
    lit: ['#a9c8ff', '#cfdcff', '#b9a8ff', '#8fb8ff'],
    litChance: 0.42,
    cellW: 0.0155,
    cellH: 0.0185,
    roof: '#3d3a9a',
    roofEdge: '#a5a3ff',
  },
  towerCrown: {
    kind: 'crown',
    top: '#9b82ff',
    bottom: '#4b33bf',
    frame: '#d3c7ff',
    dark: '#3a2a95',
    lit: ['#efe9ff', '#d7cbff'],
    litChance: 0.7,
    cellW: 0.015,
    cellH: 0.02,
    roof: '#6d4aff',
    roofEdge: '#e3dbff',
  },
  podium: {
    kind: 'podium',
    top: '#e7e4fb',
    bottom: '#bdb7ea',
    frame: '#f7f5ff',
    dark: '#7d83c9',
    lit: ['#e6f6ff', '#bfe3ff', '#d9ecff'],
    litChance: 0.85,
    cellW: 0.022,
    cellH: 0.03,
    roof: '#efedfa',
    roofEdge: '#ffffff',
  },
  glassIndigo: {
    kind: 'glass',
    top: '#6c70e0',
    bottom: '#2b2c80',
    frame: '#8d91f0',
    dark: '#26276e',
    lit: ['#d9e6ff', '#a9c4ff', '#eef1ff', '#ffe7c7'],
    litChance: 0.46,
    cellW: 0.016,
    cellH: 0.02,
    roof: '#7376d6',
    roofEdge: '#c9cbff',
  },
  glassBlue: {
    kind: 'glass',
    top: '#7fa8f0',
    bottom: '#2f4ea8',
    frame: '#a6c2f7',
    dark: '#2a4290',
    lit: ['#eef6ff', '#c3defe', '#fff1d9'],
    litChance: 0.44,
    cellW: 0.016,
    cellH: 0.02,
    roof: '#93b3ef',
    roofEdge: '#e2edff',
  },
  glassViolet: {
    kind: 'glass',
    top: '#a48ff2',
    bottom: '#4b3aa6',
    frame: '#c4b6fa',
    dark: '#3f3290',
    lit: ['#f3eeff', '#d8ccff', '#ffe9f4'],
    litChance: 0.42,
    cellW: 0.016,
    cellH: 0.02,
    roof: '#ab98f2',
    roofEdge: '#ece6ff',
  },
  glassSky: {
    kind: 'glass',
    top: '#b9d8fb',
    bottom: '#5a84d2',
    frame: '#d8e9ff',
    dark: '#4d72bd',
    lit: ['#ffffff', '#e4f0ff', '#fff4e0'],
    litChance: 0.4,
    cellW: 0.017,
    cellH: 0.02,
    roof: '#c9dffb',
    roofEdge: '#f4f9ff',
  },
  ribbonLilac: {
    kind: 'ribbon',
    top: '#f1eefb',
    bottom: '#d7d1ef',
    frame: '#ffffff',
    dark: '#6f86d8',
    lit: ['#cfe1ff', '#eef4ff', '#b9d0ff'],
    litChance: 0.5,
    cellW: 0.02,
    cellH: 0.021,
    roof: '#f3f0fb',
    roofEdge: '#ffffff',
  },
  gridWhite: {
    kind: 'grid',
    top: '#f8f6fc',
    bottom: '#dfdaef',
    frame: '#ffffff',
    dark: '#6681d4',
    lit: ['#bfd5ff', '#e8f0ff', '#fff0d8'],
    litChance: 0.48,
    cellW: 0.017,
    cellH: 0.021,
    roof: '#f6f4fb',
    roofEdge: '#ffffff',
  },
  house: {
    kind: 'house',
    top: '#fdf8f4',
    bottom: '#ece2e8',
    frame: '#ffffff',
    dark: '#8299dc',
    lit: ['#fff2d6', '#dbe8ff'],
    litChance: 0.45,
    cellW: 0.019,
    cellH: 0.022,
    roof: '#ddd3ee',
    roofEdge: '#ffffff',
  },
  pavilion: {
    kind: 'pavilion',
    top: '#cdeeff',
    bottom: '#6fa7e8',
    frame: '#f1fbff',
    dark: '#5d8fd6',
    lit: ['#ffffff', '#dff5ff'],
    litChance: 0.9,
    cellW: 0.02,
    cellH: 0.026,
    roof: '#eaf4ff',
    roofEdge: '#ffffff',
  },
};

/** Rock strata from the grass lip down to the tip: [lit, shade] per band. */
export const ROCK_BANDS: readonly (readonly [string, string])[] = [
  ['#a3da76', '#4d8b5a'],
  ['#e4b691', '#8b6a73'],
  ['#f2cba9', '#987a8c'],
  ['#ecc2a4', '#917489'],
  ['#e2b39f', '#856b87'],
  ['#d8ab9f', '#7c6485'],
  ['#c7a1ab', '#76628a'],
  ['#b49bb8', '#6c5f8c'],
  ['#a99bc6', '#6a6496'],
];

/** Moss on the upper strata: [lit, shade]. */
export const ROCK_MOSS: readonly [string, string] = ['#acd97f', '#5b8b61'];

/** Tree canopies: [highlight, body, shadow] per tree kind. */
export const TREE_COLORS: readonly (readonly [string, string, string])[] = [
  ['#b4e889', '#5fb65a', '#2f7a45'],
  ['#8fd27a', '#3f9150', '#235e3d'],
  ['#e2f29a', '#9ccc58', '#5b8f3c'],
  ['#9bd486', '#3d8a55', '#1f5a3d'],
  ['#ffe0ee', '#f2a9cb', '#c7729e'],
  ['#c2ec8f', '#6cbb5c', '#3b8547'],
];

export const TRUNK = '#7b5a52';

/** Car body colours. */
export const CAR_COLORS = ['#ffffff', '#c8d8ff', '#ffd1e6', '#cbb8ff', '#ffe2b8'] as const;

/** Flower dots. */
export const FLOWER_COLORS = ['#ffd6ea', '#ffffff', '#fff1a8', '#e5d4ff'] as const;

export const GROUND = {
  grassCenter: '#97d374',
  grassMid: '#7cc566',
  grassEdge: '#5aa95a',
  grassLight: '#b7e48a',
  grassDark: '#4c9752',
  lip: '#d9f39a',
  paving: '#ebe8f5',
  pavingEdge: '#d3cee6',
  road: '#b9bbcd',
  roadDark: '#a7a9c0',
  lane: '#ffffff',
  median: '#fff4cf',
  edgeGlow: '#5aa8ff',
  edgeLight: '#dff1ff',
  path: '#efe2cf',
  pathEdge: '#d8c3a8',
  water: '#7fd2f3',
  waterDeep: '#4b9fd6',
  waterLight: '#dcf7ff',
  plaza: '#efedf9',
  plazaLine: '#d9d4ee',
  plazaGlow: '#9b7bff',
} as const;

/** Light comes from the upper left and a little in front (camera space, normalised). */
export const LIGHT = (() => {
  const x = -0.62;
  const y = 0.56;
  const z = 0.55;
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
})();
