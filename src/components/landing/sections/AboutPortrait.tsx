import type { CSSProperties } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { LogoMark } from '@/components/landing/primitives/Logo';
import { TechIcon, type TechIconName } from '@/components/landing/primitives/TechIcon';
import { about, hero, marqueeRows } from '@/data/landing';
import { profile } from '@/data/profile';
import { cn } from '@/lib/utils';
import { AboutParallax } from './AboutParallax';
import styles from './AboutPortrait.module.css';

/** Inline values for the CSS module: custom properties (`--depth`, `--r`…) and positions. */
function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

/** Display names for the orbit glyphs, taken from the marquee's name/icon pairs. */
const TECH_NAMES = new Map<TechIconName, string>(
  marqueeRows.flat().map((tech) => [tech.icon, tech.name]),
);

type RingVariant = 'inner' | 'dashed' | 'outer';

/** The outer ring's radius, shared with the comet that runs along it. */
const OUTER_RADIUS = 43.5;

/**
 * Radius in % of the stage, period, direction, and the angle of the first
 * badge. Periods are deliberately unrelated so the rings never line up.
 */
const RINGS: { variant: RingVariant; radius: number; seconds: number; reverse: boolean; start: number }[] = [
  { variant: 'inner', radius: 22.5, seconds: 38, reverse: false, start: 65 },
  { variant: 'dashed', radius: 33, seconds: 56, reverse: true, start: 10 },
  { variant: 'outer', radius: OUTER_RADIUS, seconds: 84, reverse: false, start: -40 },
];

/** Splits the glyphs over the three rings, inner to outer; the inner ring carries fewest. */
function distribute(icons: TechIconName[]): TechIconName[][] {
  const inner = Math.max(1, Math.floor(icons.length / 4));
  const middle = Math.round((icons.length - inner) / 2);
  return [icons.slice(0, inner), icons.slice(inner, inner + middle), icons.slice(inner + middle)];
}

/** Fixed positions (% of the card), so the server and the client draw the same sky. */
const SPARKLES = [
  { x: 13, y: 24, size: 0.8, delay: 0, violet: false },
  { x: 87, y: 33, size: 0.6, delay: 1.3, violet: true },
  { x: 82, y: 78, size: 0.95, delay: 2.2, violet: false },
  { x: 16, y: 67, size: 0.55, delay: 0.7, violet: true },
  { x: 55, y: 6, size: 0.5, delay: 1.8, violet: false },
  { x: 6, y: 46, size: 0.45, delay: 3, violet: false },
];

/** 2πr for the stamp's lettering circle (r = 37 in a 100-unit box). */
const STAMP_CIRCUMFERENCE = 232.4;

function DashedRing() {
  return (
    <svg viewBox="0 0 100 100" className={styles.ringSvg} focusable="false">
      <defs>
        <linearGradient id="about-orbit-dash" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d4aff" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#c084fc" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="49.6"
        fill="none"
        stroke="url(#about-orbit-dash)"
        strokeWidth="0.42"
        strokeDasharray="1.4 3.2"
        strokeLinecap="round"
        pathLength={360}
      />
    </svg>
  );
}

/**
 * The About section's portrait: there is no photo, so the mark stands in for
 * the person — glowing at the centre of the tools it works with. Purely
 * decorative (hidden from assistive technology); everything it says is also
 * in the section's text.
 */
