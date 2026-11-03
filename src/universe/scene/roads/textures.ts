import * as THREE from 'three';
import { createRng } from '@/lib/rng';
import { DECAL_CELLS, nameCell, ROAD_NAMES, type DecalCell } from './decals';
import { DECK_TILE, HULL_TILE, type DeckFamily } from './roadTypes';

/**
 * Canvas-baked surface textures, drawn once at startup. Nothing here runs per
 * frame. Each tile is painted in road units into five greyscale-or-colour layers
 * and then packed into three textures:
 *
 *   map     colour
 *   normal  derived from the painted relief
 *   orm     R emissive mask, G roughness, B metalness
 *
 * Packing the emissive mask into the texture that already carries roughness and
 * metalness keeps each deck to three maps. `materials.ts` reads it back.
 *
 * Tiles run across the road in u and along it in v, and they repeat only in v.
 */

export interface SurfaceMaps {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  orm: THREE.DataTexture;
}

/** What a painted shape writes. Any layer left out is left alone. */
interface Paint {
  albedo?: string;
  /** Height, 0 to 1, with 0.5 the panel surface. */
  relief?: number;
  rough?: number;
  metal?: number;
  /** Emissive mask, 0 to 1. */
  glow?: number;
}

const LAYERS = ['albedo', 'relief', 'rough', 'metal', 'glow'] as const;
type Layer = (typeof LAYERS)[number];

function gray(value: number): string {
  const level = Math.round(Math.min(1, Math.max(0, value)) * 255);
  return `rgb(${level},${level},${level})`;
}

function paintStyle(layer: Layer, paint: Paint): string | null {
  if (layer === 'albedo') return paint.albedo ?? null;
  const value = paint[layer];
  return value === undefined ? null : gray(value);
}

