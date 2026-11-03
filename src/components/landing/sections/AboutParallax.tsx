'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Pointer parallax for the About portrait. Writes `--px` / `--py` (−1…1, the
 * pointer's offset from the centre) on its element, once per animation frame
 * at most; the layers inside turn them into small translations, each with its
 * own depth, in CSS — React never re-renders. Fine pointers only and never
 * under reduced motion: elsewhere the variables stay at 0 and the portrait is
 * a still composition.
 *
 * It also marks the element `data-offscreen` while it is out of view, which
 * pauses every animation inside at once (so the orbit rings and their
 * counter-spins stay in step). The portrait is decorative, so the wrapper is
 * hidden from assistive technology.
 */
export function AboutParallax({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let x = 0;
    let y = 0;

    const write = () => {
      frame = 0;
      element.style.setProperty('--px', x.toFixed(3));
      element.style.setProperty('--py', y.toFixed(3));
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      if (!frame) frame = requestAnimationFrame(write);
    };

    // Ease home rather than snap: the layers' CSS transition does the easing.
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(write);
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              const visible = entries.some((entry) => entry.isIntersecting);
              element.toggleAttribute('data-offscreen', !visible);
            },
            { rootMargin: '120px 0px' },
          );
    observer?.observe(element);

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
