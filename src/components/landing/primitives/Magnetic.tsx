'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pulls its child a little toward the cursor while hovered, then springs back.
 * Fine pointers only, and never under reduced motion. Writes a transform
 * directly in a rAF, so React never re-renders on pointer movement.
 */
export function Magnetic({
  children,
  strength = 0.25,
  className,
}: {
  children: ReactNode;
  /** Fraction of the cursor's offset from centre that the element follows. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches) return;
      const rect = element.getBoundingClientRect();
      x = (event.clientX - (rect.left + rect.width / 2)) * strength;
      y = (event.clientY - (rect.top + rect.height / 2)) * strength;
      element.style.transition = 'transform 120ms linear';
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.style.transition = 'transform 650ms cubic-bezier(0.16, 1, 0.3, 1)';
      element.style.transform = 'translate3d(0, 0, 0)';
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);

  return (
    <span ref={ref} className={cn('inline-flex will-change-transform', className)}>
      {children}
    </span>
  );
}
