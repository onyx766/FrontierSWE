'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Returns true only while the element is on screen AND the tab is visible.
 *
 * This is the single switch that stops the live feed and the topology event bus
 * from burning CPU in a background tab or below the fold — the main cost risk
 * in a site built around continuous animation.
 */
export function useActiveWhenVisible<T extends Element>(): {
  ref: React.RefObject<T | null>;
  active: boolean;
} {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin: '120px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return { ref, active: inView && tabVisible };
}
