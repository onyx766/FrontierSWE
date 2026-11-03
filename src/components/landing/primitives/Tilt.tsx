'use client';

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

interface TiltProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees at the element's edges. */
  max?: number;
  /** Pixels the element rises while hovered. */
  lift?: number;
  as?: ElementType;
  style?: CSSProperties;
}

/**
 * 3D pointer tilt plus the cursor position for `.lp-spotlight`.
 *
 * Writes `--rx`/`--ry` (rotation) and `--mx`/`--my` (cursor, as percentages)
 * on the element inside one rAF per pointer move — React never re-renders.
 * Rotation only happens for fine pointers without reduced motion; the
 * spotlight position is written regardless, since it is only a highlight.
 * The transform itself is the `.lp-tilt` class in globals.css, so don't also
 * put a hover `transform` utility on the same element.
 */
export function Tilt({ children, className, max = 7, lift = 4, as: Tag = 'div', style }: TiltProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = Math.min(1, Math.max(0, (px - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (py - rect.top) / rect.height));
      element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (fine.matches && !reduced.matches) {
        element.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
        element.style.setProperty('--rx', `${(-(y - 0.5) * 2 * max).toFixed(2)}deg`);
        element.setAttribute('data-tilting', '');
      }
    };

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.removeAttribute('data-tilting');
      element.style.setProperty('--rx', '0deg');
      element.style.setProperty('--ry', '0deg');
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, [max]);

  return (
    <Tag
      ref={ref}
      className={cn('lp-tilt', className)}
      style={{ '--tilt-lift': `${lift}px`, ...style } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
