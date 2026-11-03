'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import styles from './BackToTop.module.css';

/** Scroll depth (px) past which the button appears. */
const SHOW_AFTER = 600;
/** Progress ring radius in the 64-unit viewBox; the button's own edge sits at 24. */
const RING_RADIUS = 20.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Floating "back to top" control with a ring that fills as the page is read.
 *
 * It appears after the first screenful and stays while it holds focus, so
 * scrolling never pulls a focused control out from under the keyboard. While
 * hidden it is inert: out of the tab order and the accessibility tree. The
 * click scrolls home (instantly under reduced motion) and moves focus to the
 * start of `<main>`, so the next Tab continues from the top of the page
 * rather than from the footer. The ring is written straight to the DOM in a
 * rAF; React only re-renders when the button shows or hides.
 */
export function BackToTop() {
  const [past, setPast] = useState(false);
  const [focused, setFocused] = useState(false);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const shown = past || focused;

  useEffect(() => {
    let frame = 0;
    let wasPast = false;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      arcRef.current?.style.setProperty('stroke-dashoffset', (RING_LENGTH * (1 - progress)).toFixed(2));
      const isPast = y > SHOW_AFTER;
      if (isPast !== wasPast) {
        wasPast = isPast;
        setPast(isPast);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, []);

  const backToTop = () => {
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
    focusMain();
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={backToTop}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      inert={!shown}
      tabIndex={shown ? undefined : -1}
      data-shown={shown ? '' : undefined}
      className={styles.button}
    >
      <span aria-hidden className={styles.orbit} />
      <svg aria-hidden viewBox="0 0 64 64" focusable="false" className={styles.ring}>
        <defs>
          <linearGradient id="lp-back-to-top-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f2ee8" />
            <stop offset="0.55" stopColor="#6d4aff" />
            <stop offset="1" stopColor="#b47cff" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={RING_RADIUS} className={styles.track} />
        {/* A gap one unit longer than the ring, so an empty arc draws no round-cap dot. */}
        <circle
          ref={arcRef}
          cx="32"
          cy="32"
          r={RING_RADIUS}
          transform="rotate(-90 32 32)"
          stroke="url(#lp-back-to-top-arc)"
          strokeDasharray={`${RING_LENGTH.toFixed(2)} ${(RING_LENGTH + 1).toFixed(2)}`}
          strokeDashoffset={RING_LENGTH.toFixed(2)}
          className={styles.arc}
        />
      </svg>
      <span aria-hidden className={styles.face}>
        <Icon name="arrow-up" strokeWidth={2} className={styles.arrow} />
      </span>
      <span aria-hidden className={styles.label}>
        Back to top
      </span>
    </button>
  );
}

/**
 * Focus the start of the content without scrolling (the scroll is already
 * under way). `<main>` takes focus only through a temporary tabindex; its
 * outline is suppressed meanwhile, since a ring around the whole page says
 * nothing. Both are undone as soon as focus moves on, so the skip link keeps
 * its usual behaviour.
 */
function focusMain() {
  const main = document.getElementById('main');
  if (!main) return;
  if (main.hasAttribute('tabindex')) {
    main.focus({ preventScroll: true });
    return;
  }
  const outline = main.style.outline;
  main.setAttribute('tabindex', '-1');
  main.style.outline = 'none';
  main.addEventListener(
    'blur',
    () => {
      main.removeAttribute('tabindex');
      main.style.outline = outline;
    },
    { once: true },
  );
  main.focus({ preventScroll: true });
}
