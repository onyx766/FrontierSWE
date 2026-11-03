'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { onArtLost } from './art';
import { getIslandModel } from './model';
import { IslandRenderer, type IslandVariant, type IslandView } from './renderer';

export interface IslandCanvasProps {
  className?: string;
  /** 'hero': large, ~30° above. 'panorama': lower, cloudier and slower, for the final CTA band. */
  variant?: IslandVariant;
  /** Drag to spin it (with a fling) and hover to tilt it toward the pointer. */
  interactive?: boolean;
}

const DPR_CAP = 2;
/** Radians of turn for a drag across the full width of the box. */
const DRAG_TURN = Math.PI * 1.15;
/** Fastest fling, radians per second. */
const MAX_FLING = 5;

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}

/**
 * The floating island city, drawn on a 2D canvas (no WebGL) and turning
 * slowly. It fills its parent box, which the caller positions.
 *
 * Decorative: hidden from assistive tech and never focusable; the link to the
 * 3D world beside it is the accessible path. The loop pauses offscreen and in
 * hidden tabs; with reduced motion it draws one still frame (and redraws only
 * while being dragged).
 */
export function IslandCanvas({ className, variant = 'hero', interactive = false }: IslandCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new IslandRenderer(ctx, getIslandModel(), variant);
    const config = renderer.config;
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    let reduced = reducedQuery.matches;

    const view: IslandView = { theta: config.theta0, phi: config.phi, time: 0, motion: !reduced };
    let omega = reduced ? 0 : config.spin;
    // The idle spin follows the last fling, so a push never springs back the other way.
    let spinDir = 1;
    let phiNudge = 0;
    let phiTarget = 0;
    let hovering = false;
    let dragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastMoveAt = 0;
    let dragVelocity = 0;

    let inView = typeof IntersectionObserver === 'undefined';
    let pageVisible = !document.hidden;
    let raf = 0;
    let last = 0;
    let ready = false;

    // Development-only frame timing, read by the screenshot scripts.
    let statFrames = 0;
    let statTotal = 0;
    let statWorst = 0;

    const animating = () => !reduced && inView && pageVisible;

    const step = (dt: number) => {
      const target = spinDir * config.spin * (hovering ? 1.8 : 1);
      if (!dragging) {
        // A fling eases back into the idle spin.
        omega += (target - omega) * (1 - Math.exp(-dt * 1.3));
        view.theta += omega * dt;
      }
      phiNudge += (phiTarget - phiNudge) * (1 - Math.exp(-dt * 4));
      view.phi = config.phi + phiNudge;
      view.time += dt;
    };

    const draw = () => {
      if (process.env.NODE_ENV === 'development') {
        // Painting the art happens inside prepare(); time it apart from the frame.
        const p0 = performance.now();
        renderer.prepare();
        const p1 = performance.now();
        if (p1 - p0 > 1) wrap.dataset.artMs = (p1 - p0).toFixed(1);
        renderer.render(view);
        const ms = performance.now() - p1;
        statTotal += ms;
        statWorst = Math.max(statWorst, ms);
        statFrames += 1;
        if (statFrames === 90) {
          wrap.dataset.frameMs = (statTotal / statFrames).toFixed(2);
          wrap.dataset.frameMaxMs = statWorst.toFixed(2);
          statFrames = 0;
          statTotal = 0;
          statWorst = 0;
        }
      } else {
        renderer.render(view);
      }
      if (!ready) {
        ready = true;
        canvas.dataset.ready = '';
      }
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduced) step(dt);
      draw();
      if (animating()) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const sync = () => {
      if (animating()) {
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    };

    /** One frame on demand, for when the loop is not running. */
    const requestDraw = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      renderer.resize(width, height, Math.min(DPR_CAP, window.devicePixelRatio || 1));
      // Resizing a canvas clears it; draw now, before the browser paints the blank.
      draw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);

    // Moving to a screen with another pixel density (or zooming) changes no box size.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    };
    function onDprChange() {
      resize();
      watchDpr();
    }
    watchDpr();

    let intersection: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersection = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          sync();
        },
        { rootMargin: '120px' },
      );
      intersection.observe(wrap);
    }

    const onVisibility = () => {
      pageVisible = !document.hidden;
      sync();
    };
    const onReducedChange = () => {
      reduced = reducedQuery.matches;
      view.motion = !reduced;
      omega = reduced ? 0 : spinDir * config.spin;
      phiTarget = 0;
      if (reduced) requestDraw();
      sync();
    };
    // A GPU reset clears the canvas and the painted art; the loop repaints, but a
    // still frame has to be asked for.
    const onRestored = () => requestDraw();
    const offArtLost = onArtLost(requestDraw);
    document.addEventListener('visibilitychange', onVisibility);
    reducedQuery.addEventListener('change', onReducedChange);
    canvas.addEventListener('contextrestored', onRestored);

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastMoveAt = event.timeStamp;
      dragVelocity = 0;
      wrap.setPointerCapture(event.pointerId);
      wrap.dataset.dragging = '';
    };

    const onPointerMove = (event: PointerEvent) => {
      // Also covers a pointer that was already over the island when it mounted.
      if (event.pointerType === 'mouse') hovering = true;
      if (event.pointerType === 'mouse' && fineQuery.matches && !reduced) {
        const rect = wrap.getBoundingClientRect();
        const y = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
        // Pointer above the middle tips the top toward the viewer; below, the underside.
        phiTarget = clamp((0.5 - y) * 2, -1, 1) * config.nudge;
      }
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      // Dragging right carries the near side of the island to the right.
      const turn = -(dx / Math.max(1, wrap.clientWidth)) * DRAG_TURN;
      view.theta += turn;
      const dt = Math.max(8, event.timeStamp - lastMoveAt) / 1000;
      lastMoveAt = event.timeStamp;
      dragVelocity = dragVelocity * 0.55 + (turn / dt) * 0.45;
      if (!animating()) requestDraw();
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      delete wrap.dataset.dragging;
      if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
      // A pause before letting go means no fling.
      const held = event.timeStamp - lastMoveAt > 90;
      if (reduced) return;
      omega = held ? 0 : clamp(dragVelocity, -MAX_FLING, MAX_FLING);
      if (Math.abs(omega) > config.spin * 0.5) spinDir = Math.sign(omega);
    };

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') hovering = true;
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      hovering = false;
      phiTarget = 0;
    };

    if (interactive) {
      wrap.addEventListener('pointerdown', onPointerDown);
      wrap.addEventListener('pointermove', onPointerMove);
      wrap.addEventListener('pointerup', endDrag);
      wrap.addEventListener('pointercancel', endDrag);
      wrap.addEventListener('lostpointercapture', endDrag);
      wrap.addEventListener('pointerenter', onPointerEnter);
      wrap.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      dprQuery?.removeEventListener('change', onDprChange);
      intersection?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedQuery.removeEventListener('change', onReducedChange);
      canvas.removeEventListener('contextrestored', onRestored);
      offArtLost();
      wrap.removeEventListener('pointerdown', onPointerDown);
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerup', endDrag);
      wrap.removeEventListener('pointercancel', endDrag);
      wrap.removeEventListener('lostpointercapture', endDrag);
      wrap.removeEventListener('pointerenter', onPointerEnter);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      delete wrap.dataset.dragging;
    };
  }, [variant, interactive]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      data-island-variant={variant}
      className={cn(
        'relative h-full w-full select-none',
        // Vertical swipes still scroll the page; horizontal drags spin the island.
        interactive && 'cursor-grab touch-pan-y data-[dragging]:cursor-grabbing',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full opacity-0 transition-opacity duration-700 data-[ready]:opacity-100"
      />
    </div>
  );
}