/** Lighten or darken a hex colour by a factor. */
function shade(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(Math.min(255, Math.max(0, ((value >> shift) & 255) * factor)));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

class TileBake {
  private readonly layers = {} as Record<Layer, CanvasRenderingContext2D>;
  readonly rng: () => number;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly across: number,
    readonly along: number,
    seed: number,
    /** Centre x on the canvas: true for road tiles, whose x runs across the centreline. */
    centered = true,
  ) {
    this.rng = createRng(seed);
    for (const layer of LAYERS) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('2D canvas is unavailable');
      context.setTransform(width / across, 0, 0, height / along, centered ? width / 2 : 0, 0);
      this.layers[layer] = context;
    }
  }

  /** Run a drawing routine on every layer the paint touches. */
  private each(paint: Paint, draw: (context: CanvasRenderingContext2D) => void): void {
    for (const layer of LAYERS) {
      const style = paintStyle(layer, paint);
      if (style === null) continue;
      const context = this.layers[layer];
      context.fillStyle = style;
      context.strokeStyle = style;
      draw(context);
    }
  }

  fill(paint: Paint): void {
    this.each(paint, (context) => {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillRect(0, 0, this.width, this.height);
      context.restore();
    });
  }

  rect(x0: number, s0: number, x1: number, s1: number, paint: Paint): void {
    this.each(paint, (context) => context.fillRect(x0, s0, x1 - x0, s1 - s0));
  }

  circle(x: number, s: number, radius: number, paint: Paint): void {
    this.each(paint, (context) => {
      context.beginPath();
      context.arc(x, s, radius, 0, Math.PI * 2);
      context.fill();
    });
  }

  polygon(points: readonly [number, number][], paint: Paint): void {
    this.each(paint, (context) => {
      context.beginPath();
      points.forEach(([x, s], index) => {
        if (index === 0) context.moveTo(x, s);
        else context.lineTo(x, s);
      });
      context.closePath();
      context.fill();
    });
  }

  line(x0: number, s0: number, x1: number, s1: number, width: number, paint: Paint): void {
    this.each(paint, (context) => {
      context.lineWidth = width;
      context.lineCap = 'butt';
      context.beginPath();
      context.moveTo(x0, s0);
      context.lineTo(x1, s1);
      context.stroke();
    });
  }

  arc(
    x: number,
    s: number,
    radius: number,
    from: number,
    to: number,
    width: number,
    paint: Paint,
  ): void {
    this.each(paint, (context) => {
      context.lineWidth = width;
      context.lineCap = 'butt';
      context.beginPath();
      context.arc(x, s, radius, from, to);
      context.stroke();
    });
  }

  /** A machined stud: domed, polished, with a dark socket around it. */
  bolt(x: number, s: number, radius: number): void {
    this.circle(x, s, radius * 1.5, { albedo: '#080a0e', relief: 0.34, rough: 0.8 });
    this.circle(x, s, radius, { albedo: '#5a6474', relief: 0.82, rough: 0.28, metal: 1 });
    this.circle(x - radius * 0.3, s - radius * 0.3, radius * 0.35, {
      albedo: '#8a95a8',
      relief: 0.92,
    });
  }

  /**
   * A recessed panel: a dark seam, a raised face with a soft shade change, and
   * studs at its corners when `studs` is set.
   */
  panel(
    x0: number,
    s0: number,
    x1: number,
    s1: number,
    base: string,
    options: { seam?: number; studs?: number; rough?: number; metal?: number } = {},
  ): void {
    const { seam = 0.035, studs = 0, rough = 0.5, metal = 0.8 } = options;
    this.rect(x0, s0, x1, s1, { albedo: '#07090d', relief: 0.18, rough: 0.9, metal: 0.2 });
    const tone = 0.9 + this.rng() * 0.24;
    this.rect(x0 + seam, s0 + seam, x1 - seam, s1 - seam, {
      albedo: shade(base, tone),
      relief: 0.5 + this.rng() * 0.05,
      rough: rough + (this.rng() - 0.5) * 0.12,
      metal,
    });

    /* A bright worn lip where the panel's edge catches the wheel of passing freight. */
    const lip = seam * 0.7;
    this.rect(x0 + seam, s0 + seam, x1 - seam, s0 + seam + lip, {
      albedo: shade(base, tone * 1.5),
      relief: 0.56,
    });
    this.rect(x0 + seam, s1 - seam - lip, x1 - seam, s1 - seam, {
      albedo: shade(base, tone * 0.72),
      relief: 0.46,
    });

    if (studs > 0) {
      const inset = studs * 2.6 + seam;
      for (const x of [x0 + inset, x1 - inset]) {
        for (const s of [s0 + inset, s1 - inset]) this.bolt(x, s, studs);
      }
    }
  }

  /** Soft blotches of wear. They wrap along the road so the tile has no visible edge. */
  grime(count: number, size: number, strength: number): void {
    const albedo = this.layers.albedo;
    const rough = this.layers.rough;
    for (let i = 0; i < count; i += 1) {
      const x = (this.rng() - 0.5) * this.across;
      const s = this.rng() * this.along;
      const radius = size * (0.4 + this.rng());
      const light = this.rng() > 0.62;
      const alpha = strength * (0.4 + this.rng() * 0.6);

      for (const wrapped of [s - this.along, s, s + this.along]) {
        const gradient = albedo.createRadialGradient(x, wrapped, 0, x, wrapped, radius);
        const tone = light ? '150,170,200' : '0,0,0';
        gradient.addColorStop(0, `rgba(${tone},${alpha})`);
        gradient.addColorStop(1, `rgba(${tone},0)`);
        albedo.fillStyle = gradient;
        albedo.fillRect(x - radius, wrapped - radius, radius * 2, radius * 2);

        const smear = rough.createRadialGradient(x, wrapped, 0, x, wrapped, radius);
        const value = light ? '0,0,0' : '255,255,255';
        smear.addColorStop(0, `rgba(${value},${alpha * 0.9})`);
        smear.addColorStop(1, `rgba(${value},0)`);
        rough.fillStyle = smear;
        rough.fillRect(x - radius, wrapped - radius, radius * 2, radius * 2);
      }
    }
  }

  /** Long thin scuffs, mostly running along the road. */
  scratches(count: number, length: number, strength: number): void {
    const albedo = this.layers.albedo;
    const rough = this.layers.rough;
    for (let i = 0; i < count; i += 1) {
      const x = (this.rng() - 0.5) * this.across;
      const s = this.rng() * this.along;
      const run = length * (0.3 + this.rng());
      const drift = (this.rng() - 0.5) * 0.3;
      const width = 0.012 + this.rng() * 0.02;

      albedo.strokeStyle = `rgba(170,190,220,${strength * (0.3 + this.rng() * 0.7)})`;
      rough.strokeStyle = `rgba(0,0,0,${strength})`;
      for (const context of [albedo, rough]) {
        context.lineWidth = width;
        context.beginPath();
        context.moveTo(x, s);
        context.lineTo(x + run * drift, s + run);
        context.stroke();
      }
    }
  }

  /** Pack the painted layers into textures. */
  finish(options: { normalStrength: number; anisotropy: number; repeatU?: boolean }): SurfaceMaps {
    const { width, height } = this;
    const read = (layer: Layer) => this.layers[layer].getImageData(0, 0, width, height).data;

    const albedo = read('albedo');
    const reliefData = read('relief');
    const rough = read('rough');
    const metal = read('metal');
    const glow = read('glow');

    const noise = createRng(width * 31 + height);
    const colorBytes = new Uint8Array(width * height * 4);
    const ormBytes = new Uint8Array(width * height * 4);
    const relief = new Float32Array(width * height);

    for (let i = 0; i < width * height; i += 1) {
      const p = i * 4;
      /* Fine grain stops large panels looking like flat fills up close. */
      const grain = 1 + (noise() - 0.5) * 0.09;
      colorBytes[p] = Math.min(255, (albedo[p] as number) * grain);
      colorBytes[p + 1] = Math.min(255, (albedo[p + 1] as number) * grain);
      colorBytes[p + 2] = Math.min(255, (albedo[p + 2] as number) * grain);
      colorBytes[p + 3] = 255;

      ormBytes[p] = glow[p] as number;
      ormBytes[p + 1] = Math.min(255, (rough[p] as number) + (noise() - 0.5) * 16);
      ormBytes[p + 2] = metal[p] as number;
      ormBytes[p + 3] = 255;

      relief[i] = ((reliefData[p] as number) + (noise() - 0.5) * 1.4) / 255;
    }

    const normalBytes = normalsFromRelief(relief, width, height, options.normalStrength);

    const configure = (texture: THREE.DataTexture): THREE.DataTexture => {
      texture.wrapS = options.repeatU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = options.anisotropy;
      texture.needsUpdate = true;
      return texture;
    };

    const map = configure(new THREE.DataTexture(colorBytes, width, height, THREE.RGBAFormat));
    map.colorSpace = THREE.SRGBColorSpace;
    const normalMap = configure(
      new THREE.DataTexture(normalBytes, width, height, THREE.RGBAFormat),
    );
    const orm = configure(new THREE.DataTexture(ormBytes, width, height, THREE.RGBAFormat));
    return { map, normalMap, orm };
  }
}

