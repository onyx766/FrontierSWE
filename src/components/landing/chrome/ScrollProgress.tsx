'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import styles from './ScrollProgress.module.css';

/**
 * Reading progress: a violet hairline across the very top of the viewport,
 * above the sticky nav. Where the browser has scroll-driven animations the
 * bar is pure CSS on the compositor and this effect does nothing; elsewhere
 * one rAF-throttled scroll listener writes `--progress` for the same
 * transforms. Decorative (aria-hidden): the scrollbar already says this.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar || CSS.supports('animation-timeline', 'scroll()')) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.setProperty('--progress', progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Content that grows below the fold changes the ratio without a scroll event.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden', styles.bar)}
    >
      <span className={styles.fill} />
      <span className={styles.head} />
    </div>
  );
}
