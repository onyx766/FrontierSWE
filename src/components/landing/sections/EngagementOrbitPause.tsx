'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Sets `data-paused` while the element is offscreen, so CSS can pause the
 * animations inside it. Worth it for the orbit: its dash flow and motion
 * paths run on the main thread, unlike transform-only animations. Without
 * JavaScript the attribute is never set and nothing changes.
 */
export function EngagementOrbitPause({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => element.toggleAttribute('data-paused', !entry?.isIntersecting),
      { rootMargin: '200px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
