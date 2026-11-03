'use client';

import { useEffect, useRef } from 'react';
import { createRng } from '@/lib/rng';

/*
 * The landing page's ambient background: one fixed layer behind all content,
 * holding two canvases.
 *
 * - aurora: a few very soft lights drifting on Lissajous paths. It is nothing
 *   but blur, so it renders at a sixth of the viewport's size and the
 *   compositor scales it up for free. Scrolling slowly turns the paths.
 * - network: drifting points at several depths, joined by hairlines when they
 *   come close. Each depth scrolls at its own speed (parallax), wrapping top
 *   to bottom. A fine pointer joins in as a node that links to, lights up and
 *   gently pushes aside nearby points; a click on empty page sends a ripple
 *   through it. A few points twinkle up into a small turning sparkle.
 *
 * It is decoration, so it is tuned faint: the tinted lights never take
 * `lp-muted` text below 4.5:1, and a white light only ever adds contrast.
 * One effect owns a rAF loop (React never re-renders) that stops while the
 * tab is hidden. Being fixed to the viewport it is never scrolled offscreen,
 * so tab visibility is its only pause. Under reduced motion it paints one
 * still frame, again on resize, and never starts the loop.
 */

const TAU = Math.PI * 2;

/** Backing-store cap: past ~1.75 device px per CSS px hairlines look no finer but cost fill-rate. */
const DPR_CAP = 1.75;
/** The aurora is only blur, so it is drawn this much smaller and scaled up by the compositor. */
const AURORA_SCALE = 1 / 6;
/** Radians a light's path turns per pixel scrolled. */
const AURORA_STIR = 0.00016;
/** Share of the scroll distance the nearest points travel; the farthest move a quarter of that. */
const PARALLAX = 0.3;

const LINE_COLOR = 'rgb(109, 74, 255)';
/** Alpha of a link between two touching points at full depth. */
const LINK_ALPHA = 0.2;
/** Alpha of a link from the pointer to a point right beside it. */
const POINTER_LINK_ALPHA = 0.3;
/** Line alphas are quantised into buckets, so the whole mesh strokes in a dozen calls. */
const LINE_BUCKETS = 12;
const LINE_ALPHA_MAX = 0.32;

/** How far (px) the pointer pushes a point sitting right under it. */
const PUSH = 26;
const RIPPLE_LIFE = 1.3;
const RIPPLE_REACH = 210;
const GLOW_RADIUS = 160;

const DOT_COLORS = [
  'rgb(109, 74, 255)',
  'rgb(79, 70, 229)',
  'rgb(139, 92, 246)',
  'rgb(124, 77, 255)',
] as const;

/** Click targets that own their clicks: no ripple behind those. */
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [contenteditable="true"]';

interface AuroraLight {
  /** "r, g, b" */
  rgb: string;
  /** Opacity at the centre. */
  alpha: number;
  /** Resting centre, as a fraction of the viewport. */
  x: number;
  y: number;
  /** Path amplitude, as a fraction of the viewport. */
  ax: number;
  ay: number;
  /** Angular speed on each axis, rad/s: unequal, hence a Lissajous loop. */
  fx: number;
  fy: number;
  phase: number;
  /** Radius, as a fraction of the viewport's longer side. */
  r: number;
  /** Signed share of the scroll-driven turn. */
  stir: number;
}

/*
 * The colours are the luminance budget. Over #f7f6fc, `lp-muted` (#6f6b8a)
 * keeps 4.5:1 only while the background stays above ~0.885 relative
 * luminance, which a low-alpha wash of the saturated brand colours breaks
 * wherever two lights overlap. So each light is instead the most saturated
 * tint of its hue (violet #8b5cf6, periwinkle #93a5ff, pink #f5b5e8, sky
 * #9fd3ff) that still sits at ~0.905. Drawn at any opacity, over any other
 * light, nothing can get much darker than its darkest tint; read back from
 * the canvas across a full scroll of the page, dithering included, the
 * darkest spot still gives `lp-muted` 4.51:1. Darker tints would break that.
 */
