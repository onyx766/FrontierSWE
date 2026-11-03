'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { Logo } from '@/components/landing/primitives/Logo';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { navSections, startProjectHref } from '@/data/landing';
import { profile } from '@/data/profile';
import { cn } from '@/lib/utils';

/** Where in the viewport a section counts as "current": 40% down from the top. */
const SPY_LINE = 0.4;

/**
 * Landing navigation. Links are plain in-page anchors, so they work without
 * JavaScript; with it, the current section is tracked on scroll and a single
 * underline slides between links to mark it.
 */
export function LandingNav() {
  const [active, setActive] = useState(navSections[0]?.id ?? 'home');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());

  // Scroll position → glass header + current section. Section offsets are
  // measured only when layout can have changed (resize, content size); a
  // scroll just compares numbers, so it never forces layout.
  useEffect(() => {
    let frame = 0;
    let tops: { id: string; top: number }[] = [];

    const measure = () => {
      tops = navSections.flatMap((section) => {
        const element = document.getElementById(section.id);
        return element ? [{ id: section.id, top: element.getBoundingClientRect().top + window.scrollY }] : [];
      });
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);
      // The section that most recently passed the line, wherever it sits in
      // navSections: the page and the nav list are not in the same order.
      const line = y + window.innerHeight * SPY_LINE;
      let current = navSections[0]?.id ?? 'home';
      let best = -Infinity;
      for (const { id, top } of tops) {
        if (top <= line && top > best) {
          best = top;
          current = id;
        }
      }
      // At the very bottom, the last section may never reach the line.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
        const last = tops.reduce<{ id: string; top: number } | null>(
          (latest, entry) => (latest === null || entry.top > latest.top ? entry : latest),
          null,
        );
        if (last) current = last.id;
      }
      setActive(current);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    // Fonts, images, accordions and reveals change section offsets without a resize.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure);
    observer?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
    };
  }, []);

  const placeIndicator = useCallback(() => {
    const indicator = indicatorRef.current;
    const link = linkRefs.current.get(active);
    if (!indicator || !link) return;
    // Under the label only: inset by the link's horizontal padding. The
    // link's offsetParent is the <nav> (the nearest positioned ancestor),
    // which is also what the indicator is positioned against.
    const inset = 14;
    const left = link.offsetLeft + inset;
    indicator.style.width = `${Math.max(0, link.offsetWidth - inset * 2)}px`;
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.opacity = '1';
  }, [active]);

  useLayoutEffect(() => {
    placeIndicator();
  }, [placeIndicator]);

  // Fonts loading or the window resizing moves the links; follow them.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => placeIndicator());
    observer.observe(list);
    return () => observer.disconnect();
  }, [placeIndicator]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const available = profile.availability.state === 'available';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300',
        scrolled || open
          ? 'border-lp-line/80 bg-white/75 shadow-[0_8px_30px_-18px_rgb(60_40_160/0.35)] backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="lp-container flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
        <a href="#home" className="group shrink-0 rounded-lg" aria-label={`${profile.name} — home`}>
          <Logo uid="nav" name={profile.name} />
        </a>

        <nav aria-label="Main" className="relative hidden lg:block">
          <ul ref={listRef} className="flex items-center gap-1">
            {navSections.map((section) => (
              <li key={section.id}>
                <a
                  ref={(node) => {
                    if (node) linkRefs.current.set(section.id, node);
                    else linkRefs.current.delete(section.id);
                  }}
                  href={`#${section.id}`}
                  onClick={() => setActive(section.id)}
                  aria-current={active === section.id ? 'location' : undefined}
                  className={cn(
                    'relative block rounded-full px-3.5 py-2 text-[0.9rem] font-medium transition-colors duration-200',
                    active === section.id
                      ? 'text-lp-ink'
                      : 'text-lp-body hover:bg-lp-tint/70 hover:text-lp-violet-700',
                  )}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <span
            ref={indicatorRef}
            aria-hidden
            className="pointer-events-none absolute -bottom-0.5 left-0 h-[2px] rounded-full bg-gradient-to-r from-lp-violet-600 to-lp-purple opacity-0 transition-[transform,width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          />
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <span className="hidden items-center gap-2 text-sm font-medium text-lp-ink-2 md:inline-flex">
            <span aria-hidden className="relative inline-flex size-2">
              <span
                className={cn(
                  'absolute inset-0 rounded-full animate-lp-pulse-ring',
                  available ? 'bg-lp-green' : 'bg-amber-500',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex size-2 rounded-full',
                  available ? 'bg-lp-green' : 'bg-amber-500',
                )}
              />
            </span>
            {available ? 'Available' : profile.availability.label}
          </span>

          <LpButton
            href={startProjectHref}
            variant="gradient"
            size="sm"
            icon="arrow-up-right"
            className="hidden sm:inline-flex"
          >
            Start a Project
          </LpButton>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="lp-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-10 items-center justify-center rounded-full border border-lp-line-strong bg-white/80 text-lp-ink transition-colors hover:border-lp-violet/50 hover:text-lp-violet-700 lg:hidden"
          >
            <Icon name={open ? 'x' : 'menu'} className="size-5" />
          </button>
        </div>
      </div>

      <div id="lp-mobile-nav" hidden={!open} className="border-t border-lp-line/80 lg:hidden">
        <nav aria-label="Mobile" className="lp-container flex flex-col py-3">
          {navSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setOpen(false)}
              aria-current={active === section.id ? 'location' : undefined}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium transition-colors',
                active === section.id
                  ? 'bg-lp-tint text-lp-violet-700'
                  : 'text-lp-ink-2 hover:bg-lp-surface-2',
              )}
            >
              {section.label}
              <Icon name="arrow-right" className="size-4 opacity-50" />
            </a>
          ))}
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-lp-line pt-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-lp-ink-2">
              <span aria-hidden className="size-2 rounded-full bg-lp-green" />
              {profile.availability.label}
            </span>
            <LpButton href={startProjectHref} variant="gradient" size="sm" icon="arrow-up-right">
              Start a Project
            </LpButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