/** A tangent-space normal map from a height field, wrapping along the road. */
function normalsFromRelief(
  relief: Float32Array,
  width: number,
  height: number,
  strength: number,
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  const at = (x: number, y: number) =>
    relief[((y + height) % height) * width + Math.min(width - 1, Math.max(0, x))] as number;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      /* A Sobel kernel softens painted edges into small bevels. */
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const nx = -dx * strength;
      const ny = -dy * strength;
      const length = Math.hypot(nx, ny, 1);
      const p = (y * width + x) * 4;
      bytes[p] = (nx / length) * 127.5 + 127.5;
      bytes[p + 1] = (ny / length) * 127.5 + 127.5;
      bytes[p + 2] = (1 / length) * 127.5 + 127.5;
      bytes[p + 3] = 255;
    }
  }
  return bytes;
}

/* ─────────────────────────────── Road decks ─────────────────────────────── */

/** Texels per world unit. High enough to stay sharp at the chase camera's distance. */
const DECK_RESOLUTION = 118;

function deckBake(family: DeckFamily, seed: number): TileBake {
  const tile = DECK_TILE[family];
  const snap = (value: number) => Math.round(value / 4) * 4;
  return new TileBake(
    snap(tile.across * DECK_RESOLUTION),
    snap(tile.along * DECK_RESOLUTION),
    tile.across,
    tile.along,
    seed,
  );
}