export function AboutPortrait() {
  const groups = distribute(about.orbit);
  const available = profile.availability.state === 'available';
  const dot = available ? 'bg-lp-green' : 'bg-amber-500';

  return (
    <AboutParallax className={styles.root}>
      <div className={styles.halo} />

      <div className={styles.card}>
        <div className={cn(styles.layer, styles.mesh)} style={vars({ '--depth': -12 })}>
          <span className={cn(styles.blob, styles.blobLilac)} />
          <span className={cn(styles.blob, styles.blobPink)} />
          <span className={cn(styles.blob, styles.blobSky)} />
          <span className={cn(styles.blob, styles.blobPeach)} />
        </div>
        <div className={styles.grain} />
        <div className={styles.dots} />

        <div className={cn(styles.layer, styles.stage)} style={vars({ '--depth': 10 })}>
          {RINGS.map((ring, index) => {
            const icons = groups[index] ?? [];
            return (
              <div
                key={ring.variant}
                className={cn(
                  styles.ring,
                  ring.variant !== 'dashed' && styles[ring.variant],
                  ring.reverse && styles.reverse,
                )}
                style={vars({ '--r': ring.radius, '--dur': `${ring.seconds}s` })}
              >
                {ring.variant === 'dashed' ? <DashedRing /> : null}
                {icons.map((icon, slot) => (
                  <span
                    key={icon}
                    className={styles.slot}
                    style={vars({ '--a': `${ring.start + (360 / icons.length) * slot}deg` })}
                  >
                    <span className={styles.upright}>
                      <span className={styles.badge}>
                        <TechIcon name={icon} className={styles.badgeIcon} />
                      </span>
                      <span className={styles.badgeLabel}>{TECH_NAMES.get(icon) ?? icon}</span>
                    </span>
                  </span>
                ))}
              </div>
            );
          })}

          <div className={styles.comet} style={vars({ '--r': OUTER_RADIUS })}>
            <span className={styles.cometArc} />
            <span className={styles.cometHead} />
          </div>

          <div className={cn(styles.layer, styles.core)} style={vars({ '--depth': 8 })}>
            <span className={styles.coreGlow} />
            <span className={styles.auroraBlur} />
            <span className={styles.aurora} />
            <span className={styles.sonar} />
            <span className={cn(styles.sonar, styles.sonarLate)} />
            <span className={styles.disc}>
              <LogoMark uid="about" className={styles.mark} />
            </span>
          </div>
        </div>

        <div className={cn(styles.layer, styles.sparkles)} style={vars({ '--depth': 22 })}>
          {SPARKLES.map((sparkle) => (
            <span
              key={`${sparkle.x}-${sparkle.y}`}
              className={cn(styles.sparkle, sparkle.violet && styles.sparkleViolet)}
              style={vars({
                left: `${sparkle.x}%`,
                top: `${sparkle.y}%`,
                '--s': `${sparkle.size}rem`,
                '--delay': `${sparkle.delay}s`,
              })}
            >
              <Icon name="spark" className="size-full" />
            </span>
          ))}
        </div>

        <div className={cn(styles.layer, styles.plate)} style={vars({ '--depth': 5 })}>
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] leading-tight font-bold tracking-[-0.02em] text-lp-ink">
              {profile.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-lp-muted">{profile.role}</span>
          </span>
          <span className={styles.plateChip}>
            <Icon name="map-pin" className="size-3.5 text-lp-violet" />
            {profile.location}
          </span>
        </div>
      </div>

      <div className={cn(styles.layer, styles.float, styles.floatYears)} style={vars({ '--depth': 26 })}>
        <div className={cn(styles.bob, styles.pill)}>
          <span className={styles.pillIcon}>
            <Icon name="calendar" className="size-4" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base leading-none font-extrabold tracking-[-0.03em] text-lp-ink">
              {profile.yearsExperience} yrs
            </span>
            <span className="text-[0.6875rem] leading-none font-medium text-lp-muted">experience</span>
          </span>
        </div>
      </div>

      <div className={cn(styles.layer, styles.float, styles.floatStatus)} style={vars({ '--depth': 32 })}>
        <div className={cn(styles.bob, styles.bobLate, styles.pill, styles.pillStatus)}>
          <span className="relative inline-flex size-2.5">
            <span className={cn('absolute inset-0 rounded-full animate-lp-pulse-ring', dot)} />
            <span className={cn('relative inline-flex size-2.5 rounded-full', dot)} />
          </span>
          <span className="text-[0.8125rem] font-semibold text-lp-ink-2">{profile.availability.label}</span>
        </div>
      </div>

      <div className={cn(styles.layer, styles.stamp)} style={vars({ '--depth': 18 })}>
        <span className={styles.stampDisc} />
        <svg viewBox="0 0 100 100" className={styles.stampText} focusable="false">
          <defs>
            <path id="about-stamp-path" d="M 50 50 m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0" />
          </defs>
          <text fill="currentColor" fontSize="8.2" fontWeight="700">
            <textPath href="#about-stamp-path" textLength={STAMP_CIRCUMFERENCE} lengthAdjust="spacing">
              {`${hero.eyebrow} • `.toUpperCase()}
            </textPath>
          </text>
        </svg>
        <span className={styles.stampCore}>
          <Icon name="spark" className="size-4" />
        </span>
      </div>
    </AboutParallax>
  );
}
