'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseStageResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  /** Rendered width / viewBox width. 0 until measured, so packets wait. */
  scale: number;
  onPointerMove: (event: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
}

/**
 * Stage measurement plus pointer parallax.
 *
 * Two deliberate performance choices:
 *
 *   1. Size is read with a ResizeObserver, not on every frame, and only feeds
 *      one number (`scale`) used by the packet overlay transform.
 *   2. Pointer movement never causes a React re-render. It writes two CSS
 *      custom properties (`--px`, `--py`) directly to the stage element inside
 *      a single requestAnimationFrame, and the nodes read those in `calc()`.
 *      So parallax costs one style write per frame at most, regardless of how
 *      many nodes are on screen.
 */
export function useStage<T extends HTMLElement>(viewBoxWidth: number): UseStageResult<T> {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = (width: number) => {
      if (width > 0) setScale(width / viewBoxWidth);
    };

    measure(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewBoxWidth]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const flush = useCallback(() => {
    frameRef.current = null;
    const element = ref.current;
    const next = pendingRef.current;
    if (!element || !next) return;
    element.style.setProperty('--px', next.x.toFixed(3));
    element.style.setProperty('--py', next.y.toFixed(3));
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      // Ignore touch: parallax on a touch device just fights the scroll.
      if (event.pointerType !== 'mouse') return;
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      pendingRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };

      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const onPointerLeave = useCallback(() => {
    pendingRef.current = { x: 0, y: 0 };
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  return { ref, scale, onPointerMove, onPointerLeave };
}