const AURORA: readonly AuroraLight[] = [
  // Violet, top right: behind the hero's island.
  { rgb: '246, 243, 254', alpha: 1, x: 0.8, y: 0.16, ax: 0.12, ay: 0.1, fx: 0.071, fy: 0.053, phase: 0, r: 0.4, stir: 1 },
  // Periwinkle, left.
  { rgb: '241, 244, 255', alpha: 1, x: 0.12, y: 0.42, ax: 0.1, ay: 0.16, fx: 0.057, fy: 0.079, phase: 2.1, r: 0.44, stir: -0.8 },
  // Pink, lower middle: the sunset in the reference's clouds.
  { rgb: '253, 241, 251', alpha: 1, x: 0.62, y: 0.76, ax: 0.18, ay: 0.12, fx: 0.049, fy: 0.067, phase: 4.2, r: 0.42, stir: 0.7 },
  // Sky, bottom left.
  { rgb: '234, 246, 255', alpha: 1, x: 0.24, y: 0.98, ax: 0.14, ay: 0.08, fx: 0.083, fy: 0.061, phase: 1.1, r: 0.36, stir: -1.1 },
  // A white sheen wandering between them; brightening, so it only adds contrast.
  { rgb: '255, 255, 255', alpha: 0.85, x: 0.46, y: 0.32, ax: 0.22, ay: 0.18, fx: 0.043, fy: 0.059, phase: 3.3, r: 0.3, stir: 0.5 },
];

/** Gaussian-like falloff, [offset, share of the centre alpha]: the lights have no edge. */
const FALLOFF: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.2, 0.89],
  [0.4, 0.62],
  [0.6, 0.34],
  [0.8, 0.14],
  [1, 0],
];

interface Point {
  /** Home position in a field one link-length larger than the viewport on every side, 0..1. */
  u: number;
  v: number;
  /** Drift, px/s. */
  vx: number;
  vy: number;
  /** Depth, 0.25 (far) to 1 (near): size, opacity and parallax speed all follow it. */
  z: number;
  radius: number;
  alpha: number;
  fill: string;
  /** Twinkle depth (0..1), rate (rad/s) and phase. */
  twinkle: number;
  rate: number;
  phase: number;
  /** Twinkles up into a four-point sparkle at its peak. */
  star: boolean;
  /** Eased displacement from the pointer and ripples. */
  ox: number;
  oy: number;
  /** This frame: position, opacity, sparkle strength and closeness to the pointer (0..1). */
  x: number;
  y: number;
  a: number;
  glint: number;
  near: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
}

export function BackgroundCanvas() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const auroraRef = useRef<HTMLCanvasElement | null>(null);
  const networkRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const aurora = auroraRef.current;
    const network = networkRef.current;
    if (!root || !aurora || !network) return undefined;
    return runBackground(root, aurora, network);
  }, []);

  // `h-lvh` rather than `inset-0`: the layer keeps one height while a mobile
  // toolbar slides in and out, so the canvases are not reallocated mid-scroll.
  // Gone in forced-colours mode, where canvas pixels are not adjusted and the
  // pale lights would sit behind light system text; gone in print too.
  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh opacity-0 transition-opacity duration-[1600ms] ease-out [contain:strict] data-[ready]:opacity-100 print:hidden forced-colors:hidden"
    >
      <canvas ref={auroraRef} className="absolute inset-0 block size-full" />
      <canvas ref={networkRef} className="absolute inset-0 block size-full" />
    </div>
  );
}

