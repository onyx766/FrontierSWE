'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks `prefers-reduced-motion`. Starts as `false` so the server render and
 * the first client render agree, then corrects after mount — the CSS in
 * globals.css already neutralises decorative animation immediately, so there
 * is no flash of motion before this resolves.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
