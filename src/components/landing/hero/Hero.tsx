import type { CSSProperties } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { Magnetic } from '@/components/landing/primitives/Magnetic';
import { Eyebrow } from '@/components/landing/primitives/SectionHeading';
import { hero, socialLinks } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './Hero.module.css';
import { HeroParallax } from './HeroParallax';
import { IslandCanvas } from './IslandCanvas';

/** Entrance delay for one staggered element. */
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

function Backdrop() {
  return (
    <div aria-hidden className={styles.backdrop}>
      <div className={styles.glowSky} />
      <div className={styles.glowViolet} />
      <div className={styles.glowPink} />
      <div className={styles.dots} />
      <div className={cn(styles.cloud, styles.cloudC)} />
      <div className={cn(styles.cloud, styles.cloudA)} />
      <div className={cn(styles.cloud, styles.cloudB)} />
    </div>
  );
}

/** The hand-written note and its arrow, pointing at the island. Decorative. */
function Annotation() {
  return (
    <div
      aria-hidden
      className={cn(
        styles.note,
        'pointer-events-none absolute top-[1%] left-[2%] z-10 flex items-start gap-1 text-lp-ink-2 sm:left-[6%] lg:top-[3%] lg:left-[-2%] xl:left-[3%]',
      )}
    >
      <p className={cn(styles.noteText, 'font-hand text-[1.35rem] leading-[1.02] sm:text-[1.6rem] xl:text-[1.75rem]')}>
        {hero.annotation.map((line, index) => (
          <span
            key={line}
            className={cn(styles.noteLine, index === 2 && 'text-lp-violet-700')}
            style={delay(900 + index * 380)}
          >
            {line}
          </span>
        ))}
      </p>
      <svg
        viewBox="0 0 96 84"
        className={cn(styles.noteArrow, 'mt-5 h-[3.6rem] w-[4.2rem] text-lp-violet sm:h-[4.4rem] sm:w-[5rem]')}
      >
        <path d="M4 10c26-8 58-2 74 22 7 11 9 24 7 38" />
        <path d="m74 60 11 11 9-15" />
      </svg>
    </div>
  );
}

export function Hero() {
  return (
    <section id="home" aria-labelledby="hero-title" className="relative scroll-mt-24">
      <HeroParallax className={styles.hero}>
        <Backdrop />
        <div className="lp-container grid items-center gap-6 pt-8 pb-10 md:pt-12 lg:min-h-[min(40rem,calc(100dvh-9rem))] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-4 lg:pt-2 lg:pb-8">
          {/* ── Copy ── */}
          <div className="relative z-10 max-w-xl">
            <div className={styles.rise} style={delay(0)}>
              <Eyebrow>{hero.eyebrow}</Eyebrow>
            </div>

            <h1 id="hero-title" className="lp-h1 mt-6">
              <span className={cn(styles.rise, styles.line)} style={delay(80)}>
                {hero.title.lines[0]}
              </span>{' '}
              <span className={cn(styles.rise, styles.line)} style={delay(170)}>
                {hero.title.lines[1]}
              </span>{' '}
              <span className={cn(styles.rise, styles.line)} style={delay(260)}>
                <span className="lp-italic">{hero.title.lastLead}</span>{' '}
                <span className={cn(styles.accent, 'lp-italic')}>
                  {hero.title.lastAccent}
                  <svg aria-hidden viewBox="0 0 240 30" preserveAspectRatio="none" className={styles.swoosh}>
                    <defs>
                      <linearGradient id="lp-hero-swoosh" x1="0" x2="1">
                        <stop offset="0" stopColor="#6d4aff" />
                        <stop offset="1" stopColor="#b691ff" stopOpacity="0.85" />
                      </linearGradient>
                    </defs>
                    <path d="M6 22C70 9 150 5 234 13" stroke="url(#lp-hero-swoosh)" />
                  </svg>
                </span>
              </span>
            </h1>

            <p
              className={cn(styles.rise, 'lp-lead mt-7 max-w-[26rem] text-[1.075rem] text-lp-ink-2/80')}
              style={delay(360)}
            >
              {hero.subtitle}
            </p>

            <div className={cn(styles.rise, 'mt-8 flex flex-wrap items-center gap-3')} style={delay(450)}>
              <LpButton href={hero.primaryCta.href} variant="dark" size="lg" magnetic>
                {hero.primaryCta.label}
              </LpButton>
              <LpButton href={hero.secondaryCta.href} variant="outline" size="lg" icon={null} magnetic>
                {hero.secondaryCta.label}
              </LpButton>
            </div>

            <ul
              className={cn(styles.rise, 'mt-8 flex flex-wrap items-center gap-x-7 gap-y-3')}
              style={delay(540)}
              aria-label="Elsewhere"
            >
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                    className={cn(
                      styles.social,
                      'inline-flex items-center gap-2 text-sm font-semibold text-lp-ink-2 hover:text-lp-violet-700',
                    )}
                  >
                    <Icon name={link.icon} className={cn(styles.socialIcon, 'size-4')} />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Island ── */}
          <div className={cn(styles.visual, 'relative h-[min(96vw,30rem)] sm:h-[34rem] lg:h-[min(40rem,calc(100dvh-8rem))] lg:min-h-[32rem]')}>
            <div className={cn(styles.island, 'absolute top-[-2%] right-[-6%] bottom-[-2%] left-[-6%] lg:right-[-10%] lg:left-[-4%]')}>
              <IslandCanvas variant="hero" interactive />
            </div>

            <Annotation />

            <p
              className={cn(
                styles.hint,
                styles.hintMouse,
                'lp-glass pointer-events-none absolute bottom-[7%] left-[4%] z-10 hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-lp-ink-2 sm:inline-flex',
              )}
            >
              <Icon name="rotate" className="size-3.5 text-lp-violet animate-lp-spin" />
              {hero.dragHint}
            </p>

            <div className="absolute right-[2%] bottom-[5%] z-10 lg:right-[0%] lg:bottom-[8%]">
              <Magnetic strength={0.2}>
                <span className="relative inline-flex">
                  <span aria-hidden className={styles.enterPulse} />
                  <span className={styles.enter}>
                  <LpButton
                    href={hero.worldCta.href}
                    variant="gradient"
                    size="lg"
                    icon="arrow-up-right"
                    ariaLabel={`${hero.worldCta.label}: explore my engineering city in 3D`}
                    className="shadow-none"
                  >
                    {hero.worldCta.label}
                  </LpButton>
                  </span>
                </span>
              </Magnetic>
            </div>
          </div>
        </div>
      </HeroParallax>
    </section>
  );
}
