'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ExperienceSectionProps {
  id: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * The experience section's element, plus the only script it needs. Writes
 * state as data attributes and lets CSS do all the drawing:
 *
 * - `data-inview` on the section while it is near the viewport, so the
 *   illustration's loops pause when nobody can see them;
 * - `data-lit` on each timeline entry (`[data-entry]`) once it crosses the
 *   reading line, 60% down the viewport. Lighting one lights every entry
 *   above it, and a lit entry stays lit;
 * - `data-drawn` on the illustration (`[data-summit]`) once its scene is on
 *   screen, which draws the trail in.
 *
 * With reduced motion, or without IntersectionObserver, everything is set at
 * once: the finished still frame.
 */
export function ExperienceSection({ id, labelledBy, className, children }: ExperienceSectionProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const entries = Array.from(section.querySelectorAll<HTMLElement>('[data-entry]'));
    const art = section.querySelector<HTMLElement>('[data-summit]');

    const settle = () => {
      section.setAttribute('data-inview', '');
      art?.setAttribute('data-drawn', '');
      for (const entry of entries) entry.setAttribute('data-lit', '');
    };

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      settle();
      return;
    }

    const near = new IntersectionObserver(
      ([record]) => {
        if (record?.isIntersecting) section.setAttribute('data-inview', '');
        else section.removeAttribute('data-inview');
      },
      { rootMargin: '160px 0px' },
    );
    near.observe(section);

    // Draw once nearly all of the scene that can fit on screen is on screen, so
    // the climb starts where the reader can see it, on any viewport height.
    const scene = art?.querySelector<HTMLElement>('[data-summit-scene]') ?? art;
    const draw = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          const viewport = record.rootBounds?.height ?? window.innerHeight;
          const fits = Math.min(record.boundingClientRect.height, viewport);
          if (record.intersectionRect.height < fits * 0.9) continue;
          art?.setAttribute('data-drawn', '');
          draw.disconnect();
          return;
        }
      },
      { threshold: Array.from({ length: 21 }, (_, step) => step / 20) },
    );
    if (scene) draw.observe(scene);

    const light = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          // Below the reading line and not yet scrolled past: leave it dim.
          if (!record.isIntersecting && record.boundingClientRect.top > 0) continue;
          const index = entries.indexOf(record.target as HTMLElement);
          for (let i = 0; i <= index; i += 1) {
            const entry = entries[i];
            if (!entry || entry.hasAttribute('data-lit')) continue;
            entry.setAttribute('data-lit', '');
            light.unobserve(entry);
          }
        }
      },
      { rootMargin: '0px 0px -40% 0px' },
    );
    for (const entry of entries) light.observe(entry);

    return () => {
      near.disconnect();
      draw.disconnect();
      light.disconnect();
    };
  }, []);

  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} className={className}>
      {children}
    </section>
  );
}