function runBackground(
  root: HTMLDivElement,
  auroraCanvas: HTMLCanvasElement,
  networkCanvas: HTMLCanvasElement,
): (() => void) | undefined {
  const aurora = auroraCanvas.getContext('2d');
  const net = networkCanvas.getContext('2d');
  if (!aurora || !net) return undefined;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  // Seeded, so every visit (and every screenshot) starts from the same sky.
  const rng = createRng(0x2f6d4a);
  const lights = AURORA.map((light) => ({ ...light, fill: lightFill(aurora, light) }));
  // White, not violet: a spotlight that lightens whatever it passes over can
  // only raise the contrast of the text under the pointer.
  const glowFill = net.createRadialGradient(0, 0, 0, 0, 0, GLOW_RADIUS);
  for (const [offset, share] of FALLOFF) {
    glowFill.addColorStop(offset, `rgba(255, 255, 255, ${(0.6 * share).toFixed(3)})`);
  }

  let width = 0;
  let height = 0;
  let dpr = 1;
  /** Points closer than this (px) are linked; also the field's margin. */
  let link = 120;
  let points: Point[] = [];
  const ripples: Ripple[] = [];

  /** Seconds of animation; frozen while paused, so nothing jumps on resume. */
  let clock = 0;
  let scrollY = window.scrollY;
  /** Eased copy of scrollY that the field follows. */
  let scroll = scrollY;
  const pointer = { x: 0, y: 0, inside: false };
  const cursor = { x: 0, y: 0, presence: 0 };

  let frame = 0;
  let last = 0;
  let running = false;
  /** The layer has no box (forced colours, print): nothing to draw until it returns. */
  let collapsed = false;

  const resize = (cssWidth: number, cssHeight: number) => {
    width = Math.max(1, Math.round(cssWidth));
    height = Math.max(1, Math.round(cssHeight));
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    const backingWidth = Math.round(width * dpr);
    const backingHeight = Math.round(height * dpr);
    if (networkCanvas.width !== backingWidth || networkCanvas.height !== backingHeight) {
      networkCanvas.width = backingWidth;
      networkCanvas.height = backingHeight;
    }
    const auroraWidth = Math.max(2, Math.round(width * AURORA_SCALE));
    const auroraHeight = Math.max(2, Math.round(height * AURORA_SCALE));
    if (auroraCanvas.width !== auroraWidth || auroraCanvas.height !== auroraHeight) {
      auroraCanvas.width = auroraWidth;
      auroraCanvas.height = auroraHeight;
    }

    // Density follows the area; a phone gets fewer, shorter links than a desktop.
    const area = width * height;
    link = clamp(Math.sqrt(area) / 9.5, 88, 128);
    const count = clamp(Math.round(area / 15000), 30, 90);
    if (points.length === 0) {
      points = seedPoints(rng, count, (width + link * 2) / (height + link * 2));
    } else if (points.length > count) {
      points.length = count;
    } else {
      while (points.length < count) points.push(makePoint(rng, rng(), rng()));
    }
  };

  /** Advances the simulation by `dt` seconds; `step(0)` only re-derives this frame's positions. */
  const step = (dt: number) => {
    clock += dt;
    // A jump of a couple of screens is a teleport (restored scroll, an instant
    // jump), not motion: follow it at once rather than streaming past.
    if (Math.abs(scrollY - scroll) > height * 2) scroll = scrollY;
    else scroll += (scrollY - scroll) * ease(dt, 14);

    cursor.presence += ((pointer.inside ? 1 : 0) - cursor.presence) * ease(dt, pointer.inside ? 5 : 2.5);
    const follow = ease(dt, 18);
    cursor.x += (pointer.x - cursor.x) * follow;
    cursor.y += (pointer.y - cursor.y) * follow;

    for (const ripple of ripples) ripple.age += dt;
    while ((ripples[0]?.age ?? 0) > RIPPLE_LIFE) ripples.shift();

    const spanX = width + link * 2;
    const spanY = height + link * 2;
    const reach = link * 1.5;
    const pushRadius = link * 1.05;
    const settle = ease(dt, 6);
    const withCursor = cursor.presence > 0.003;

    for (const p of points) {
      p.u = wrap(p.u + (p.vx * dt) / spanX, 1);
      p.v = wrap(p.v + (p.vy * dt) / spanY, 1);
      const hx = p.u * spanX - link;
      const hy = wrap(p.v * spanY - scroll * PARALLAX * p.z, spanY) - link;

      let tx = 0;
      let ty = 0;
      let near = 0;
      if (withCursor) {
        const dx = hx - cursor.x;
        const dy = hy - cursor.y;
        const d = Math.hypot(dx, dy);
        if (d < reach && d > 0.5) {
          near = (1 - d / reach) * cursor.presence;
          if (d < pushRadius) {
            const force = (1 - d / pushRadius) ** 2 * PUSH * cursor.presence;
            tx += (dx / d) * force;
            ty += (dy / d) * force;
          }
        }
      }
      for (const ripple of ripples) {
        const t = ripple.age / RIPPLE_LIFE;
        const dx = hx - ripple.x;
        const dy = hy - ripple.y;
        const d = Math.hypot(dx, dy);
        const band = 1 - Math.abs(d - RIPPLE_REACH * easeOutCubic(t)) / 50;
        if (band > 0 && d > 0.5) {
          const force = band * 24 * (1 - t);
          tx += (dx / d) * force;
          ty += (dy / d) * force;
        }
      }

      p.ox += (tx - p.ox) * settle;
      p.oy += (ty - p.oy) * settle;
      p.x = hx + p.ox;
      p.y = hy + p.oy;
      p.near = near;

      const shine = 0.5 + 0.5 * Math.sin(clock * p.rate + p.phase);
      p.a = Math.min(0.85, p.alpha * (1 - p.twinkle * (1 - shine)) + near * 0.4);
      p.glint = p.star ? Math.max(0, (shine - 0.68) / 0.32) : 0;
    }
  };

  const paintAurora = () => {
    const w = auroraCanvas.width;
    const h = auroraCanvas.height;
    const size = Math.max(w, h);
    const turn = scroll * AURORA_STIR;
    aurora.setTransform(1, 0, 0, 1, 0, 0);
    aurora.clearRect(0, 0, w, h);
    for (const light of lights) {
      const x = (light.x + light.ax * Math.sin(clock * light.fx + light.phase + turn * light.stir)) * w;
      const y = (light.y + light.ay * Math.cos(clock * light.fy + light.phase * 1.7 + turn * light.stir)) * h;
      const r = light.r * size * (1 + 0.06 * Math.sin(clock * 0.11 + light.phase));
      // The fill is a unit gradient at the origin; the transform places and sizes it.
      aurora.setTransform(r, 0, 0, r, x, y);
      aurora.fillStyle = light.fill;
      aurora.fillRect(-1, -1, 2, 2);
    }
    aurora.setTransform(1, 0, 0, 1, 0, 0);
  };

  const paintNetwork = () => {
    net.setTransform(dpr, 0, 0, dpr, 0, 0);
    net.clearRect(0, 0, width, height);

    if (cursor.presence > 0.01) {
      net.globalAlpha = cursor.presence;
      net.fillStyle = glowFill;
      net.setTransform(dpr, 0, 0, dpr, cursor.x * dpr, cursor.y * dpr);
      net.fillRect(-GLOW_RADIUS, -GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
      net.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    net.strokeStyle = LINE_COLOR;
    for (const ripple of ripples) {
      const t = ripple.age / RIPPLE_LIFE;
      net.globalAlpha = 0.24 * (1 - t) ** 2;
      net.lineWidth = 1.25;
      net.beginPath();
      net.arc(ripple.x, ripple.y, RIPPLE_REACH * easeOutCubic(t), 0, TAU);
      net.stroke();
    }

    const paths = Array.from({ length: LINE_BUCKETS }, () => new Path2D());
    const reach2 = link * link;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      if (!a) continue;
      for (let j = i + 1; j < points.length; j += 1) {
        const b = points[j];
        if (!b) continue;
        const dx = a.x - b.x;
        if (dx > link || dx < -link) continue;
        const dy = a.y - b.y;
        if (dy > link || dy < -link) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach2) continue;
        // A gentle falloff: a steeper one leaves only touching pairs visible
        // and the mesh reads as scattered dots.
        const f = (1 - Math.sqrt(d2) / link) ** 1.25;
        const alpha = f * LINK_ALPHA * (0.45 + 0.55 * Math.min(a.z, b.z)) * (1 + (a.near + b.near) * 1.2);
        addLine(paths, alpha, a.x, a.y, b.x, b.y);
      }
    }
    if (cursor.presence > 0.01) {
      for (const p of points) {
        if (p.near > 0) addLine(paths, p.near ** 1.4 * POINTER_LINK_ALPHA, cursor.x, cursor.y, p.x, p.y);
      }
    }
    net.lineWidth = 0.85;
    paths.forEach((path, bucket) => {
      net.globalAlpha = ((bucket + 0.5) / LINE_BUCKETS) * LINE_ALPHA_MAX;
      net.stroke(path);
    });

    for (const fill of DOT_COLORS) {
      net.fillStyle = fill;
      for (const p of points) {
        if (p.fill !== fill) continue;
        if (p.x < -10 || p.y < -10 || p.x > width + 10 || p.y > height + 10) continue;
        net.globalAlpha = p.a;
        net.beginPath();
        net.arc(p.x, p.y, p.radius, 0, TAU);
        net.fill();
        if (p.glint > 0) {
          net.globalAlpha = p.a * p.glint;
          sparkle(net, p.x, p.y, p.radius + 1.5 + 5 * p.glint, clock * 0.5 + p.phase);
          net.fill();
        }
      }
    }
    net.globalAlpha = 1;
  };

  const paint = () => {
    paintAurora();
    paintNetwork();
  };

  const still = () => {
    step(0);
    paint();
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    paint();
  };

  const start = () => {
    if (running || collapsed || reduced.matches || document.hidden) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const onScroll = () => {
    scrollY = window.scrollY;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!running || event.pointerType === 'touch' || !fine.matches) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!pointer.inside) {
      pointer.inside = true;
      // Arriving from outside: start at the pointer rather than sweeping in from the last spot.
      if (cursor.presence < 0.05) {
        cursor.x = pointer.x;
        cursor.y = pointer.y;
      }
    }
  };

  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) pointer.inside = false;
  };

  const onBlur = () => {
    pointer.inside = false;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!running || event.button !== 0 || event.pointerType === 'touch' || !fine.matches) return;
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
    ripples.push({ x: event.clientX, y: event.clientY, age: 0 });
    if (ripples.length > 4) ripples.shift();
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const onMotionPreference = () => {
    if (reduced.matches) {
      stop();
      pointer.inside = false;
      cursor.presence = 0;
      ripples.length = 0;
      if (!collapsed) still();
    } else {
      start();
    }
  };

  // Moving to a screen with another pixel ratio changes no CSS size, so the
  // ResizeObserver stays quiet; a resolution query catches it instead.
  let dprQuery: MediaQueryList | null = null;
  const onPixelRatio = () => {
    watchPixelRatio();
    if (collapsed) return;
    resize(width, height);
    still();
  };
  const watchPixelRatio = () => {
    dprQuery?.removeEventListener('change', onPixelRatio);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onPixelRatio);
  };

  const observer = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (!box) return;
    collapsed = box.width < 1 || box.height < 1;
    if (collapsed) {
      stop();
      return;
    }
    if (Math.round(box.width) !== width || Math.round(box.height) !== height) {
      // Runs after layout, before paint: redraw now, or the cleared canvas flashes for a frame.
      resize(box.width, box.height);
      still();
    }
    start();
  });

  const rect = root.getBoundingClientRect();
  collapsed = rect.width < 1 || rect.height < 1;
  if (!collapsed) {
    resize(rect.width, rect.height);
    still();
  }
  root.dataset.ready = '';

  observer.observe(root);
  watchPixelRatio();
  reduced.addEventListener('change', onMotionPreference);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerout', onPointerOut, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('blur', onBlur);
  start();

  return () => {
    stop();
    observer.disconnect();
    dprQuery?.removeEventListener('change', onPixelRatio);
    reduced.removeEventListener('change', onMotionPreference);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerout', onPointerOut);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('blur', onBlur);
  };
}

