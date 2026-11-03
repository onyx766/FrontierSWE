'use client';

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

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

/**
 * Attributes passed straight through to the rendered element, e.g. so a
 * `RevealGroup as="ul"` can carry `role="list"` (Safari drops list semantics
 * when list-style is none) or a label.
 */
type PassThrough = Pick<
  HTMLAttributes<HTMLElement>,
  'id' | 'role' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'
>;

interface RevealProps extends PassThrough {
  children: ReactNode;
  className?: string;
  /** Seconds, matching the previous motion-library API. */
  delay?: number;
  as?: ElementType;
}

export function Reveal({ children, className, delay = 0, as: Tag = 'div', ...rest }: RevealProps) {
  const ref = useRevealOnce<HTMLElement>();

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? { transitionDelay: `${Math.round(delay * 1000)}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface RevealGroupProps extends PassThrough {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * Staggered container. Children are staggered by `:nth-child` in CSS, so no
 * index needs threading through props and the DOM structure is untouched —
 * children stay direct grid or flex items of the container.
 */
export function RevealGroup({ children, className, as: Tag = 'div', ...rest }: RevealGroupProps) {
  const ref = useRevealOnce<HTMLElement>();

  return (
    <Tag ref={ref} data-reveal-group="" className={className} {...rest}>
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
