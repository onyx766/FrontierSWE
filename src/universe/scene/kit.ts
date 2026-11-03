import * as THREE from 'three';
import { COLORS, hdr } from './palette';

/**
 * Shared GPU resources: one material per look, so that hundreds of meshes do not
 * each bind their own program, and the soft sprite every glow is drawn with.
 * Built on first use, on the client, and reused for the life of the page.
 */

export interface Kit {
  /** Dark structural metal: decks, housings, racks. */
  metalDark: THREE.MeshStandardMaterial;
  /** Mid metal for panels and trim. */
  metal: THREE.MeshStandardMaterial;
  /** Bright polished trim that catches the environment. */
  metalBright: THREE.MeshStandardMaterial;
  /** Faceted island rock. */
  rock: THREE.MeshStandardMaterial;
  /** Radial falloff used by every additive glow sprite. */
  glowTexture: THREE.CanvasTexture;
  /** Solid emissive material for a colour and intensity. Cached by key. */
  glow(color: string, intensity: number): THREE.MeshBasicMaterial;
  /** Additive soft sprite material for a colour and opacity. Cached by key. */
  sprite(color: string, opacity: number): THREE.SpriteMaterial;
}

let kit: Kit | null = null;

function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function getKit(): Kit {
  if (kit) return kit;

  const glowTexture = createGlowTexture();
  const glowCache = new Map<string, THREE.MeshBasicMaterial>();
  const spriteCache = new Map<string, THREE.SpriteMaterial>();

  kit = {
    metalDark: new THREE.MeshStandardMaterial({
      color: COLORS.metalDark,
      metalness: 0.85,
      roughness: 0.42,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: COLORS.metal,
      metalness: 0.9,
      roughness: 0.34,
    }),
    metalBright: new THREE.MeshStandardMaterial({
      color: COLORS.metalLight,
      metalness: 1,
      roughness: 0.2,
    }),
    rock: new THREE.MeshStandardMaterial({
      color: COLORS.rock,
      metalness: 0.05,
      roughness: 0.95,
      flatShading: true,
    }),
    glowTexture,
    glow(color, intensity) {
      const key = `${color}:${intensity}`;
      let material = glowCache.get(key);
      if (!material) {
        material = new THREE.MeshBasicMaterial({ color: hdr(color, intensity), toneMapped: false });
        glowCache.set(key, material);
      }
      return material;
    },
    sprite(color, opacity) {
      const key = `${color}:${opacity}`;
      let material = spriteCache.get(key);
      if (!material) {
        material = new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          opacity,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        spriteCache.set(key, material);
      }
      return material;
    },
  };

  return kit;
}
