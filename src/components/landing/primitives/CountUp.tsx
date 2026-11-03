'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up from zero the first time it scrolls into view.
 *
 * The server renders the final value, so without JavaScript, under reduced
 * motion, or before hydration the true number is what's in the document.
 * Place it inside a <Reveal>: the reveal keeps it invisible until it enters
 * the viewport, so the reset to zero on mount is never seen.
 */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  duration = 1600,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  /** Milliseconds. */
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let raf = 0;
    setDisplay(0);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // easeOutQuart: fast at first, settling onto the final value.
          setDisplay(Math.round((1 - (1 - progress) ** 4) * value));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>
        {prefix}
        {display}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {value}
        {suffix}
      </span>
    </span>
  );
}
