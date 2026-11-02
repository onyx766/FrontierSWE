'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { revealVariants, revealViewport, staggerVariants } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li' | 'section' | 'article';
}

/**
 * Motion primitive 3 — reveal. A 12px rise plus opacity, fired once when the
 * element scrolls into view. Framer Motion is imported here only, so page
 * shells stay server components.
 */
export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </Component>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: 'div' | 'ul' | 'ol' | 'section';
}

/** Staggered container. Children should be `Reveal` or `motion` elements. */
export function RevealGroup({
  children,
  className,
  stagger = 0.06,
  delay = 0,
  as = 'div',
}: RevealGroupProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={staggerVariants(stagger, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
    >
      {children}
    </Component>
  );
}

/** Child of a RevealGroup — inherits the stagger from its parent. */
export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const Component = motion[as];
  return (
    <Component className={className} variants={revealVariants}>
      {children}
    </Component>
  );
}
