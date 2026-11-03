'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface FinalCtaStageProps {
  id: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

const clamp = (value: number) => Math.min(1, Math.max(-1, value));

/**
 * The final call-to-action's <section>, plus the parallax driver for its
 * panorama. It writes three CSS variables that the layers read:
 *   --fc-scroll  -1 entering from below, 0 centred, 1 leaving at the top
 *   --fc-px/py   the pointer's offset from the band's centre, -1…1, eased
 * A frame is requested only when something changed (a scroll, a pointer move,
 * the easing still settling), never while the band is offscreen or the tab is
 * hidden, and not at all under reduced motion: the variables then stay at 0,
 * which is the composed still frame. It also marks the band `data-idle` while
 * it is offscreen so the CSS loops inside it pause.
 */
export function FinalCtaStage({ id, labelledBy, className, children }: FinalCtaStageProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

    let frame = 0;
    let last = 0;
    let visible = typeof IntersectionObserver === 'undefined';
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || reduced.matches) {
        last = 0;
        return;
      }
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = (viewport / 2 - (rect.top + rect.height / 2)) / ((viewport + rect.height) / 2);
      element.style.setProperty('--fc-scroll', clamp(progress).toFixed(4));
      // Ease toward the pointer so the scene glides instead of jittering: 8% of
      // the remaining distance per 60 Hz frame, scaled so slow devices match.
      const seconds = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      const ease = 1 - 0.92 ** (seconds * 60);
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      if (Math.abs(targetX - x) < 0.001) x = targetX;
      if (Math.abs(targetY - y) < 0.001) y = targetY;
      element.style.setProperty('--fc-px', x.toFixed(4));
      element.style.setProperty('--fc-py', y.toFixed(4));
      if (x !== targetX || y !== targetY) {
        last = now;
        frame = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };

    // Page-wide scroll events land here too: offscreen they cost nothing.
    const schedule = () => {
      if (frame || !visible || document.hidden || reduced.matches) return;
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1);
      targetY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1);
      schedule();
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      schedule();
    };

    const onMotionPreference = () => {
      if (!reduced.matches) {
        schedule();
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      x = y = targetX = targetY = 0;
      element.style.removeProperty('--fc-scroll');
      element.style.removeProperty('--fc-px');
      element.style.removeProperty('--fc-py');
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
              element.toggleAttribute('data-idle', !visible);
              if (visible) schedule();
            },
            { rootMargin: '80px 0px' },
          );
    observer?.observe(element);
    if (visible) schedule();

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerleave', onPointerLeave);
    reduced.addEventListener('change', onMotionPreference);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', onPointerLeave);
      reduced.removeEventListener('change', onMotionPreference);
    };
  }, []);

  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} className={className}>
      {children}
    </section>
  );
}
