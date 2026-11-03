'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { cn } from '@/lib/utils';
import styles from './Projects.module.css';

export interface CarouselSlide {
  id: string;
  title: string;
  /** The server-rendered slide body: its text column and its visual. */
  content: ReactNode;
}

type Direction = 'next' | 'prev';
type SlideState = 'current' | 'entering' | 'leaving' | 'idle';

interface View {
  index: number;
  /** The slide shown before the last change; null until something changes. */
  previous: number | null;
  direction: Direction;
}

const REDUCED = '(prefers-reduced-motion: reduce)';
const FINE = '(hover: hover) and (pointer: fine)';
/** Degrees the visual turns toward the pointer at the card's edges. */
const TILT = 7;
/** Horizontal travel, in px, before a touch drag counts as a swipe. */
const SWIPE = 48;

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The Selected Projects carousel (WAI-ARIA carousel pattern).
 *
 * Every slide is server-rendered into one grid cell; only the active one is
 * visible, so the card keeps a constant height and, without JavaScript, the
 * first project simply reads as a static card. Slide changes are CSS: the
 * slide states below select the text crossfade and the panels' rotation.
 *
 * Autoplay is the active picker bar's fill animation: its `animationend`
 * advances the slide, so pausing that one animation (hover, focus within,
 * off screen, hidden tab, the pause button) pauses the carousel. It is off
 * under reduced motion. Only changes the visitor makes are announced.
 */
export function ProjectCarousel({
  slides,
  label,
  interval = 7000,
}: {
  slides: CarouselSlide[];
  label: string;
  /** Milliseconds each slide shows while autoplaying. */
  interval?: number;
}) {
  const count = slides.length;
  const trackId = useId();
  const [view, setView] = useState<View>({ index: 0, previous: null, direction: 'next' });
  const [announcement, setAnnouncement] = useState('');
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState<boolean | null>(null);
  // Neither is knowable on the server: render as reduced (no autoplay) and
  // visible, then settle on the client's real values after hydration.
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
  const tabHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const autoplay = !reduced && count > 1;
  const offscreen = inView === false || tabHidden;

  const regionRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restoreFocus = useRef(false);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  const goTo = (target: number, direction: Direction, byUser: boolean) => {
    if (count < 2) return;
    const index = ((target % count) + count) % count;
    if (index === view.index) return;
    if (byUser) {
      // Keyboard paging from inside a slide must not drop focus on <body>
      // when that slide goes inert.
      const leaving = slideRefs.current[view.index];
      restoreFocus.current = Boolean(leaving?.contains(document.activeElement));
      const slide = slides[index];
      if (slide) setAnnouncement(`Slide ${index + 1} of ${count}: ${slide.title}`);
    }
    setView({ index, previous: view.index, direction });
  };

  const next = (byUser: boolean) => goTo(view.index + 1, 'next', byUser);
  const prev = () => goTo(view.index - 1, 'prev', true);

  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    slideRefs.current[view.index]
      ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      ?.focus({ preventScroll: true });
  }, [view.index]);

  useEffect(() => {
    const region = regionRef.current;
    if (!region || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.15 },
    );
    observer.observe(region);
    return () => observer.disconnect();
  }, []);

  // Pointer over the card: a spotlight that follows it, and the visual
  // turning toward it. Written as custom properties in a rAF, so moving the
  // mouse never re-renders React.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const fine = window.matchMedia(FINE);
    const reducedQuery = window.matchMedia(REDUCED);
    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.min(1, Math.max(0, (px - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (py - rect.top) / rect.height));
      card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (reducedQuery.matches) return;
      card.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * TILT).toFixed(2)}deg`);
      card.style.setProperty('--tilt-x', `${(-(y - 0.5) * 2 * TILT * 0.6).toFixed(2)}deg`);
      card.setAttribute('data-tilting', '');
    };

    const onMove = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType === 'touch') return;
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card.removeAttribute('data-tilting');
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next(true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) next(true);
    else prev();
  };

  const onProgressEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    // Reduced motion collapses animations to ~0ms; never let that spin the carousel.
    if (event.target !== event.currentTarget || event.elapsedTime < 1) return;
    next(false);
  };

  const stateOf = (i: number): SlideState => {
    if (i === view.index) return view.previous === null ? 'current' : 'entering';
    if (i === view.previous) return 'leaving';
    return 'idle';
  };

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={styles.region}
      data-autoplay={autoplay ? '' : undefined}
      data-paused={userPaused || offscreen ? '' : undefined}
      data-offscreen={offscreen ? '' : undefined}
      style={{ '--interval': `${interval}ms` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {count > 1 ? (
        <>
          <div className={styles.picker}>
            {autoplay ? (
              <button
                type="button"
                className={styles.pauseBtn}
                aria-label={userPaused ? 'Start automatic slide show' : 'Stop automatic slide show'}
                onClick={() => setUserPaused((paused) => !paused)}
              >
                <Icon name={userPaused ? 'play' : 'pause'} className="size-3.5" strokeWidth={2.2} />
              </button>
            ) : null}
            <div className={styles.tabs}>
              {slides.map((slide, i) => {
                const active = i === view.index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    className={styles.tab}
                    aria-current={active ? 'true' : undefined}
                    aria-controls={trackId}
                    onClick={() => goTo(i, i > view.index ? 'next' : 'prev', true)}
                  >
                    <span className={styles.tabTrack} aria-hidden="true">
                      <span className={styles.tabFill} onAnimationEnd={active ? onProgressEnd : undefined} />
                    </span>
                    <span className={styles.tabLabel}>
                      <span className={styles.tabNum} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span className="sr-only">{`Slide ${i + 1} of ${count}: `}</span>
                      <span className={cn(styles.tabName, 'max-md:sr-only')}>{slide.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.navArea}>
            <button
              type="button"
              className={cn(styles.navBtn, styles.navPrev)}
              aria-label="Previous project"
              aria-controls={trackId}
              onClick={prev}
            >
              <Icon name="arrow-left" className={styles.navIcon} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={cn(styles.navBtn, styles.navNext)}
              aria-label="Next project"
              aria-controls={trackId}
              onClick={() => next(true)}
            >
              <Icon name="arrow-right" className={styles.navIcon} strokeWidth={2} />
            </button>
          </div>
        </>
      ) : null}

      <div ref={cardRef} className={styles.card}>
        <span className={styles.beam} aria-hidden="true" />
        <div className={cn(styles.surface, 'lp-spotlight lp-spotlight-dark')}>
          <div
            id={trackId}
            className={styles.track}
            data-dir={view.direction}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            {slides.map((slide, i) => {
              const active = i === view.index;
              return (
                <div
                  key={slide.id}
                  ref={(element) => {
                    slideRefs.current[i] = element;
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${count}`}
                  aria-hidden={active ? undefined : true}
                  inert={!active}
                  className={styles.slide}
                  data-state={stateOf(i)}
                >
                  {slide.content}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