function ringDeck(anisotropy: number): SurfaceMaps {
  const bake = deckBake('ring', 11);
  const { along } = DECK_TILE.ring;
  const steel = '#1b212c';
  bake.fill({ albedo: steel, relief: 0.5, rough: 0.46, metal: 0.82, glow: 0 });

  /* The centre lane: long plates either side of a recessed guide strip. */
  const lane = 0.71;
  for (const [from, to] of [
    [0, 5.4],
    [5.4, along],
  ] as const) {
    bake.panel(-lane, from, -0.09, to, '#1e2530', { studs: 0.026, rough: 0.42 });
    bake.panel(0.09, from, lane, to, '#1e2530', { studs: 0.026, rough: 0.42 });
  }

  /* Side lanes: shorter plates, staggered against the centre so no seam runs across. */
  const sideLength = 3.6;
  for (const side of [-1, 1]) {
    const inner = lane * side;
    const outer = 2.14 * side;
    for (let s = 0; s < along - 0.01; s += sideLength) {
      const x0 = Math.min(inner, outer);
      const x1 = Math.max(inner, outer);
      bake.panel(x0, s, x1, s + sideLength, '#1a202a', { studs: 0.03, rough: 0.48 });

      /* Not every plate is blank: a slatted vent here, a service hatch there. */
      const middle = s + sideLength / 2;
      const center = (x0 + x1) / 2;
      const kind = bake.rng();
      if (kind < 0.42) {
        for (let slot = -4; slot <= 4; slot += 1) {
          const at = middle + slot * 0.17;
          bake.rect(x0 + 0.42, at - 0.05, x1 - 0.42, at + 0.05, {
            albedo: '#07090d',
            relief: 0.24,
            rough: 0.86,
          });
        }
      } else if (kind < 0.8) {
        bake.rect(center - 0.34, middle - 0.56, center + 0.34, middle + 0.56, {
          albedo: '#0a0d13',
          relief: 0.32,
          rough: 0.8,
        });
        bake.rect(center - 0.3, middle - 0.52, center + 0.3, middle + 0.52, {
          albedo: '#222a36',
          relief: 0.56,
          rough: 0.38,
        });
        for (const grip of [-0.26, 0.26]) {
          bake.rect(center - 0.13, middle + grip - 0.035, center + 0.13, middle + grip + 0.035, {
            albedo: '#0a0d13',
            relief: 0.28,
          });
        }
        bake.circle(center + 0.2, middle, 0.018, { albedo: '#ffb26b', glow: 0.8 });
      }
    }
  }

  /* The guide strip. The dashes on it are real strips: see `buildLaneDashes`. */
  bake.rect(-0.09, 0, 0.09, along, { albedo: '#0a0d12', relief: 0.3, rough: 0.7, metal: 0.4 });

  /* Curbs beyond the channels. */
  for (const side of [-1, 1]) {
    const inner = 2.44 * side;
    const outer = 2.7 * side;
    const x0 = Math.min(inner, outer);
    const x1 = Math.max(inner, outer);
    bake.rect(x0, 0, x1, along, { albedo: '#2c3442', relief: 0.56, rough: 0.34, metal: 0.92 });
    for (let s = 0; s < along; s += 0.9) {
      bake.rect(x0, s, x1, s + 0.05, { albedo: '#0b0e13', relief: 0.26, rough: 0.8 });
    }
    for (let s = 0.45; s < along; s += 1.8) bake.bolt((x0 + x1) / 2, s, 0.032);
  }

  bake.grime(46, 1.1, 0.13);
  bake.scratches(60, 0.8, 0.045);
  return bake.finish({ normalStrength: 1.15, anisotropy });
}

