'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True while (or, with `once`, after) the element intersects the viewport.
 * Starts false on the server and the first client render, so it is
 * hydration-safe; without IntersectionObserver it reports true.
 */
export function useInView<T extends Element>({
  once = false,
  rootMargin = '0px',
  threshold = 0,
}: { once?: boolean; rootMargin?: string; threshold?: number } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && once) {
          setInView(true);
          observer.disconnect();
          return;
        }
        setInView(visible);
      },
      { rootMargin, threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, inView };
}

/**
 * Runs `callback(time, delta)` every animation frame while `active`, pausing
 * when the tab is hidden. `delta` is in seconds, clamped so a long pause
 * never produces a jump.
 */
export function useAnimationFrame(callback: (time: number, delta: number) => void, active: boolean) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let running = !document.hidden;

    const loop = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      saved.current(now / 1000, delta);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    if (running) raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
}
