import { createRng } from '@/lib/rng';
import {
  GLOW_CYAN,
  GLOW_RED,
  GLOW_STAR,
  GLOW_VIOLET,
  GLOW_WHITE,
  artCache,
  buildArt,
  densityBucket,
  type Art,
  type LossAware,
} from './art';
import { TAU } from './geometry';
import {
  LANE_RADII,
  ROAD_INNER,
  ROAD_OUTER,
  rimRadiusAt,
  type Building,
  type FacadeStyle,
  type IslandModel,
  type Tier,
} from './model';
import { CAR_COLORS, FACADES, LIGHT, ROCK_BANDS, ROCK_MOSS, type FacadeLook } from './palette';
import { EMBLEM_PAD, EMBLEM_V0, EMBLEM_V1, GROUND_EXTENT, faceSlot } from './textures';
import { DEG, VARIANTS, type IslandVariant, type VariantConfig } from './variants';

export type { IslandVariant } from './variants';

/**
 * Draws the island with the 2D canvas API, painter's-algorithm style:
 * backdrop glow, far clouds, the rock underside (back-face culled, flat
 * shaded), the island top (one pre-painted texture under an affine
 * transform), traffic on the ground, waterfalls, then buildings, trees and
 * lamps sorted far to near, glows, sparkles, near clouds.
 *
 * Projection is orthographic: the island turns by `theta` about Y and the
 * camera looks down at elevation `phi`, so
 *   x' = x cos(theta) - z sin(theta),  z' = x sin(theta) + z cos(theta)
 *   screenX = cx + x' S,  screenY = cy + z' sin(phi) S - y cos(phi) S
 * and every flat face stays a parallelogram that one `setTransform` can map
 * a texture onto.
 *
 * Budget: on an integrated GPU the cost is the number of draw calls and blend
 * switches, not pixels, so the frame is batched hard: rock facets by colour,
 * one overlay per wall (shade and haze pre-mixed), additive glows in one pass.
 * The frame loop allocates nothing.
 */

export interface IslandView {
  theta: number;
  phi: number;
  /** Seconds of animation time. */
  time: number;
  /** False draws a still frame: no bob, drift, traffic or blinking. */
  motion: boolean;
}

/* ───────────────────────────── Constants ───────────────────────────── */

const SHADE = '#1d1752';
const WARM = '#ffd9e8';
const HAZE = '#ece7ff';
const ROCK_LEVELS = 14;
const RING_POINTS = 72;
/** Wall overlay table: lighting levels x haze levels, pre-mixed into one fill each. */
const LIT_LEVELS = 24;
const HAZE_LEVELS = 6;
const HAZE_MAX = 0.24;
const SPIRE_LEVELS = 12;
/** Additive glows queued during the sorted pass and drawn in one batch. */
const MAX_GLOWS = 96;
/** Per visible wall: device transform (6), normal x/z, slot, X0, Y0, e1x, e1y, e2y, emblem. */
const WALL = 15;

/** Blinn half-vector for glints on glass, horizontal part only (walls are vertical). */
const HALF = (() => {
  const v = { x: 0, y: Math.sin(30 * DEG), z: Math.cos(30 * DEG) };
  const hx = LIGHT.x + v.x;
  const hz = LIGHT.z + v.z;
  const len = Math.hypot(hx, hz);
  return { x: hx / len, z: hz / len };
})();

/** Holographic rings around the tower top: radius, height, tilt, precession and comet speeds. */
const HOLO_RINGS = [
  { r: 0.19, y: 0.83, tilt: 0.24, precess: 0.32, head: 1.15, color: '#8fd3ff', core: '#e4f6ff' },
  { r: 0.235, y: 0.63, tilt: -0.15, precess: -0.21, head: -0.8, color: '#a58bff', core: '#efe9ff' },
] as const;

/** Ground shadow per unit of height, in camera space: right and away from the viewer. */
const SHADOW_X = 0.3;
const SHADOW_Z = -0.2;

/** Light pulses chasing round the kerbs: radius, angular speed, start offset. */
const PULSES: readonly (readonly [number, number, number])[] = [
  [ROAD_INNER + 0.001, 0.62, 0],
  [ROAD_OUTER - 0.001, -0.48, 2.1],
  [ROAD_OUTER - 0.001, -0.48, 5.2],
];

/**
 * Birds circling the island, in camera space so a drag doesn't fling them:
 * orbit radius, height, angular speed, phase, size (half wingspan).
 */
const BIRDS: readonly (readonly [number, number, number, number, number])[] = [
  [1.12, 0.62, 0.21, 0.4, 0.024],
  [1.18, 0.66, 0.21, 0.62, 0.02],
  [1.08, 0.58, 0.21, 0.78, 0.018],
  [1.24, 0.42, -0.16, 3.6, 0.022],
];

/** Shrub positions on garden roofs, in half-extent units. */
const SHRUBS: readonly (readonly [number, number])[] = [
  [-0.45, -0.4],
  [0.4, -0.2],
  [-0.1, 0.45],
];

const DASHES = [
  [0.11, 0.07],
  [0.07, 0.11],
  [0.15, 0.09],
];
const NO_DASH: number[] = [];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

/** Small integer hash in [0, 1), for time-bucketed twinkles without allocation. */
function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const OBJ_BUILDING = 0;
const OBJ_TREE = 1;
const OBJ_LAMP = 2;

/* ───────────────────────────── Renderer ───────────────────────────── */

export class IslandRenderer {
  readonly config: VariantConfig;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly model: IslandModel;
  private readonly buildings: Building[];
  private art: Art | null = null;
  private artBucket = -1;
  private frames = 0;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private S = 1;
  private cx = 0;
  private baseCy = 0;
  private haze: CanvasGradient | null = null;
  private sunWash: CanvasGradient | null = null;
  private bottomFade: CanvasGradient | null = null;

  // Per-frame camera, set at the top of render().
  private cy = 0;
  private cosT = 1;
  private sinT = 0;
  private sinP = 0.5;
  private cosP = 0.87;
  private time = 0;
  private motion = true;

  // Colour tables, built once.
  private readonly rockColors: string[];
  private readonly overlayColor: string[] = [];
  private readonly overlayAlpha = new Float32Array(LIT_LEVELS * HAZE_LEVELS);
  private readonly roofColor = new Map<FacadeStyle, string[]>();
  private readonly spireColor = new Map<string, string[]>();

  // Scratch buffers, allocated once.
  private readonly rockX: Float32Array;
  private readonly rockY: Float32Array;
  private readonly rockZ: Float32Array;
  /** Triangles grouped by stratum, tip first; `bandStart[b]` indexes into it. */
  private readonly bandTris: Uint16Array;
  private readonly bandStart: Uint16Array;
  private readonly triKey: Uint8Array;
  private readonly bucketCount = new Uint16Array(ROCK_LEVELS * 2 + 1);
  private readonly bucketOrder: Uint16Array;
  private readonly objKind: Uint8Array;
  private readonly objRef: Uint16Array;
  private readonly objX: Float32Array;
  private readonly objZ: Float32Array;
  private readonly objKeys: Uint32Array;
  private readonly cosRot: Float32Array;
  private readonly sinRot: Float32Array;
  private readonly ringX = new Float32Array(RING_POINTS + 1);
  private readonly ringY = new Float32Array(RING_POINTS + 1);
  private readonly ringZ = new Float32Array(RING_POINTS + 1);
  private readonly fallRadius: Float32Array;
  private readonly vines: Float32Array;
  private readonly sparkles: Float32Array;
  private readonly glows = new Float32Array(MAX_GLOWS * 5);
  private glowCount = 0;
  private readonly walls = new Float32Array(WALL * 2);
  private readonly fragX: Float32Array;
  private readonly fragY: Float32Array;
  /** First projected vertex of each fragment in fragX / fragY. */
  private readonly fragBase: Uint16Array;
  /** Visible fragment facets, packed as fragment * 256 + triangle. */
  private readonly fragTri: Uint16Array;
  private readonly fragKey: Uint8Array;
  private readonly fragOrder: Uint16Array;