function spokeDeck(anisotropy: number): SurfaceMaps {
  const bake = deckBake('spoke', 23);
  const { along } = DECK_TILE.spoke;
  bake.fill({ albedo: '#191e28', relief: 0.5, rough: 0.5, metal: 0.8, glow: 0 });

  for (const side of [-1, 1]) {
    /* Bright steel lips along the spine. */
    const lipA = 0.3 * side;
    const lipB = 0.5 * side;
    bake.rect(Math.min(lipA, lipB), 0, Math.max(lipA, lipB), along, {
      albedo: '#333c4b',
      relief: 0.6,
      rough: 0.3,
      metal: 1,
    });

    /* Transverse ribbed grating: the Spokes read as bridges, not as road. */
    const gridA = 0.56 * side;
    const gridB = 1.58 * side;
    const x0 = Math.min(gridA, gridB);
    const x1 = Math.max(gridA, gridB);
    bake.rect(x0, 0, x1, along, { albedo: '#090b10', relief: 0.24, rough: 0.8, metal: 0.4 });
    const pitch = along / 20;
    for (let i = 0; i < 20; i += 1) {
      const s = i * pitch;
      bake.rect(x0 + 0.02, s + 0.06, x1 - 0.02, s + pitch - 0.06, {
        albedo: shade('#222936', 0.9 + bake.rng() * 0.2),
        relief: 0.6,
        rough: 0.42,
        metal: 0.85,
      });
    }

    /* Outer walkway plates. */
    const walkA = 1.62 * side;
    const walkB = 1.9 * side;
    for (let s = 0; s < along - 0.01; s += along / 4) {
      bake.panel(Math.min(walkA, walkB), s, Math.max(walkA, walkB), s + along / 4, '#222936', {
        studs: 0.022,
        rough: 0.38,
      });
    }

    /* Pin lights flanking the spine. */
    for (let s = 0.2; s < along; s += along / 8) {
      bake.circle(side * 0.4, s, 0.04, { albedo: '#ffc38a', glow: 1 });
    }
  }

  bake.grime(26, 0.9, 0.11);
  bake.scratches(40, 0.7, 0.04);
  return bake.finish({ normalStrength: 1.3, anisotropy });
}

function coreLoopDeck(anisotropy: number): SurfaceMaps {
  const bake = deckBake('coreLoop', 37);
  const { along } = DECK_TILE.coreLoop;
  bake.fill({ albedo: '#141922', relief: 0.5, rough: 0.46, metal: 0.86, glow: 0 });

  /* Long clean plates, the most refined surface in the world: this road rings the crystal. */
  const columns: [number, number][] = [
    [-2.1, -1.68],
    [-1.68, -0.84],
    [-0.84, 0.84],
    [0.84, 1.68],
    [1.68, 2.1],
  ];
  columns.forEach(([x0, x1], column) => {
    const length = column === 2 ? along / 2 : along / 3;
    for (let s = 0; s < along - 0.01; s += length) {
      bake.panel(x0, s, x1, s + length, column === 2 ? '#191f2a' : '#141922', {
        seam: 0.024,
        studs: column === 2 ? 0 : 0.022,
        rough: 0.44,
        metal: 0.86,
      });
    }
  });

  /* Thin cyan seams crossing the centre plates, and pin lights either side. */
  for (let s = 0; s < along - 0.01; s += along / 2) {
    bake.rect(-0.84, s - 0.012, 0.84, s + 0.012, { albedo: '#9fdcff', glow: 0.85 });
  }
  for (let s = along / 4; s < along; s += along / 2) {
    for (const x of [-0.55, -0.28, 0, 0.28, 0.55]) {
      bake.circle(x, s, 0.03, { albedo: '#9fdcff', glow: 0.8 });
    }
  }

  bake.grime(20, 1.1, 0.07);
  bake.scratches(30, 0.8, 0.035);
  return bake.finish({ normalStrength: 0.95, anisotropy });
}

