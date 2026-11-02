import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion vocabulary. Imported only by client leaf components so the
 * framer-motion bundle never leaks into server-rendered page shells.
 */

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  micro: 0.15,
  ui: 0.3,
  reveal: 0.5,
  slow: 0.8,
} as const;

export const revealTransition: Transition = {
  duration: DURATION.reveal,
  ease: EASE_OUT_EXPO,
};

/** Primitive 3: reveal — 12px rise plus opacity. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** Staggered container for lists of revealed children. */
export function staggerVariants(stagger = 0.06, delay = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };
}

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.ui, ease: EASE_SOFT } },
};

/** Viewport config used for every scroll reveal: fire once, slightly early. */
export const revealViewport = { once: true, margin: '-10% 0px -10% 0px' } as const;
