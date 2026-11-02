'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * Motion primitive 3 — reveal. A 12px rise plus opacity, fired once when the
 * element scrolls into view.
 *
 * Implemented with one IntersectionObserver and a CSS transition rather than a
 * motion library. Reveals appear on every page, so a library here would mean
 * shipping its runtime on every page for an effect that is two CSS properties
 * — it measured at roughly 45KB gzipped of the first load. Framer Motion is
 * still used where it genuinely earns its weight (the request trace on project
 * pages), so it loads only on the routes that animate something non-trivial.
 *
 * No-JavaScript safety: the hiding rule in globals.css is scoped to
 * `html[data-js]`, an attribute set by a tiny synchronous script in the root
 * layout. Without JavaScript the attribute never appears and every revealed
 * element simply renders visible — nothing is hidden behind an observer that
 * will never fire. The rule is also inside a `prefers-reduced-motion:
 * no-preference` query, so reduced-motion visitors never see content hidden
 * either.
 */

function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No observer support, or the rule is not active: show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      element.setAttribute('data-revealed', '');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds, matching the previous motion-library API. */
  delay?: number;
  as?: ElementType;
}

export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: RevealProps) {
  const ref = useRevealOnce<HTMLElement>();

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? { transitionDelay: `${Math.round(delay * 1000)}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * Staggered container. Children are staggered by `:nth-child` in CSS, so no
 * index needs threading through props and the DOM structure is untouched —
 * children stay direct grid or flex items of the container.
 */
export function RevealGroup({ children, className, as: Tag = 'div' }: RevealGroupProps) {
  const ref = useRevealOnce<HTMLElement>();

  return (
    <Tag ref={ref} data-reveal-group="" className={className}>
      {children}
    </Tag>
  );
}

/**
 * Child of a RevealGroup. Now a plain element — the parent's CSS handles the
 * animation. Kept as a component so group markup stays self-documenting.
 */
export function RevealItem({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return <Tag className={className}>{children}</Tag>;
}