function helixDeck(anisotropy: number): SurfaceMaps {
  const bake = deckBake('helix', 53);
  const { along } = DECK_TILE.helix;
  bake.fill({ albedo: '#11131b', relief: 0.5, rough: 0.46, metal: 0.82, glow: 0 });

  /*
   * A perforated hex grate with light rising through it: the Helix's signature.
   * Each hole is dark at its rim and lit only at its heart, so the deck reads as
   * steel plate over a glow rather than as a lit honeycomb.
   */
  const radius = 0.082;
  const columnStep = radius * 2.05;
  const columns = Math.round((1.24 * 2) / columnStep);
  const rows = Math.round(along / (radius * 1.78));
  const rowStep = along / rows;

  const hexagon = (x: number, s: number, r: number): [number, number][] =>
    Array.from({ length: 6 }, (_, corner): [number, number] => {
      const angle = (corner / 6) * Math.PI * 2 + Math.PI / 6;
      return [x + Math.cos(angle) * r, s + Math.sin(angle) * r];
    });

  for (let row = 0; row < rows; row += 1) {
    const stagger = row % 2 === 0 ? 0 : columnStep / 2;
    for (let column = 0; column <= columns; column += 1) {
      const x = -1.24 + column * columnStep + stagger;
      if (Math.abs(x) > 1.2) continue;
      const s = (row + 0.5) * rowStep;
      const lit = 0.1 + bake.rng() * 0.16;
      bake.polygon(hexagon(x, s, radius * 0.8), {
        albedo: '#04050a',
        relief: 0.16,
        rough: 0.85,
        metal: 0.2,
        glow: lit * 0.28,
      });
      bake.polygon(hexagon(x, s, radius * 0.42), { glow: lit });
    }
  }

  /* Solid edge plates either side of the grate. */
  for (const side of [-1, 1]) {
    const inner = 1.27 * side;
    const outer = 1.7 * side;
    const x0 = Math.min(inner, outer);
    const x1 = Math.max(inner, outer);
    for (let s = 0; s < along - 0.01; s += along / 4) {
      bake.panel(x0, s, x1, s + along / 4, '#232735', { studs: 0.024, rough: 0.34, metal: 0.9 });
    }
  }

  /* A smooth strip down the middle, so the road has a clear line to walk. */
  bake.rect(-0.14, 0, 0.14, along, { albedo: '#191c26', relief: 0.58, rough: 0.62, metal: 0.6 });
  for (let s = 0.3; s < along; s += along / 4) {
    bake.rect(-0.03, s, 0.03, s + 0.9, { albedo: '#e6b4ff', glow: 0.8 });
  }

  bake.grime(20, 0.9, 0.09);
  return bake.finish({ normalStrength: 1.2, anisotropy });
}

function inlayDeck(anisotropy: number): SurfaceMaps {
  const bake = deckBake('inlay', 71);
  const { across, along } = DECK_TILE.inlay;
  const half = across / 2;
  bake.fill({ albedo: '#262e3b', relief: 0.5, rough: 0.4, metal: 0.78, glow: 0 });

  /* Plates across the road. */
  for (let s = 0; s < along - 0.01; s += along / 3) {
    bake.panel(-half + 0.14, s, half - 0.14, s + along / 3, '#262e3b', {
      seam: 0.022,
      studs: 0.024,
      rough: 0.36,
    });
  }

  /* The thin glowing border. */
  for (const side of [-1, 1]) {
    const x = side * (half - 0.1);
    bake.rect(x - 0.022, 0, x + 0.022, along, { albedo: '#d7e6ff', glow: 1 });
    const edgeA = side * (half - 0.05);
    const edgeB = side * half;
    bake.rect(Math.min(edgeA, edgeB), 0, Math.max(edgeA, edgeB), along, {
      albedo: '#3a4556',
      relief: 0.62,
      rough: 0.28,
      metal: 1,
    });
  }

  /* Direction chevrons, faint, so the loop reads as a road and not a stripe. */
  for (let s = 0.6; s < along; s += along / 2) {
    for (const offset of [0, 0.34]) {
      bake.polygon(
        [
          [-0.46, s + offset],
          [0, s + offset + 0.3],
          [0.46, s + offset],
          [0.46, s + offset + 0.09],
          [0, s + offset + 0.39],
          [-0.46, s + offset + 0.09],
        ],
        { albedo: '#3a4556', glow: 0.34 },
      );
    }
  }

  bake.grime(14, 0.8, 0.08);
  return bake.finish({ normalStrength: 1, anisotropy });
}

const DECK_PAINTERS: Record<DeckFamily, (anisotropy: number) => SurfaceMaps> = {
  ring: ringDeck,
  spoke: spokeDeck,
  coreLoop: coreLoopDeck,
  helix: helixDeck,
  inlay: inlayDeck,
};