  constructor(ctx: CanvasRenderingContext2D, model: IslandModel, variant: IslandVariant) {
    this.ctx = ctx;
    this.model = model;
    this.config = VARIANTS[variant];
    this.buildings = [model.tower, ...model.buildings];

    const rock = model.rock;
    const vertexCount = rock.positions.length / 3;
    this.rockX = new Float32Array(vertexCount);
    this.rockY = new Float32Array(vertexCount);
    this.rockZ = new Float32Array(vertexCount);
    const triCount = rock.bands.length;
    this.triKey = new Uint8Array(triCount);
    this.bandStart = new Uint16Array(rock.rings + 1);
    const order: number[] = [];
    for (let band = rock.rings - 1, slot = 0; band >= 0; band -= 1, slot += 1) {
      this.bandStart[slot] = order.length;
      for (let t = 0; t < triCount; t += 1) if (rock.bands[t] === band) order.push(t);
    }
    this.bandStart[rock.rings] = order.length;
    this.bandTris = Uint16Array.from(order);
    let widest = 0;
    for (let i = 0; i < rock.rings; i += 1) widest = Math.max(widest, this.bandStart[i + 1]! - this.bandStart[i]!);
    this.bucketOrder = new Uint16Array(widest);

    // Rock colour table: [material][band][level], as ready-made CSS strings.
    this.rockColors = [];
    for (let material = 0; material < 2; material += 1) {
      for (let band = 0; band < ROCK_BANDS.length; band += 1) {
        const [lit, shade] = material === 1 ? ROCK_MOSS : (ROCK_BANDS[band] as readonly [string, string]);
        for (let level = 0; level < ROCK_LEVELS; level += 1) {
          this.rockColors.push(mix(shade, lit, Math.pow(level / (ROCK_LEVELS - 1), 0.9)));
        }
      }
    }

    // One overlay per wall carries both its lighting and its distance haze:
    // two alpha blends folded into a single colour and alpha.
    const shadeRgb = hexToRgb(SHADE);
    const warmRgb = hexToRgb(WARM);
    const hazeRgb = hexToRgb(HAZE);
    for (let li = 0; li < LIT_LEVELS; li += 1) {
      const lit = li / (LIT_LEVELS - 1);
      const tint = lit < 0.55 ? shadeRgb : warmRgb;
      const a = lit < 0.55 ? (0.55 - lit) * 0.95 : (lit - 0.55) * 0.45;
      for (let hi = 0; hi < HAZE_LEVELS; hi += 1) {
        const h = (hi / (HAZE_LEVELS - 1)) * HAZE_MAX;
        const c = a + h - a * h;
        const k = li * HAZE_LEVELS + hi;
        if (c < 0.005) {
          this.overlayColor[k] = '#000';
          this.overlayAlpha[k] = 0;
          continue;
        }
        const channel = (i: 0 | 1 | 2) => Math.round((tint[i] * a * (1 - h) + hazeRgb[i] * h) / c);
        this.overlayColor[k] = `rgb(${channel(0)},${channel(1)},${channel(2)})`;
        this.overlayAlpha[k] = c;
      }
    }
    for (const style of Object.keys(FACADES) as FacadeStyle[]) {
      const roof = FACADES[style].roof;
      const levels: string[] = [];
      for (let hi = 0; hi < HAZE_LEVELS; hi += 1) levels.push(mix(roof, HAZE, (hi / (HAZE_LEVELS - 1)) * HAZE_MAX));
      this.roofColor.set(style, levels);
    }
    for (const base of ['#5b46d8', ...Object.values(FACADES).map((look) => look.roof)]) {
      if (this.spireColor.has(base)) continue;
      const levels: string[] = [];
      for (let i = 0; i < SPIRE_LEVELS; i += 1) {
        const lit = i / (SPIRE_LEVELS - 1);
        levels.push(lit < 0.55 ? mix(base, SHADE, (0.55 - lit) * 0.9) : mix(base, '#ffffff', (lit - 0.55) * 0.6));
      }
      this.spireColor.set(base, levels);
    }

    const objects: [number, number, number, number][] = [];
    this.buildings.forEach((b, i) => objects.push([OBJ_BUILDING, i, b.x, b.z]));
    model.trees.forEach((t, i) => objects.push([OBJ_TREE, i, t.x, t.z]));
    model.lamps.forEach((l, i) => objects.push([OBJ_LAMP, i, l.x, l.z]));
    this.objKind = Uint8Array.from(objects.map((o) => o[0]));
    this.objRef = Uint16Array.from(objects.map((o) => o[1]));
    this.objX = Float32Array.from(objects.map((o) => o[2]));
    this.objZ = Float32Array.from(objects.map((o) => o[3]));
    this.objKeys = new Uint32Array(objects.length);
    this.cosRot = Float32Array.from(this.buildings.map((b) => Math.cos(b.rot)));
    this.sinRot = Float32Array.from(this.buildings.map((b) => Math.sin(b.rot)));
    this.fallRadius = Float32Array.from(model.waterfalls.map((f) => rimRadiusAt(model.rim, f.angle)));

    const fragVerts = model.fragments.reduce((sum, f) => sum + f.positions.length / 3, 0);
    const fragTris = model.fragments.reduce((sum, f) => sum + f.triangles.length / 3, 0);
    this.fragX = new Float32Array(fragVerts);
    this.fragY = new Float32Array(fragVerts);
    this.fragBase = new Uint16Array(model.fragments.length);
    model.fragments.reduce((base, f, i) => {
      this.fragBase[i] = base;
      return base + f.positions.length / 3;
    }, 0);
    this.fragTri = new Uint16Array(fragTris);
    this.fragKey = new Uint8Array(fragTris);
    this.fragOrder = new Uint16Array(fragTris);

    // Roots and vines hanging off the grass lip: length (world units) and sway, per rim segment.
    const rng = createRng((model.seed * 13 + 7) >>> 0);
    const segments = rock.segments;
    this.vines = new Float32Array(segments * 2);
    for (let j = 0; j < segments; j += 1) {
      this.vines[j * 2] = rng() < 0.42 ? 0.025 + rng() * 0.06 : 0;
      this.vines[j * 2 + 1] = (rng() - 0.5) * 0.012;
    }

    // Sparkles in the air around the island: x, y (island units), size, phase, speed.
    const count = 18;
    this.sparkles = new Float32Array(count * 5);
    for (let i = 0; i < count; i += 1) {
      const a = rng() * TAU;
      const r = 0.75 + rng() * 0.5;
      this.sparkles.set(
        [Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.62 - 0.12, 0.035 + rng() * 0.05, rng() * TAU, 0.6 + rng() * 1.2],
        i * 5,
      );
    }
  }

  /** Fit the island into a box of CSS pixels. */
  resize(width: number, height: number, dpr: number) {
    const canvas = this.ctx.canvas;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const f = this.config.frame;
    this.S = Math.max(1, Math.min(width / (2 * f.half), height / (f.top + f.bottom)));
    this.cx = width / 2;
    this.baseCy = (height - (f.top + f.bottom) * this.S) / 2 + f.top * this.S;
    const sinP = Math.sin(this.config.phi);
    const haze = this.ctx.createLinearGradient(0, this.baseCy - sinP * this.S, 0, this.baseCy + 0.2 * this.S);
    haze.addColorStop(0, 'rgba(232, 226, 255, 0.42)');
    haze.addColorStop(0.45, 'rgba(232, 226, 255, 0.1)');
    haze.addColorStop(1, 'rgba(232, 226, 255, 0)');
    this.haze = haze;
    // Low sun from the left: a warm wash on that side of the lawn, cool on the other.
    const wash = this.ctx.createLinearGradient(this.cx - this.S, 0, this.cx + this.S, 0);
    wash.addColorStop(0, 'rgba(255, 206, 178, 0.2)');
    wash.addColorStop(0.45, 'rgba(255, 220, 200, 0)');
    wash.addColorStop(0.6, 'rgba(150, 140, 235, 0)');
    wash.addColorStop(1, 'rgba(150, 140, 235, 0.14)');
    this.sunWash = wash;
    if (this.config.fade > 0) {
      const fade = this.ctx.createLinearGradient(0, height * (1 - this.config.fade), 0, height);
      fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
      this.bottomFade = fade;
    }
  }

  /** Paints (or reuses) art at the current density. Cheap when nothing changed. */
  prepare(): boolean {
    if (this.width < 2 || this.height < 2) return false;
    const bucket = densityBucket(this.S * this.dpr);
    this.frames += 1;
    if (this.art && this.frames % 120 === 0 && (this.art.probe as LossAware | null)?.isContextLost?.()) {
      this.art.lost = true;
    }
    if (this.art?.lost) {
      if (artCache.get(this.artBucket) === this.art) artCache.delete(this.artBucket);
      this.art = null;
    }
    if (bucket !== this.artBucket || !this.art) {
      this.art = artCache.get(bucket) ?? buildArt(this.model, bucket);
      this.artBucket = bucket;
    }
    return true;
  }

