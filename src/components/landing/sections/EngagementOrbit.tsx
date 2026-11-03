import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { EngagementOrbitPause } from './EngagementOrbitPause';
import styles from './EngagementOrbit.module.css';

type Ring = 'outer' | 'dots';
type Tone = 'violet' | 'pink' | 'sky' | 'peach';

/** Seconds per lap. Planets on the dotted ring run the other way. */
const LAP: Record<Ring, number> = { outer: 56, dots: 44 };

/**
 * Where each planet starts, as a fraction of its lap. Fixed numbers rather
 * than random ones, so the server and the first client render agree.
 */
const PLANETS: { ring: Ring; start: number; size: number; tone: Tone }[] = [
  { ring: 'outer', start: 0.1, size: 12, tone: 'violet' },
  { ring: 'outer', start: 0.6, size: 9, tone: 'pink' },
  { ring: 'dots', start: 0.32, size: 9, tone: 'sky' },
  { ring: 'dots', start: 0.84, size: 7, tone: 'peach' },
];

/**
 * Decoration behind the engagement cards: orbit rings drawn just larger than
 * the card grid, planets that pass behind the cards, over a soft pastel mesh.
 * CSS and SVG only; the wrapper just pauses it all while it's offscreen.
 */
export function EngagementOrbit() {
  return (
    <EngagementOrbitPause className={styles.decor}>
      <div className={styles.mesh} />
      <div className={styles.stage}>
        <svg className={styles.rings} viewBox="0 0 1400 680" width="1400" height="680" fill="none">
          <defs>
            <linearGradient
              id="lp-engagement-orbit-outer"
              x1="40"
              y1="0"
              x2="1360"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#6d4aff" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#c9bbff" stopOpacity="0.35" />
              <stop offset="1" stopColor="#60a5fa" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <ellipse
            cx="700"
            cy="340"
            rx="660"
            ry="268"
            stroke="url(#lp-engagement-orbit-outer)"
            strokeWidth="1.25"
          />
          <ellipse className={styles.comet} cx="700" cy="340" rx="660" ry="268" pathLength={1000} />
          <ellipse className={styles.ringDots} cx="700" cy="340" rx="610" ry="240" pathLength={1000} />
          <ellipse className={styles.ringInner} cx="700" cy="340" rx="560" ry="218" pathLength={1000} />
        </svg>

        {PLANETS.map((planet) => {
          const lap = LAP[planet.ring];
          // A negative delay starts each planet part-way round. The dotted
          // ring runs in reverse, so its phase counts from the far end.
          const phase = planet.ring === 'dots' ? 1 - planet.start : planet.start;
          const style: CSSProperties = {
            width: planet.size,
            height: planet.size,
            offsetDistance: `${planet.start * 100}%`,
            animationDuration: `${lap}s`,
            animationDelay: `${(-phase * lap).toFixed(2)}s`,
          };
          return (
            <span
              key={`${planet.ring}-${planet.tone}`}
              className={cn(
                styles.planet,
                planet.ring === 'outer' ? styles.onOuter : styles.onDots,
                styles[planet.tone],
              )}
              style={style}
            />
          );
        })}
      </div>
    </EngagementOrbitPause>
  );
}