export function bakeDeck(family: DeckFamily, anisotropy: number): SurfaceMaps {
  return DECK_PAINTERS[family](anisotropy);
}

/* ─────────────────────────────── Hull and plates ────────────────────────── */

/** The structural skin: sides, girders, truss members and portal frames. */
export function bakeHull(anisotropy: number): SurfaceMaps {
  const size = 384;
  const bake = new TileBake(size, size, HULL_TILE, HULL_TILE, 97, false);
  bake.fill({ albedo: '#171c26', relief: 0.5, rough: 0.5, metal: 0.86, glow: 0 });

  /* Frames across the road and stringers along it. */
  const cell = HULL_TILE / 4;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      bake.panel(
        column * cell,
        row * cell,
        (column + 1) * cell,
        (row + 1) * cell,
        '#191f2a',
        { seam: 0.03, studs: 0.03, rough: 0.46, metal: 0.86 },
      );
    }
  }

  for (let row = 0; row < 4; row += 1) {
    bake.rect(0, (row + 0.48) * cell, HULL_TILE, (row + 0.52) * cell, {
      albedo: '#0d1016',
      relief: 0.32,
    });
  }

  bake.grime(30, 0.9, 0.12);
  bake.scratches(30, 0.7, 0.04);
  return bake.finish({ normalStrength: 1, anisotropy, repeatU: true });
}

/** The machined face of a junction plate, seen from above. */
export function bakePlate(anisotropy: number): SurfaceMaps {
  const size = 512;
  const span = 2.2;
  const bake = new TileBake(size, size, span, span, 131, false);
  const center = span / 2;
  bake.fill({ albedo: '#171c25', relief: 0.5, rough: 0.62, metal: 0.8, glow: 0 });

  const ring = (radius: number, width: number, paint: Paint) =>
    bake.arc(center, center, radius, 0, Math.PI * 2, width, paint);

  /* Concentric machining, from the rim inwards. Radius 1 is the plate's edge. */
  ring(0.97, 0.03, { albedo: '#39424f', relief: 0.66, rough: 0.26, metal: 1 });
  ring(0.9, 0.05, { albedo: '#0a0d12', relief: 0.22, rough: 0.8 });
  ring(0.9, 0.018, { albedo: '#dceaff', glow: 1 });
  ring(0.8, 0.012, { albedo: '#0a0d12', relief: 0.3 });
  ring(0.52, 0.02, { albedo: '#0a0d12', relief: 0.26 });
  ring(0.26, 0.016, { albedo: '#0a0d12', relief: 0.3 });
  ring(0.18, 0.012, { albedo: '#dceaff', glow: 0.8 });

  /* Sectored segments between the two main rings. */
  const sectors = 12;
  for (let i = 0; i < sectors; i += 1) {
    const from = (i / sectors) * Math.PI * 2 + 0.05;
    const to = ((i + 1) / sectors) * Math.PI * 2 - 0.05;
    const middle = (from + to) / 2;
    bake.arc(center, center, 0.66, from, to, 0.2, {
      albedo: shade('#1d2430', 0.9 + bake.rng() * 0.25),
      relief: 0.58,
      rough: 0.5,
    });
    bake.circle(center + Math.cos(from) * 0.85, center + Math.sin(from) * 0.85, 0.016, {
      albedo: '#6a7486',
      relief: 0.8,
      rough: 0.3,
      metal: 1,
    });
    bake.line(
      center + Math.cos(middle) * 0.595,
      center + Math.sin(middle) * 0.595,
      center + Math.cos(middle) * 0.73,
      center + Math.sin(middle) * 0.73,
      0.014,
      { albedo: '#dceaff', glow: 0.7 },
    );
  }

  /* Tick ring outside the glow. */
  for (let i = 0; i < 72; i += 1) {
    const angle = (i / 72) * Math.PI * 2;
    const inner = i % 6 === 0 ? 0.92 : 0.94;
    bake.line(
      center + Math.cos(angle) * inner,
      center + Math.sin(angle) * inner,
      center + Math.cos(angle) * 0.955,
      center + Math.sin(angle) * 0.955,
      0.006,
      { albedo: '#8d9ab0', glow: i % 6 === 0 ? 0.5 : 0.16 },
    );
  }

  bake.grime(16, 0.3, 0.08);
  return bake.finish({ normalStrength: 1.1, anisotropy });
}