  render(view: IslandView) {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!this.prepare()) return;
    const art = this.art as Art;

    this.cosT = Math.cos(view.theta);
    this.sinT = Math.sin(view.theta);
    this.sinP = Math.sin(view.phi);
    this.cosP = Math.cos(view.phi);
    this.time = view.time;
    this.motion = view.motion;
    const bob = view.motion ? Math.sin((view.time * TAU) / 7.5) * this.config.bob * this.S : 0;
    this.cy = this.baseCy + bob;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawBackdrop(art);
    this.drawClouds(art, false);
    this.drawBirds(false);
    this.drawFragments(art, false);
    this.projectRock();
    this.drawRock();
    this.drawFragments(art, true);
    this.drawGround(art);
    this.drawGroundLife(art);
    this.drawWaterfalls(art);
    this.drawObjects(art);
    this.drawGlows(art);
    this.drawSparkles(art);
    this.drawBirds(true);
    this.drawClouds(art, true);
    if (this.bottomFade) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = this.bottomFade;
      ctx.fillRect(0, this.height * (1 - this.config.fade), this.width, this.height * this.config.fade + 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ─────────────── Backdrop and clouds (fixed to the screen) ─────────────── */

  private drawBackdrop(art: Art) {
    const { ctx, cx, S } = this;
    const cy = this.baseCy;
    ctx.globalAlpha = 0.62;
    ctx.drawImage(art.haloViolet, cx - 1.22 * S, cy - 0.92 * S, 2.44 * S, 1.84 * S);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(art.glowPeach, cx - 1.25 * S, cy - 0.95 * S, 1.35 * S, 1.15 * S);
    ctx.globalAlpha = 0.34;
    ctx.drawImage(art.glowPink, cx - 0.95 * S, cy + 0.25 * S, 1.9 * S, 0.85 * S);
    ctx.globalAlpha = 1;
  }

  private drawClouds(art: Art, front: boolean) {
    const { ctx, cx, S, time, motion } = this;
    const cy = this.baseCy;
    const clouds = this.config.clouds;
    for (let i = 0; i < clouds.length; i += 1) {
      const spec = clouds[i]!;
      if (spec.front !== front) continue;
      const sprite = art.clouds[spec.sprite];
      if (!sprite) continue;
      const drift = motion ? Math.sin((time * TAU) / spec.period + spec.phase) * spec.drift : 0;
      const lift = motion ? Math.sin((time * TAU) / (spec.period * 0.55) + spec.phase * 2) * 0.008 : 0;
      const w = spec.w * S;
      const h = (w * sprite.height) / sprite.width;
      ctx.globalAlpha = spec.alpha;
      ctx.drawImage(sprite, cx + (spec.x + drift) * S - w / 2, cy + (spec.y + lift) * S - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /* ───────────────────────────── Rock ───────────────────────────── */

  private projectRock() {
    const { cosT, sinT, sinP, cosP, cx, cy, S } = this;
    const pos = this.model.rock.positions;
    const n = this.rockX.length;
    for (let v = 0; v < n; v += 1) {
      const x = pos[v * 3]!;
      const y = pos[v * 3 + 1]!;
      const z = pos[v * 3 + 2]!;
      const xr = x * cosT - z * sinT;
      const zr = x * sinT + z * cosT;
      this.rockX[v] = cx + xr * S;
      this.rockY[v] = cy + zr * sinP * S - y * cosP * S;
      this.rockZ[v] = zr;
    }
  }

  /**
   * Strata from the tip up, so upper ledges overlap what lies below them;
   * within a stratum, facets are bucketed by colour into one fill each.
   * Back-facing facets are culled, which is enough on a mostly convex rock.
   */
  private drawRock() {
    const { ctx, cosT, sinT, sinP, cosP, rockX, rockY, rockZ, triKey, bucketCount, bucketOrder } = this;
    const rock = this.model.rock;
    const tris = rock.triangles;
    const normals = rock.normals;
    const bandCount = rock.rings;
    const keys = ROCK_LEVELS * 2;

    for (let slot = 0; slot < bandCount; slot += 1) {
      const start = this.bandStart[slot]!;
      const end = this.bandStart[slot + 1]!;
      bucketCount.fill(0);
      for (let i = start; i < end; i += 1) {
        const t = this.bandTris[i]!;
        const nx = normals[t * 3]!;
        const ny = normals[t * 3 + 1]!;
        const nz = normals[t * 3 + 2]!;
        const nzr = nx * sinT + nz * cosT;
        // Back-face cull against the view direction (0, sin phi, cos phi).
        if (ny * sinP + nzr * cosP <= 0) {
          triKey[t] = 255;
          continue;
        }
        const nxr = nx * cosT - nz * sinT;
        const lambert = nxr * LIGHT.x + ny * LIGHT.y + nzr * LIGHT.z;
        // Clouds below bounce a little light back up into the overhangs.
        const bounce = ny < 0 ? -ny * 0.18 : 0;
        let level = Math.round(clamp01(lambert * 0.8 + 0.22 + bounce) * (ROCK_LEVELS - 1)) + rock.jitter[t]!;
        level = level < 0 ? 0 : level >= ROCK_LEVELS ? ROCK_LEVELS - 1 : level;
        const key = rock.moss[t]! * ROCK_LEVELS + level;
        triKey[t] = key;
        bucketCount[key + 1]! += 1;
      }
      // Counting sort by colour key.
      for (let k = 1; k <= keys; k += 1) bucketCount[k]! += bucketCount[k - 1]!;
      for (let i = start; i < end; i += 1) {
        const t = this.bandTris[i]!;
        const key = triKey[t]!;
        if (key === 255) continue;
        bucketOrder[bucketCount[key]!] = t;
        bucketCount[key]! += 1;
      }
      // After the scatter, bucket k spans [count[k-1], count[k]).
      let from = 0;
      for (let key = 0; key < keys; key += 1) {
        const to = bucketCount[key]!;
        if (to === from) continue;
        const band = rock.bands[bucketOrder[from]!]!;
        const material = key >= ROCK_LEVELS ? 1 : 0;
        ctx.fillStyle = this.rockColors[(material * ROCK_BANDS.length + band) * ROCK_LEVELS + (key % ROCK_LEVELS)]!;
        ctx.beginPath();
        for (let i = from; i < to; i += 1) {
          const t = bucketOrder[i]!;
          const a = tris[t * 3]!;
          const b = tris[t * 3 + 1]!;
          const c = tris[t * 3 + 2]!;
          const ax = rockX[a]!;
          const ay = rockY[a]!;
          const bx = rockX[b]!;
          const by = rockY[b]!;
          const qx = rockX[c]!;
          const qy = rockY[c]!;
          // Grow each facet by about half a pixel so neighbours overlap and no seams show.
          const gx = (ax + bx + qx) / 3;
          const gy = (ay + by + qy) / 3;
          let d = Math.hypot(ax - gx, ay - gy) || 1;
          ctx.moveTo(ax + ((ax - gx) / d) * 0.6, ay + ((ay - gy) / d) * 0.6);
          d = Math.hypot(bx - gx, by - gy) || 1;
          ctx.lineTo(bx + ((bx - gx) / d) * 0.6, by + ((by - gy) / d) * 0.6);
          d = Math.hypot(qx - gx, qy - gy) || 1;
          ctx.lineTo(qx + ((qx - gx) / d) * 0.6, qy + ((qy - gy) / d) * 0.6);
          ctx.closePath();
        }
        ctx.fill();
        from = to;
      }
    }

    // Strata: a few ring edges on the near side, as faint seams in the stone.
    const segments = rock.segments;
    ctx.strokeStyle = 'rgba(70, 44, 74, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ring = 3; ring < rock.rings - 1; ring += ring === 3 ? 2 : 1) {
      let open = false;
      for (let j = 0; j <= segments; j += 1) {
        const v = ring * segments + (j % segments);
        if (rockZ[v]! > 0.05) {
          if (open) ctx.lineTo(rockX[v]!, rockY[v]!);
          else ctx.moveTo(rockX[v]!, rockY[v]!);
          open = true;
        } else open = false;
      }
    }
    ctx.stroke();

    // Roots and vines over the lip, near side only.
    const { S, vines } = this;
    ctx.strokeStyle = '#4f8a4d';
    ctx.lineWidth = Math.max(1, S * 0.0042);
    ctx.beginPath();
    for (let j = 0; j < segments; j += 1) {
      const length = vines[j * 2]!;
      if (length === 0 || rockZ[j]! < 0.12) continue;
      const x = rockX[j]!;
      const y = rockY[j]! + 1;
      const sway = vines[j * 2 + 1]! * S;
      const drop = length * cosP * S;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway, y + drop * 0.5, x + sway * 0.4, y + drop);
    }
    ctx.stroke();
  }

  /**
   * Small rocks drifting beside the island, each bobbing, swaying and slowly
   * turning on its own (in camera space, so a drag leaves them be). Those
   * behind go before the rock, the rest after; each layer is one
   * colour-bucketed batch, like the rock itself.
   */
  private drawFragments(art: Art, front: boolean) {
    const { ctx, sinP, cosP, cx, cy, S, time, motion, fragX, fragY, fragTri, fragKey, fragOrder } = this;
    const fragments = this.model.fragments;
    const counts = this.bucketCount;
    counts.fill(0);
    let visible = 0;
    for (let f = 0; f < fragments.length; f += 1) {
      const frag = fragments[f]!;
      const verts = frag.positions.length / 3;
      const triCount = frag.triangles.length / 3;
      const vBase = this.fragBase[f]!;
      const sway = motion ? Math.sin(time * 0.06 + frag.phase * TAU) * 0.1 : 0;
      const fx = frag.radius * Math.cos(frag.angle + sway);
      const fz = frag.radius * Math.sin(frag.angle + sway) * 0.7;
      if (fz > 0 !== front) continue;
      const bob = motion ? Math.sin(time * 0.9 + frag.phase * TAU) * 0.022 : 0;
      const turn = (motion ? time * 0.12 : 0) + frag.phase * TAU;
      const cs = Math.cos(turn);
      const ss = Math.sin(turn);
      for (let v = 0; v < verts; v += 1) {
        const lx = frag.positions[v * 3]! * frag.size;
        const ly = frag.positions[v * 3 + 1]! * frag.size;
        const lz = frag.positions[v * 3 + 2]! * frag.size;
        fragX[vBase + v] = cx + (fx + lx * cs - lz * ss) * S;
        fragY[vBase + v] = cy + (fz + lx * ss + lz * cs) * sinP * S - (frag.y + bob + ly) * cosP * S;
      }
      for (let t = 0; t < triCount; t += 1) {
        const nx0 = frag.normals[t * 3]!;
        const ny = frag.normals[t * 3 + 1]!;
        const nz0 = frag.normals[t * 3 + 2]!;
        const nx = nx0 * cs - nz0 * ss;
        const nz = nx0 * ss + nz0 * cs;
        if (ny * sinP + nz * cosP <= 0) continue;
        const lambert = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;
        const level = Math.round(clamp01(lambert * 0.8 + 0.24) * (ROCK_LEVELS - 1));
        const key = (ny > 0.35 ? ROCK_LEVELS : 0) + level;
        fragTri[visible] = f * 256 + t;
        fragKey[visible] = key;
        counts[key + 1]! += 1;
        visible += 1;
      }
    }
    if (visible === 0) return;
    const keys = ROCK_LEVELS * 2;
    for (let k = 1; k <= keys; k += 1) counts[k]! += counts[k - 1]!;
    for (let i = 0; i < visible; i += 1) {
      const key = fragKey[i]!;
      fragOrder[counts[key]!] = i;
      counts[key]! += 1;
    }
    let from = 0;
    for (let key = 0; key < keys; key += 1) {
      const to = counts[key]!;
      if (to === from) continue;
      const material = key >= ROCK_LEVELS ? 1 : 0;
      ctx.fillStyle = this.rockColors[(material * ROCK_BANDS.length + 3) * ROCK_LEVELS + (key % ROCK_LEVELS)]!;
      ctx.beginPath();
      for (let i = from; i < to; i += 1) {
        const packed = fragTri[fragOrder[i]!]!;
        const f = packed >> 8;
        const t = packed & 0xff;
        const base = this.fragBase[f]!;
        const list = fragments[f]!.triangles;
        const a = base + list[t * 3]!;
        const b = base + list[t * 3 + 1]!;
        const c = base + list[t * 3 + 2]!;
        ctx.moveTo(fragX[a]!, fragY[a]!);
        ctx.lineTo(fragX[b]!, fragY[b]!);
        ctx.lineTo(fragX[c]!, fragY[c]!);
        ctx.closePath();
      }
      ctx.fill();
      from = to;
    }

    // A sapling on the larger ones.
    const sprite = art.trees[0]!;
    const r = art.treeAtlas.rects;
    for (let f = 0; f < fragments.length; f += 1) {
      const frag = fragments[f]!;
      if (frag.size < 0.06) continue;
      const sway = motion ? Math.sin(time * 0.06 + frag.phase * TAU) * 0.1 : 0;
      const fx = frag.radius * Math.cos(frag.angle + sway);
      const fz = frag.radius * Math.sin(frag.angle + sway) * 0.7;
      if (fz > 0 !== front) continue;
      const bob = motion ? Math.sin(time * 0.9 + frag.phase * TAU) * 0.022 : 0;
      const top = frag.y + bob + 0.1 * frag.size;
      const X = cx + fx * S;
      const Y = cy + fz * sinP * S - top * cosP * S;
      const scale = (0.022 * S) / sprite.unit;
      ctx.drawImage(art.treeAtlas.canvas, r[0]!, r[1]!, r[2]!, r[3]!, X - sprite.ax * scale, Y - sprite.ay * scale, r[2]! * scale, r[3]! * scale);
    }
  }

  /* ───────────────────────────── Ground ───────────────────────────── */

  private drawGround(art: Art) {
    const { ctx, cosT, sinT, sinP, cx, cy, S, dpr, rockX, rockY } = this;
    const size = art.ground.width;
    const k = (2 * GROUND_EXTENT) / size;
    const E = GROUND_EXTENT;
    ctx.setTransform(
      S * k * cosT * dpr,
      S * sinP * k * sinT * dpr,
      -S * k * sinT * dpr,
      S * sinP * k * cosT * dpr,
      (cx + S * (-E * cosT + E * sinT)) * dpr,
      (cy + S * sinP * (-E * sinT - E * cosT)) * dpr,
    );
    ctx.drawImage(art.ground, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawShadows();

    // Sunlight and atmospheric haze, along the exact rim outline.
    if (this.haze && this.sunWash) {
      const segments = this.model.rock.segments;
      ctx.beginPath();
      ctx.moveTo(rockX[0]!, rockY[0]!);
      for (let j = 1; j < segments; j += 1) ctx.lineTo(rockX[j]!, rockY[j]!);
      ctx.closePath();
      ctx.fillStyle = this.sunWash;
      ctx.fill();
      ctx.fillStyle = this.haze;
      ctx.fill();
    }
  }

  /**
   * Building shadows on the lawn, all in one path: each is the band swept by
   * the footprint away from the sun (right and back), as long as the building
   * is tall. The part under the building is hidden by the building itself.
   */
  private drawShadows() {
    const { ctx, cosT, sinT, sinP, cx, cy, S } = this;
    ctx.beginPath();
    for (let i = 0; i < this.buildings.length; i += 1) {
      const b = this.buildings[i]!;
      const h = b.tiers[b.tiers.length - 1]!.y1;
      // Shadow vector in camera space (x', z'); a higher sun than the shading
      // light, so long towers don't blanket the island.
      const vx = h * SHADOW_X;
      const vz = h * SHADOW_Z;
      const c = this.cosRot[i]! * cosT - this.sinRot[i]! * sinT;
      const s = this.sinRot[i]! * cosT + this.cosRot[i]! * sinT;
      const bx = b.x * cosT - b.z * sinT;
      const bz = b.x * sinT + b.z * cosT;
      // Of the four corners, the two furthest apart across the shadow's direction.
      const px = -vz;
      const pz = vx;
      let minD = Infinity;
      let maxD = -Infinity;
      let ax = 0;
      let az = 0;
      let qx = 0;
      let qz = 0;
      for (let k = 0; k < 4; k += 1) {
        const su = k === 1 || k === 2 ? 1 : -1;
        const sv = k >= 2 ? 1 : -1;
        const x = bx + su * c * b.hw - sv * s * b.hd;
        const z = bz + su * s * b.hw + sv * c * b.hd;
        const d = x * px + z * pz;
        if (d < minD) {
          minD = d;
          ax = x;
          az = z;
        }
        if (d > maxD) {
          maxD = d;
          qx = x;
          qz = z;
        }
      }
      ctx.moveTo(cx + ax * S, cy + az * sinP * S);
      ctx.lineTo(cx + qx * S, cy + qz * sinP * S);
      ctx.lineTo(cx + (qx + vx) * S, cy + (qz + vz) * sinP * S);
      ctx.lineTo(cx + (ax + vx) * S, cy + (az + vz) * sinP * S);
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(46, 38, 110, 0.13)';
    ctx.fill();
  }

  /** World (x, z) on the ground to screen. */
  private setGroundSpace() {
    const { ctx, cosT, sinT, sinP, cx, cy, S, dpr } = this;
    ctx.setTransform(S * cosT * dpr, S * sinP * sinT * dpr, -S * sinT * dpr, S * sinP * cosT * dpr, cx * dpr, cy * dpr);
  }

  private drawGroundLife(art: Art) {
    const { ctx, time, motion, cosT, sinT, sinP, cx, cy, S, dpr } = this;
    const cars = this.model.cars;
    this.setGroundSpace();
    ctx.globalCompositeOperation = 'lighter';

    if (motion) {
      // Light pulses chasing round the kerbs, fading toward the tail.
      ctx.strokeStyle = '#8fd8ff';
      for (let p = 0; p < PULSES.length; p += 1) {
        const pulse = PULSES[p]!;
        const radius = pulse[0];
        const speed = pulse[1];
        const offset = pulse[2];
        const head = time * speed + offset;
        const dir = speed > 0 ? 1 : -1;
        for (let s = 0; s < 3; s += 1) {
          ctx.globalAlpha = 0.62 - s * 0.18;
          ctx.lineWidth = 0.009 - s * 0.0016;
          const a1 = head - dir * s * 0.09;
          const a0 = head - dir * (s + 1) * 0.09;
          ctx.beginPath();
          ctx.arc(0, 0, radius, Math.min(a0, a1), Math.max(a0, a1));
          ctx.stroke();
        }
      }
      // A ring of violet light breathing out from the tower's base.
      const phase = (time * 0.32) % 1;
      ctx.globalAlpha = (1 - phase) * 0.55;
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 0.006;
      ctx.beginPath();
      ctx.arc(0, 0, 0.111 + phase * 0.05, 0, TAU);
      ctx.stroke();
    }

    // Light trails, one path per colour.
    ctx.lineWidth = 0.006;
    ctx.globalAlpha = 0.3;
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.strokeStyle = pass === 0 ? '#9fdcff' : '#ffb3d6';
      ctx.beginPath();
      for (let i = 0; i < cars.length; i += 1) {
        const car = cars[i]!;
        if (car.color % 2 !== pass) continue;
        const radius = LANE_RADII[car.lane as 0 | 1 | 2 | 3];
        const angle = car.angle + (motion ? car.speed * time : 0);
        const dir = car.speed > 0 ? 1 : -1;
        const a1 = angle - dir * 0.03;
        const a0 = angle - dir * 0.2;
        const lo = Math.min(a0, a1);
        ctx.moveTo(radius * Math.cos(lo), radius * Math.sin(lo));
        ctx.arc(0, 0, radius, lo, Math.max(a0, a1));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Bodies, each in its own frame along the lane.
    const ga = S * cosT;
    const gb = S * sinP * sinT;
    const gc = -S * sinT;
    const gd = S * sinP * cosT;
    const L = 0.03;
    const W = 0.0145;
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i]!;
      const radius = LANE_RADII[car.lane as 0 | 1 | 2 | 3];
      const angle = car.angle + (motion ? car.speed * time : 0);
      const dir = car.speed > 0 ? 1 : -1;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const tx = -Math.sin(angle) * dir;
      const tz = Math.cos(angle) * dir;
      ctx.setTransform(
        (ga * tx + gc * tz) * dpr,
        (gb * tx + gd * tz) * dpr,
        (-ga * tz + gc * tx) * dpr,
        (-gb * tz + gd * tx) * dpr,
        (ga * x + gc * z + cx) * dpr,
        (gb * x + gd * z + cy) * dpr,
      );
      ctx.fillStyle = CAR_COLORS[car.color % CAR_COLORS.length]!;
      ctx.fillRect(-L / 2, -W / 2, L, W);
      ctx.fillStyle = '#5263a8';
      ctx.fillRect(-L * 0.1, -W * 0.36, L * 0.36, W * 0.72);
    }

    // Head and tail lights, in one additive batch.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const glow = S * 0.034;
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i]!;
      const radius = LANE_RADII[car.lane as 0 | 1 | 2 | 3];
      const angle = car.angle + (motion ? car.speed * time : 0);
      const dir = car.speed > 0 ? 1 : -1;
      const tx = -Math.sin(angle) * dir;
      const tz = Math.cos(angle) * dir;
      for (let end = 1; end >= -1; end -= 2) {
        const x = radius * Math.cos(angle) + tx * end * L * 0.55;
        const z = radius * Math.sin(angle) + tz * end * L * 0.55;
        const X = cx + (x * cosT - z * sinT) * S;
        const Y = cy + (x * sinT + z * cosT) * sinP * S;
        const size = end > 0 ? glow : glow * 0.7;
        ctx.globalAlpha = end > 0 ? 0.85 : 0.7;
        this.blitGlow(art, end > 0 ? GLOW_WHITE : GLOW_RED, X - size / 2, Y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ───────────────────────────── Waterfalls ───────────────────────────── */

  private drawWaterfalls(art: Art) {
    const { ctx, cosT, sinT, sinP, cosP, cx, cy, S, dpr, time, motion } = this;
    const falls = this.model.waterfalls;
    for (let i = 0; i < falls.length; i += 1) {
      const fall = falls[i]!;
      const R = this.fallRadius[i]!;
      const ca = Math.cos(fall.angle);
      const sa = Math.sin(fall.angle);
      const px = R * ca;
      const pz = R * sa;
      const xr = px * cosT - pz * sinT;
      const zr = px * sinT + pz * cosT;
      const facing = zr / R;
      // Behind the rock from here on; fade out as it rounds the side.
      if (facing < -0.12) continue;
      const alpha = clamp01((facing + 0.12) / 0.4);
      const txr = -sa * cosT - ca * sinT;
      const tzr = -sa * sinT + ca * cosT;
      const half = fall.width / 2;
      let lx = cx + (xr - txr * half) * S;
      let ly = cy + (zr - tzr * half) * sinP * S;
      let rx = cx + (xr + txr * half) * S;
      let ry = cy + (zr + tzr * half) * sinP * S;
      if (rx < lx) {
        const tx = lx;
        const ty = ly;
        lx = rx;
        ly = ry;
        rx = tx;
        ry = ty;
      }
      const e1x = rx - lx;
      const e1y = ry - ly;
      if (e1x < 0.5) continue;
      // The water leans outward as it leaves the lip.
      const e2x = (xr / R) * 0.07 * S;
      const e2y = fall.drop * cosP * S + (zr / R) * 0.07 * sinP * S;
      ctx.setTransform(e1x * dpr, e1y * dpr, e2x * dpr, e2y * dpr, lx * dpr, (ly - 1) * dpr);
      ctx.globalAlpha = alpha;
      ctx.drawImage(art.water, 0, 0, 1, 1);

      // Streaks rushing down; three dash rhythms so they never march in step.
      ctx.strokeStyle = '#ffffff';
      for (let g = 0; g < 3; g += 1) {
        ctx.setLineDash(DASHES[g]!);
        ctx.lineDashOffset = motion ? -time * (0.55 + g * 0.22) - i * 0.3 : -g * 0.05;
        ctx.lineWidth = 0.075 - g * 0.012;
        for (let segment = 0; segment < 2; segment += 1) {
          ctx.globalAlpha = alpha * (segment === 0 ? 0.75 : 0.32);
          ctx.beginPath();
          for (let s = 0; s < 3; s += 1) {
            const u = 0.18 + (((g * 3 + s) * 0.0745) % 0.66);
            ctx.moveTo(u, segment === 0 ? 0.02 : 0.42);
            ctx.lineTo(u, segment === 0 ? 0.42 : 0.74);
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash(NO_DASH);
      ctx.lineDashOffset = 0;

      // Foam at the lip and mist where the water gives out.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const midX = lx + e1x / 2;
      const midY = ly + e1y / 2;
      const foamW = e1x * 1.5 + 4;
      const foamH = S * 0.035;
      ctx.globalAlpha = alpha * 0.9;
      this.blitGlow(art, GLOW_WHITE, midX - foamW / 2, midY - foamH / 2, foamW, foamH);
      const mist = art.clouds[2];
      if (mist) {
        const pulse = motion ? 1 + Math.sin(time * 1.3 + i * 2) * 0.06 : 1;
        const mw = Math.max(e1x * 3.2, S * 0.2) * pulse;
        const mh = (mw * mist.height) / mist.width;
        ctx.globalAlpha = alpha * 0.92;
        ctx.drawImage(mist, midX + e2x * 0.85 - mw / 2, midY + e2y * 0.8 - mh * 0.55, mw, mh);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ───────────────────── Buildings, trees and lamps ───────────────────── */

  private drawObjects(art: Art) {
    const { cosT, sinT, objX, objZ, objKeys, objKind, objRef } = this;
    const n = objKeys.length;
    for (let i = 0; i < n; i += 1) {
      const depth = objX[i]! * sinT + objZ[i]! * cosT;
      objKeys[i] = Math.round((depth + 1.3) * 25000) * 65536 + i;
    }
    objKeys.sort();
    this.glowCount = 0;
    for (let i = 0; i < n; i += 1) {
      const index = objKeys[i]! & 0xffff;
      const ref = objRef[index]!;
      const kind = objKind[index]!;
      if (kind === OBJ_BUILDING) this.drawBuilding(art, ref);
      else if (kind === OBJ_TREE) this.drawTree(art, ref);
      else this.drawLamp(ref);
    }
  }

  /** Queue an additive glow for the batch after the sorted pass. */
  private queueGlow(x: number, y: number, size: number, kind: number, alpha: number) {
    if (this.glowCount >= MAX_GLOWS) return;
    const o = this.glowCount * 5;
    this.glows[o] = x;
    this.glows[o + 1] = y;
    this.glows[o + 2] = size;
    this.glows[o + 3] = kind;
    this.glows[o + 4] = alpha;
    this.glowCount += 1;
  }

  /** Lamp heads and aircraft lights. Glows sit on top, as bloom would. */
  private drawGlows(art: Art) {
    const { ctx, glows } = this;
    if (this.glowCount === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.glowCount; i += 1) {
      const o = i * 5;
      const size = glows[o + 2]!;
      ctx.globalAlpha = glows[o + 4]!;
      this.blitGlow(art, glows[o + 3]!, glows[o]! - size / 2, glows[o + 1]! - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draws one sprite from the packed glow atlas. */
  private blitGlow(art: Art, kind: number, x: number, y: number, w: number, h: number) {
    const r = art.glow.rects;
    const o = kind * 4;
    this.ctx.drawImage(art.glow.canvas, r[o]!, r[o + 1]!, r[o + 2]!, r[o + 3]!, x, y, w, h);
  }

  private drawTree(art: Art, index: number) {
    const tree = this.model.trees[index]!;
    const sprite = art.trees[tree.kind]!;
    const { cosT, sinT, sinP, cx, cy, S } = this;
    const X = cx + (tree.x * cosT - tree.z * sinT) * S;
    const Y = cy + (tree.x * sinT + tree.z * cosT) * sinP * S;
    const scale = (tree.size * S) / sprite.unit;
    const r = art.treeAtlas.rects;
    const o = tree.kind * 4;
    this.ctx.drawImage(
      art.treeAtlas.canvas,
      r[o]!,
      r[o + 1]!,
      r[o + 2]!,
      r[o + 3]!,
      X - sprite.ax * scale,
      Y - sprite.ay * scale,
      r[o + 2]! * scale,
      r[o + 3]! * scale,
    );
  }

  private drawLamp(index: number) {
    const lamp = this.model.lamps[index]!;
    const { ctx, cosT, sinT, sinP, cosP, cx, cy, S } = this;
    const depth = lamp.x * sinT + lamp.z * cosT;
    const X = cx + (lamp.x * cosT - lamp.z * sinT) * S;
    const Y = cy + depth * sinP * S;
    const top = Y - 0.034 * cosP * S;
    const w = Math.max(1, S * 0.0036);
    ctx.fillStyle = '#eceaf8';
    ctx.fillRect(X - w / 2, top, w, Y - top);
    // Far lamps sit among the towers; leave their glow to the kerb lights.
    if (depth > -0.15) this.queueGlow(X, top, S * 0.05, GLOW_CYAN, 0.9);
  }

  private drawBuilding(art: Art, index: number) {
    const b = this.buildings[index]!;
    const { cosT, sinT } = this;
    const cr = this.cosRot[index]!;
    const sr = this.sinRot[index]!;
    // Footprint axes after the island's turn, by angle addition rather than trig.
    const c = cr * cosT - sr * sinT;
    const s = sr * cosT + cr * sinT;
    const bx = b.x * cosT - b.z * sinT;
    const bz = b.x * sinT + b.z * cosT;
    const tower = index === 0;
    if (tower) this.drawHoloRings(art, false);
    const last = b.tiers.length - 1;
    for (let t = 0; t <= last; t += 1) this.drawTier(art, index, b, t, b.tiers[t]!, c, s, bx, bz, t === last);
    if (b.topper > 0) this.drawTopper(b, index, c, s, bx, bz);
    if (tower) this.drawHoloRings(art, true);
  }

  /**
   * Fills the scratch record for one wall, if it isn't edge-on. The texture's
   * unit square maps onto the wall: u from the wall's left edge (as the camera
   * sees it) to its right, v from top to bottom.
   */
  private prepWall(
    w: number,
    slot: number,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    nx: number,
    nz: number,
    tier: Tier,
    emblem: boolean,
  ): boolean {
    const { sinP, cosP, cx, cy, S, dpr, walls } = this;
    let lx = ax;
    let lz = az;
    let rx = bx;
    let rz = bz;
    if (rx < lx) {
      lx = bx;
      lz = bz;
      rx = ax;
      rz = az;
    }
    const e1x = (rx - lx) * S;
    if (e1x < 0.4) return false;
    const e1y = (rz - lz) * sinP * S;
    const e2y = (tier.y1 - tier.y0) * cosP * S;
    const X0 = cx + lx * S;
    const Y0 = cy + lz * sinP * S - tier.y1 * cosP * S;
    const o = w * WALL;
    walls[o] = e1x * dpr;
    walls[o + 1] = e1y * dpr;
    walls[o + 2] = 0;
    walls[o + 3] = e2y * dpr;
    walls[o + 4] = X0 * dpr;
    walls[o + 5] = Y0 * dpr;
    walls[o + 6] = nx;
    walls[o + 7] = nz;
    walls[o + 8] = slot;
    walls[o + 9] = X0;
    walls[o + 10] = Y0;
    walls[o + 11] = e1x;
    walls[o + 12] = e1y;
    walls[o + 13] = e2y;
    walls[o + 14] = emblem ? 1 : 0;
    return true;
  }

  private setWall(w: number) {
    const o = w * WALL;
    const m = this.walls;
    this.ctx.setTransform(m[o]!, m[o + 1]!, m[o + 2]!, m[o + 3]!, m[o + 4]!, m[o + 5]!);
  }

  /**
   * One tier: both walls' textures, then both walls' light overlays, then the
   * roof as a transformed rectangle. Grouping like with like lets the canvas
   * merge each group into a single GPU draw.
   */
  private drawTier(
    art: Art,
    index: number,
    b: Building,
    t: number,
    tier: Tier,
    c: number,
    s: number,
    bx: number,
    bz: number,
    isTop: boolean,
  ) {
    const { ctx, cosT, sinT, sinP, cosP, cx, cy, S, dpr, time, motion, walls } = this;
    const look = FACADES[tier.style];
    const ux = c * tier.hw;
    const uz = s * tier.hw;
    const vx = -s * tier.hd;
    const vz = c * tier.hd;
    const depth = bz;
    const hazeLevel =
      depth < -0.08 ? Math.min(HAZE_LEVELS - 1, Math.round((((-depth - 0.08) * 0.26) / HAZE_MAX) * (HAZE_LEVELS - 1))) : 0;
    const emblem = tier.style === 'towerMain';

    // Width wall: +v when it faces the camera (c > 0), else -v. Depth wall: +u when s > 0, else -u.
    // Corners (camera space, ground level): c0 = -u-v, c1 = +u-v, c2 = +u+v, c3 = -u+v.
    let count = 0;
    const wSlot = faceSlot(index, t, 0);
    const dSlot = faceSlot(index, t, 1);
    if (c > 0) {
      if (this.prepWall(count, wSlot, bx + ux + vx, bz + uz + vz, bx - ux + vx, bz - uz + vz, -s, c, tier, emblem)) count += 1;
    } else if (this.prepWall(count, wSlot, bx - ux - vx, bz - uz - vz, bx + ux - vx, bz + uz - vz, s, -c, tier, emblem)) {
      count += 1;
    }
    if (s > 0) {
      if (this.prepWall(count, dSlot, bx + ux - vx, bz + uz - vz, bx + ux + vx, bz + uz + vz, c, s, tier, false)) count += 1;
    } else if (this.prepWall(count, dSlot, bx - ux + vx, bz - uz + vz, bx - ux - vx, bz - uz - vz, -c, -s, tier, false)) {
      count += 1;
    }

    const atlas = art.atlas;
    const rects = atlas.rects;
    for (let w = 0; w < count; w += 1) {
      this.setWall(w);
      const o = walls[w * WALL + 8]! * 4;
      ctx.drawImage(atlas.canvas, rects[o]!, rects[o + 1]!, rects[o + 2]!, rects[o + 3]!, 0, 0, 1, 1);
    }

    // Sun from the upper left: lit walls warm, shaded walls sink to indigo, far walls haze over.
    for (let w = 0; w < count; w += 1) {
      const nx = walls[w * WALL + 6]!;
      const nz = walls[w * WALL + 7]!;
      const lit = clamp01((nx * LIGHT.x + nz * LIGHT.z + 0.3) / 1.1);
      const k = Math.round(lit * (LIT_LEVELS - 1)) * HAZE_LEVELS + hazeLevel;
      const alpha = this.overlayAlpha[k]!;
      if (alpha === 0) continue;
      this.setWall(w);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.overlayColor[k]!;
      ctx.fillRect(0, 0, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Now and then a window on a taller wall switches on.
    if (motion && tier.y1 - tier.y0 > 0.18 && depth > -0.75) {
      for (let w = 0; w < count; w += 1) {
        const slot = walls[w * WALL + 8]!;
        if (hash01(slot, Math.floor(time / 1.9 + slot * 0.37)) >= 0.3) continue;
        this.setWall(w);
        const tw = slot * 8;
        ctx.fillStyle = atlas.twinkleColors[slot * 2]!;
        ctx.fillRect(atlas.twinkles[tw]!, atlas.twinkles[tw + 1]!, atlas.twinkles[tw + 2]!, atlas.twinkles[tw + 3]!);
      }
    }

    // Glass flashes as a wall turns through the reflection of the light.
    if (look.kind === 'glass' || look.kind === 'tower' || look.kind === 'crown') {
      for (let w = 0; w < count; w += 1) {
        const spec = walls[w * WALL + 6]! * HALF.x + walls[w * WALL + 7]! * HALF.z;
        if (spec <= 0.8) continue;
        const q = (spec - 0.8) / 0.2;
        this.setWall(w);
        ctx.globalAlpha = q * q * 0.6;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(art.sheen, 0, 0, 1, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }

    // Roof: the footprint rectangle in the roof's own plane.
    const ga = S * cosT;
    const gb = S * sinP * sinT;
    const gc = -S * sinT;
    const gd = S * sinP * cosT;
    const gf = cy - tier.y1 * cosP * S;
    const cr = this.cosRot[index]!;
    const sr = this.sinRot[index]!;
    ctx.setTransform(
      (ga * cr + gc * sr) * dpr,
      (gb * cr + gd * sr) * dpr,
      (-ga * sr + gc * cr) * dpr,
      (-gb * sr + gd * cr) * dpr,
      (ga * b.x + gc * b.z + cx) * dpr,
      (gb * b.x + gd * b.z + gf) * dpr,
    );
    ctx.fillStyle = this.roofColor.get(tier.style)![hazeLevel]!;
    ctx.fillRect(-tier.hw, -tier.hd, tier.hw * 2, tier.hd * 2);
    if (isTop) this.drawRoofDetail(b, tier, look);

    // The tower's "O", lit from within, so it goes on after the shading.
    for (let w = 0; w < count; w += 1) {
      const o = w * WALL;
      const nz = walls[o + 7]!;
      if (walls[o + 14] !== 1 || nz <= 0.1) continue;
      const uw = 0.8;
      const v0 = EMBLEM_V0 + 0.01;
      const vh = EMBLEM_V1 - EMBLEM_V0 - 0.02;
      const grow = 1 / (1 - 2 * EMBLEM_PAD);
      const pulse = motion ? 0.9 + Math.sin(time * 1.6) * 0.1 : 1;
      this.setWall(w);
      ctx.globalAlpha = pulse;
      ctx.drawImage(art.emblem, 0.5 - (uw * grow) / 2, v0 + vh / 2 - (vh * grow) / 2, uw * grow, vh * grow);
      // Bloom, in screen space so it stays round however the wall is skewed.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gx = walls[o + 9]! + walls[o + 11]! * 0.5;
      const gy = walls[o + 10]! + walls[o + 12]! * 0.5 + walls[o + 13]! * (v0 + vh / 2);
      const size = S * 0.42;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 * nz * pulse;
      this.blitGlow(art, GLOW_VIOLET, gx - size / 2, gy - size / 2, size, size);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Rooftop furniture, in the roof plane (the current transform). */
  private drawRoofDetail(b: Building, tier: Tier, look: FacadeLook) {
    const { ctx, S, time, motion } = this;
    if (b.roof === 'flat' || b.roof === 'spire' || b.roof === 'antenna') return;
    const hw = tier.hw;
    const hd = tier.hd;
    // Too small to read: skip rather than spend draw calls on a few pixels.
    if (Math.min(hw, hd) * S < 4) return;
    switch (b.roof) {
      case 'ac': {
        ctx.fillStyle = '#d6d2e8';
        ctx.fillRect(-hw * 0.55, -hd * 0.5, hw * 0.5, hd * 0.42);
        ctx.fillRect(hw * 0.1, hd * 0.05, hw * 0.42, hd * 0.5);
        break;
      }
      case 'helipad': {
        const r = Math.min(hw, hd) * 0.72;
        ctx.fillStyle = '#4f5384';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.rect(-r * 0.36, -r * 0.42, r * 0.14, r * 0.84);
        ctx.rect(r * 0.22, -r * 0.42, r * 0.14, r * 0.84);
        ctx.rect(-r * 0.3, -r * 0.07, r * 0.6, r * 0.14);
        ctx.fill();
        break;
      }
      case 'garden': {
        ctx.fillStyle = '#8fcf6f';
        ctx.fillRect(-hw * 0.82, -hd * 0.82, hw * 1.64, hd * 1.64);
        ctx.fillStyle = '#5ea85a';
        ctx.beginPath();
        const shrub = Math.min(hw, hd) * 0.24;
        for (let i = 0; i < SHRUBS.length; i += 1) {
          const spot = SHRUBS[i]!;
          ctx.moveTo(spot[0] * hw + shrub, spot[1] * hd);
          ctx.arc(spot[0] * hw, spot[1] * hd, shrub, 0, TAU);
        }
        ctx.fill();
        break;
      }
      case 'crown': {
        ctx.globalCompositeOperation = 'lighter';
        const glow = motion ? 0.75 + Math.sin(time * 1.4 + b.phase * TAU) * 0.25 : 0.9;
        ctx.strokeStyle = look.kind === 'pavilion' ? '#7fd3ff' : '#b8a3ff';
        ctx.globalAlpha = 0.35 * glow;
        ctx.lineWidth = 0.014;
        ctx.strokeRect(-hw * 0.92, -hd * 0.92, hw * 1.84, hd * 1.84);
        ctx.globalAlpha = 0.95 * glow;
        ctx.lineWidth = 0.004;
        ctx.strokeRect(-hw * 0.92, -hd * 0.92, hw * 1.84, hd * 1.84);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      default:
        break;
    }
  }

  /** Spires and antennas; their blinking lights join the glow batch. */
  private drawTopper(b: Building, index: number, c: number, s: number, bx: number, bz: number) {
    const { ctx, sinP, cosP, cx, cy, S, time, motion } = this;
    const tier = b.tiers[b.tiers.length - 1]!;
    const tower = index === 0;
    const baseY = tier.y1;
    const spire = b.roof === 'spire';
    const spireH = spire ? (tower ? 0.1 : b.topper) : 0;
    const X = cx + bx * S;
    const groundY = cy + bz * sinP * S;

    if (spire) {
      const apexY = groundY - (baseY + spireH) * cosP * S;
      const ux = c * tier.hw;
      const uz = s * tier.hw;
      const vx = -s * tier.hd;
      const vz = c * tier.hd;
      const shades = this.spireColor.get(tower ? '#5b46d8' : FACADES[tier.style].roof)!;
      // Sides: -v, +u, +v, -u, each with its outward horizontal normal (camera space).
      for (let side = 0; side < 4; side += 1) {
        const sx = side === 0 ? -vx : side === 1 ? ux : side === 2 ? vx : -ux;
        const sz = side === 0 ? -vz : side === 1 ? uz : side === 2 ? vz : -uz;
        const extent = side % 2 === 0 ? tier.hd : tier.hw;
        const nxh = sx / extent;
        const nzh = sz / extent;
        // Visible if the sloped face's normal (nxh H, e, nzh H) points toward the camera.
        if (nzh * spireH * cosP + extent * sinP <= 0) continue;
        const ex = side % 2 === 0 ? ux : vx;
        const ez = side % 2 === 0 ? uz : vz;
        const ax = bx + sx + ex;
        const az = bz + sz + ez;
        const qx = bx + sx - ex;
        const qz = bz + sz - ez;
        const len = Math.hypot(spireH, extent);
        const lambert = (nxh * spireH * LIGHT.x + extent * LIGHT.y + nzh * spireH * LIGHT.z) / len;
        ctx.beginPath();
        ctx.moveTo(cx + ax * S, cy + az * sinP * S - baseY * cosP * S);
        ctx.lineTo(cx + qx * S, cy + qz * sinP * S - baseY * cosP * S);
        ctx.lineTo(X, apexY);
        ctx.closePath();
        ctx.fillStyle = shades[Math.round(clamp01(lambert * 0.9 + 0.25) * (SPIRE_LEVELS - 1))]!;
        ctx.fill();
      }
    }

    // Mast, and the light at its tip.
    const mastBase = baseY + spireH;
    const mastTop = tower ? b.topper + baseY : spire ? mastBase + 0.012 : baseY + b.topper;
    const y1 = groundY - mastTop * cosP * S;
    if (mastTop > mastBase) {
      const w = Math.max(1, S * (tower ? 0.0045 : 0.003));
      ctx.fillStyle = tower ? '#d9d2ff' : '#d6d3e8';
      ctx.fillRect(X - w / 2, y1, w, (mastTop - mastBase) * cosP * S);
    }
    const blink = motion ? Math.pow(0.5 + 0.5 * Math.sin(time * 3.2 + b.phase * TAU), 3) : 0.8;
    if (tower) {
      this.queueGlow(X, y1, S * 0.12 * (0.7 + blink * 0.3), GLOW_VIOLET, 0.65 + blink * 0.35);
      this.queueGlow(X, y1, S * 0.03, GLOW_WHITE, 0.9);
    } else {
      this.queueGlow(X, y1, S * 0.05 * (0.7 + blink * 0.3), GLOW_RED, 0.25 + blink * 0.75);
    }
  }

  /** Two tilted rings of light orbiting the tower top: back halves, then (after the tower) front halves. */
  private drawHoloRings(art: Art, front: boolean) {
    const { ctx, sinP, cosP, cx, cy, S, time, motion, ringX, ringY, ringZ } = this;
    const theta = Math.atan2(this.sinT, this.cosT);
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < HOLO_RINGS.length; r += 1) {
      const ring = HOLO_RINGS[r]!;
      // The ring turns with the island and precesses on its own, so its tilt wobbles.
      const rho = theta + (motion ? ring.precess * time : 0);
      const cr = Math.cos(rho);
      const sr = Math.sin(rho);
      const ct = Math.cos(ring.tilt);
      const st = Math.sin(ring.tilt);
      for (let k = 0; k <= RING_POINTS; k += 1) {
        const psi = (k / RING_POINTS) * TAU;
        const lx = ring.r * Math.cos(psi);
        const ly = -ring.r * Math.sin(psi) * st;
        const lz = ring.r * Math.sin(psi) * ct;
        const x = lx * cr - lz * sr;
        const z = lx * sr + lz * cr;
        ringX[k] = cx + x * S;
        ringY[k] = cy + z * sinP * S - (ring.y + ly) * cosP * S;
        ringZ[k] = z;
      }

      // A wide faint glow, then a fine bright core.
      for (let layer = 0; layer < 2; layer += 1) {
        ctx.strokeStyle = layer === 0 ? ring.color : ring.core;
        ctx.lineWidth = layer === 0 ? S * 0.024 : Math.max(1.3, S * 0.0058);
        ctx.globalAlpha = layer === 0 ? 0.24 : 0.9;
        ctx.beginPath();
        let open = false;
        for (let k = 0; k < RING_POINTS; k += 1) {
          if (ringZ[k]! + ringZ[k + 1]! >= 0 !== front) {
            open = false;
            continue;
          }
          if (!open) ctx.moveTo(ringX[k]!, ringY[k]!);
          ctx.lineTo(ringX[k + 1]!, ringY[k + 1]!);
          open = true;
        }
        ctx.stroke();
      }

      // A bright comet running round the ring, its tail fading behind it.
      const turns = (motion ? ring.head * time : 1.2) / TAU;
      const head = Math.floor((turns - Math.floor(turns)) * RING_POINTS) % RING_POINTS;
      const dir = ring.head > 0 ? 1 : -1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, S * 0.0075);
      for (let m = 0; m < 6; m += 1) {
        ctx.globalAlpha = (1 - m / 6) * 0.9;
        ctx.beginPath();
        let drawn = false;
        for (let q = 0; q < 2; q += 1) {
          const k = (((head - dir * (m * 2 + q + 1)) % RING_POINTS) + RING_POINTS) % RING_POINTS;
          if (ringZ[k]! + ringZ[k + 1]! >= 0 !== front) continue;
          ctx.moveTo(ringX[k]!, ringY[k]!);
          ctx.lineTo(ringX[k + 1]!, ringY[k + 1]!);
          drawn = true;
        }
        if (drawn) ctx.stroke();
      }
      if (ringZ[head]! >= 0 === front) {
        const size = S * 0.07;
        ctx.globalAlpha = 0.9;
        this.blitGlow(art, GLOW_CYAN, ringX[head]! - size / 2, ringY[head]! - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ───────────────────────────── Sky life ───────────────────────────── */

  /** Small birds on slow loops round the island; behind it on the far side of the loop. */
  private drawBirds(front: boolean) {
    const { ctx, cx, S, sinP, cosP, time, motion } = this;
    const cy = this.baseCy;
    ctx.strokeStyle = '#4a3f86';
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = Math.max(1, S * 0.0048);
    ctx.beginPath();
    for (let i = 0; i < BIRDS.length; i += 1) {
      const bird = BIRDS[i]!;
      const radius = bird[0];
      const height = bird[1];
      const speed = bird[2];
      const phase = bird[3];
      const size = bird[4];
      const angle = phase + (motion ? speed * time : 0);
      const z = Math.sin(angle) * 0.62;
      if (z > 0 !== front) continue;
      const x = Math.cos(angle) * radius;
      const y = height + (motion ? Math.sin(time * 0.8 + phase * 3) * 0.025 : 0);
      const X = cx + x * S;
      const Y = cy + z * sinP * S - y * cosP * S;
      // Nearer birds look a touch larger; wings beat with a rest between strokes.
      const span = size * S * (1 + z * 0.25);
      const beat = motion ? Math.sin(time * 9 + phase * 5) : 0.4;
      const lift = span * (0.15 + 0.4 * beat);
      ctx.moveTo(X - span, Y - lift);
      ctx.quadraticCurveTo(X - span * 0.45, Y - lift * 0.2 - span * 0.2, X, Y);
      ctx.quadraticCurveTo(X + span * 0.45, Y - lift * 0.2 - span * 0.2, X + span, Y - lift);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ───────────────────────────── Sparkles ───────────────────────────── */

  private drawSparkles(art: Art) {
    const { ctx, cx, S, time, motion, sparkles } = this;
    const cy = this.baseCy;
    const n = sparkles.length / 5;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i += 1) {
      const phase = sparkles[i * 5 + 3]!;
      const twinkle = motion ? Math.max(0, Math.sin(time * sparkles[i * 5 + 4]! + phase)) : i % 3 === 0 ? 0.8 : 0;
      const a = twinkle * twinkle * twinkle;
      if (a < 0.02) continue;
      const size = sparkles[i * 5 + 2]! * S * (0.6 + 0.4 * a);
      ctx.globalAlpha = a * 0.9;
      this.blitGlow(art, GLOW_STAR, cx + sparkles[i * 5]! * S - size / 2, cy + sparkles[i * 5 + 1]! * S - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