function lightFill(ctx: CanvasRenderingContext2D, light: AuroraLight): CanvasGradient {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, share] of FALLOFF) {
    gradient.addColorStop(offset, `rgba(${light.rgb}, ${(light.alpha * share).toFixed(4)})`);
  }
  return gradient;
}

/** A jittered grid with its cells in random order: the first frame is evenly spread, not clumped. */
function seedPoints(rng: () => number, count: number, aspect: number): Point[] {
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return Array.from({ length: cols * rows }, (_, cell) => ({ cell, key: rng() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map(({ cell }) =>
      makePoint(rng, ((cell % cols) + rng()) / cols, (Math.floor(cell / cols) + rng()) / rows),
    );
}

function makePoint(rng: () => number, u: number, v: number): Point {
  // Skewed toward the back: most points are small and faint, a few sit close.
  const z = 0.25 + 0.75 * rng() ** 1.5;
  const heading = rng() * TAU;
  const speed = 2.5 + rng() * 7 * (0.5 + z);
  const star = rng() < 0.14;
  return {
    u,
    v,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    z,
    radius: 0.6 + z * 1.55,
    alpha: 0.3 + z * 0.2,
    fill: DOT_COLORS[Math.floor(rng() * DOT_COLORS.length)] ?? DOT_COLORS[0],
    twinkle: star ? 0.85 : 0.15 + rng() * 0.3,
    rate: 0.5 + rng() * 1.4,
    phase: rng() * TAU,
    star,
    ox: 0,
    oy: 0,
    x: 0,
    y: 0,
    a: 0,
    glint: 0,
    near: 0,
  };
}

function addLine(paths: Path2D[], alpha: number, x1: number, y1: number, x2: number, y2: number) {
  if (alpha < 0.008) return;
  const bucket = Math.min(LINE_BUCKETS - 1, Math.floor((alpha / LINE_ALPHA_MAX) * LINE_BUCKETS));
  const path = paths[bucket];
  if (!path) return;
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
}

/** Four concave arms around (x, y): the page's "spark" glyph, turned by `angle`. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number) {
  const waist = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  for (let arm = 1; arm <= 4; arm += 1) {
    const tip = angle + (arm * TAU) / 4;
    const between = tip - TAU / 8;
    ctx.quadraticCurveTo(
      x + Math.cos(between) * waist,
      y + Math.sin(between) * waist,
      x + Math.cos(tip) * size,
      y + Math.sin(tip) * size,
    );
  }
  ctx.closePath();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Positive modulo, so wrapped coordinates stay in [0, span). */
function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

/** Frame-rate-independent smoothing factor for a rate in 1/s. */
function ease(dt: number, rate: number) {
  return 1 - Math.exp(-dt * rate);
}

function easeOutCubic(t: number) {
  return 1 - (1 - Math.min(1, t)) ** 3;
}
