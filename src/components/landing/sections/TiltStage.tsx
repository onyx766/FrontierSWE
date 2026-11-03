'use client';

import { useEffect, useRef, type ReactNode } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';
const FINE = '(hover: hover) and (pointer: fine)';

/**
 * Wraps a project visual. While a fine pointer moves over it, it writes
 * --tilt-x/--tilt-y (degrees) and --mx/--my (percent) on itself, which the
 * 3D stage and browser frames lean toward. Off screen or in a hidden tab it
 * sets [data-offscreen], which pauses the visual's animations.
 *
 * Everything is a custom property or attribute set in a rAF: moving the mouse
 * never re-renders React.
 */
export function TiltStage({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  /** Degrees the visual turns at the stage's edges. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const fine = window.matchMedia(FINE);
    const reduced = window.matchMedia(REDUCED);
    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.min(1, Math.max(0, (px - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (py - rect.top) / rect.height));
      stage.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      stage.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (reduced.matches) return;
      stage.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
      stage.style.setProperty('--tilt-x', `${(-(y - 0.5) * 2 * max * 0.6).toFixed(2)}deg`);
      stage.setAttribute('data-tilting', '');
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType === 'touch') return;
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      stage.removeAttribute('data-tilting');
      stage.style.setProperty('--tilt-x', '0deg');
      stage.style.setProperty('--tilt-y', '0deg');
    };

    let visible = true;
    const sync = () => {
      if (visible && !document.hidden) stage.removeAttribute('data-offscreen');
      else stage.setAttribute('data-offscreen', '');
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            visible = entry.isIntersecting;
            sync();
          });
    observer?.observe(stage);
    document.addEventListener('visibilitychange', sync);

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, [max]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