/** A travelling pulse for the emissive strips: a steady line with a brighter swell. */
export function bakeFlow(): THREE.DataTexture {
  const height = 256;
  const bytes = new Uint8Array(height * 4);
  const swells = [
    { at: 0.16, width: 0.05, gain: 0.32 },
    { at: 0.58, width: 0.08, gain: 0.26 },
    { at: 0.8, width: 0.03, gain: 0.2 },
  ];

  for (let row = 0; row < height; row += 1) {
    const t = row / height;
    let value = 0.68;
    for (const swell of swells) {
      const distance = Math.min(Math.abs(t - swell.at), 1 - Math.abs(t - swell.at));
      value += swell.gain * Math.exp(-((distance / swell.width) ** 2));
    }
    const level = Math.min(255, value * 255);
    const p = row * 4;
    bytes[p] = level;
    bytes[p + 1] = level;
    bytes[p + 2] = level;
    bytes[p + 3] = 255;
  }

  const texture = new THREE.DataTexture(bytes, 1, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** White on black, tinted per vertex and added to the deck. See `decals.ts`. */
export function bakeDecals(anisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  context.fillStyle = '#000';
  context.fillRect(0, 0, size, size);

  /** Run `draw` in a cell's own coordinates: 0 to 1 across, 0 to 1 along the road. */
  const inCell = (cell: DecalCell, draw: () => void) => {
    context.save();
    context.beginPath();
    context.rect(
      cell.u0 * size,
      cell.v0 * size,
      (cell.u1 - cell.u0) * size,
      (cell.v1 - cell.v0) * size,
    );
    context.clip();
    context.translate(cell.u0 * size, cell.v0 * size);
    context.scale((cell.u1 - cell.u0) * size, (cell.v1 - cell.v0) * size);
    draw();
    context.restore();
  };

  inCell(DECAL_CELLS.hazard, () => {
    context.fillStyle = '#fff';
    const count = 15;
    for (let i = -1; i < count + 1; i += 1) {
      const x = i / count;
      const slant = 0.6 / count;
      context.beginPath();
      context.moveTo(x, 0.1);
      context.lineTo(x + 0.5 / count, 0.1);
      context.lineTo(x + 0.5 / count + slant, 0.9);
      context.lineTo(x + slant, 0.9);
      context.closePath();
      context.fill();
    }
    context.fillRect(0, 0, 1, 0.035);
    context.fillRect(0, 0.965, 1, 0.035);
  });

  inCell(DECAL_CELLS.chevrons, () => {
    context.lineWidth = 0.07;
    context.lineJoin = 'miter';
    [0.18, 0.5, 0.82].forEach((s, index) => {
      context.strokeStyle = `rgba(255,255,255,${0.45 + index * 0.27})`;
      context.beginPath();
      context.moveTo(0.1, s - 0.13);
      context.lineTo(0.5, s + 0.1);
      context.lineTo(0.9, s - 0.13);
      context.stroke();
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;

  const paintNames = (family: string) => {
    ROAD_NAMES.forEach((name, index) => {
      const cell = nameCell(index);
      const top = cell.v0 * size;
      const height = (cell.v1 - cell.v0) * size;
      context.fillStyle = '#000';
      context.fillRect(0, top, size, height);
      context.fillStyle = '#fff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 ${Math.round(height * 0.62)}px ${family}`;
      /* Tracked out, as stencilled road lettering is. */
      context.letterSpacing = `${Math.round(height * 0.1)}px`;
      context.fillText(name.toUpperCase(), size / 2, top + height / 2, size * 0.96);
    });
    texture.needsUpdate = true;
  };

  /* Paint at once in whatever is to hand, then again when the road's own face arrives. */
  paintNames('sans-serif');
  const face = new FontFace('RoadSign', 'url(/fonts/Geist-Bold.ttf)');
  void face.load().then((loaded) => {
    document.fonts.add(loaded);
    paintNames('RoadSign');
  });

  return texture;
}
