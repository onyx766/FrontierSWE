'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Writes the pointer position over the hero as --px/--py (-1…1, eased) on its
 * own element; layers inside read them through the CSS `translate` property
 * at different depths. One rAF chain that stops once settled, fine pointers
 * only, nothing under reduced motion, and React never re-renders.
 */
export function HeroParallax({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      element.style.setProperty('--px', x.toFixed(4));
      element.style.setProperty('--py', y.toFixed(4));
      const settled = Math.abs(targetX - x) < 0.001 && Math.abs(targetY - y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches) return;
      const rect = element.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      start();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
