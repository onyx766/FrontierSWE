import type { IslandModel } from './model';
import {
  GROUND_EXTENT,
  packAtlas,
  paintCloud,
  paintEmblem,
  paintFacadeAtlas,
  paintGlow,
  paintGround,
  paintSheen,
  paintStar,
  paintTree,
  paintWaterfall,
  type FacadeAtlas,
  type PackedAtlas,
  type Sprite,
} from './textures';
import { CLOUD_SPRITES } from './variants';

/**
 * The painted assets the renderer maps onto the island, built once per pixel
 * density and shared by every canvas on the page.
 */

/** Order of the sprites in the packed glow atlas. */
export const GLOW_CYAN = 0;
export const GLOW_RED = 1;
export const GLOW_VIOLET = 2;
export const GLOW_WHITE = 3;
export const GLOW_STAR = 4;

export interface Art {
  ground: HTMLCanvasElement;
  atlas: FacadeAtlas;
  /** Anchors and scale per tree kind; the pixels live in `treeAtlas`. */
  trees: Sprite[];
  treeAtlas: PackedAtlas;
  clouds: HTMLCanvasElement[];
  /** Small glows and the sparkle, packed so they batch: see GLOW_* for the order. */
  glow: PackedAtlas;
  glowPink: HTMLCanvasElement;
  glowPeach: HTMLCanvasElement;
  haloViolet: HTMLCanvasElement;
  sheen: HTMLCanvasElement;
  water: HTMLCanvasElement;
  emblem: HTMLCanvasElement;
  /** Set when the GPU dropped any of these canvases; the art is then repainted. */
  lost: boolean;
  /** One art context to poll, for browsers that don't fire `contextlost` on 2D canvases. */
  probe: CanvasRenderingContext2D | null;
}

export type LossAware = CanvasRenderingContext2D & { isContextLost?: () => boolean };

const lossListeners = new Set<() => void>();

/**
 * Calls `listener` whenever painted art is lost to a GPU reset, so a canvas
 * that isn't animating (reduced motion, say) can still repaint. Returns the
 * unsubscribe function.
 */
export function onArtLost(listener: () => void): () => void {
  lossListeners.add(listener);
  return () => {
    lossListeners.delete(listener);
  };
}

/**
 * Painted art keyed by texel density, shared by every canvas on the page and
 * kept across React's development double-mount. Densities are bucketed in
 * ~15% steps so a window resize doesn't repaint on every pixel.
 */
export const artCache = new Map<number, Art>();

export function densityBucket(density: number): number {
  return Math.round(Math.log(Math.max(60, density)) / Math.log(1.15));
}

export function buildArt(model: IslandModel, bucket: number): Art {
  const density = Math.min(900, Math.pow(1.15, bucket));
  const treeR = Math.max(6, Math.round(0.044 * density));
  const trees = ([0, 1, 2, 3, 4, 5] as const).map((kind) => paintTree(kind, treeR, 101 + kind * 13));
  const art: Art = {
    ground: paintGround(model, Math.max(256, Math.min(2048, Math.round(2 * GROUND_EXTENT * density)))),
    atlas: paintFacadeAtlas(model, density),
    trees,
    treeAtlas: packAtlas(trees.map((tree) => tree.canvas)),
    // Clouds are soft anyway, so they are painted at reduced resolution and scaled up.
    clouds: CLOUD_SPRITES.map((c) => paintCloud(Math.min(900, c.w * density * 0.6), c.aspect, c.seed, c.bank)),
    glow: packAtlas([
      paintGlow('#7cc8ff', 64, 'tight'),
      paintGlow('#ff6f9a', 48, 'tight'),
      paintGlow('#9b7bff', 96),
      paintGlow('#ffffff', 64),
      paintStar(48),
    ]),
    glowPink: paintGlow('#ff9fcf', 96),
    glowPeach: paintGlow('#ffc9a8', 128),
    haloViolet: paintGlow('#8f6bff', 128),
    sheen: paintSheen(64),
    water: paintWaterfall(32, 128),
    emblem: paintEmblem(Math.max(96, Math.min(256, Math.round(density * 0.2)))),
    lost: false,
    probe: null,
  };
  // Painted once, so a GPU reset would leave them blank for good: listen for it
  // and repaint into fresh canvases instead.
  const canvases = [
    art.ground,
    art.atlas.canvas,
    art.treeAtlas.canvas,
    ...art.clouds,
    art.glow.canvas,
    art.glowPink,
    art.glowPeach,
    art.haloViolet,
    art.sheen,
    art.water,
    art.emblem,
  ];
  const markLost = () => {
    art.lost = true;
    for (const listener of lossListeners) listener();
  };
  for (const canvas of canvases) {
    canvas.addEventListener('contextlost', markLost);
    canvas.addEventListener('contextrestored', markLost);
  }
  art.probe = art.ground.getContext('2d');
  if (artCache.size >= 3) {
    const oldest = artCache.keys().next().value;
    if (oldest !== undefined) artCache.delete(oldest);
  }
  artCache.set(bucket, art);
  return art;
}
