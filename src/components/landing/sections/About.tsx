import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { Eyebrow, GradientText } from '@/components/landing/primitives/SectionHeading';
import { Reveal } from '@/components/primitives/Reveal';
import { about, startProjectHref } from '@/data/landing';
import { profile } from '@/data/profile';
import { cn } from '@/lib/utils';
import styles from './About.module.css';
import { AboutPortrait } from './AboutPortrait';
import { AboutPrinciples } from './AboutPrinciples';

/** "Engineer first. Product-minded always." → the first sentence, then the accented rest. */
function splitTitle(title: string): [string, string] {
  const cut = title.indexOf('. ');
  return cut === -1 ? [title, ''] : [title.slice(0, cut + 1), title.slice(cut + 2)];
}

/** Keeps hyphenated words ("Product-minded") whole: a line break at the hyphen reads as a typo. */
function wholeHyphenated(text: string): ReactNode {
  const words = text.split(' ');
  return words.map((word, index) => (
    <Fragment key={index}>
      {word.includes('-') ? <span className="whitespace-nowrap">{word}</span> : word}
      {index < words.length - 1 ? ' ' : null}
    </Fragment>
  ));
}

/**
 * About: the portrait illustration beside a short introduction, the facts
 * and the calls to action, then the working principles across the full width.
 */
export function About() {
  const [lead, accent] = splitTitle(about.title);
  const available = profile.availability.state === 'available';

  return (
    <section id="about" aria-labelledby="about-title" className="lp-section">
      <div className="lp-container">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 xl:gap-24">
          {/* Text comes first in the source (and on small screens); on large
              screens the portrait takes the left column. */}
          <div className="lg:col-start-2 lg:row-start-1">
            <Reveal>
              <Eyebrow>{about.eyebrow}</Eyebrow>
              <h2 id="about-title" className="lp-h2 mt-4">
                {/* The space keeps the accessible name from running "first.Product" together. */}
                <span className="block">{wholeHyphenated(lead)}</span>{' '}
                {accent ? <GradientText italic>{wholeHyphenated(accent)}</GradientText> : null}
              </h2>
              <div className="mt-6 max-w-[36rem] space-y-4">
                {about.paragraphs.map((paragraph, index) => (
                  <p key={index} className={cn('lp-lead', index === 0 && 'text-lp-ink-2')}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </Reveal>

            <Reveal as="dl" delay={0.05} className={cn(styles.facts, 'mt-9 grid gap-3 sm:grid-cols-2')}>
              {about.facts.map((fact, index) => (
                <div key={fact.label} className={styles.fact} style={{ '--i': index } as CSSProperties}>
                  <dt className="text-[0.6875rem] leading-none font-semibold tracking-[0.14em] text-lp-muted uppercase">
                    <span aria-hidden className={styles.factIcon}>
                      <Icon name={fact.icon} className="relative size-[1.125rem]" />
                    </span>
                    {fact.label}
                  </dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-[0.9375rem] leading-snug font-semibold text-lp-ink">
                    {fact.value === profile.availability.label ? (
                      <span aria-hidden className="relative inline-flex size-2 shrink-0">
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
                    ) : null}
                    {fact.value}
                  </dd>
                </div>
              ))}
            </Reveal>

            <Reveal delay={0.1} className="mt-9 flex flex-wrap items-center gap-3">
              <LpButton href={startProjectHref} variant="gradient" icon="arrow-up-right" magnetic>
                Start a Project
              </LpButton>
              <LpButton href={about.secondaryCta.href} variant="outline">
                {about.secondaryCta.label}
              </LpButton>
            </Reveal>
          </div>

          <Reveal className="lg:col-start-1 lg:row-start-1">
            <AboutPortrait />
          </Reveal>
        </div>

        <AboutPrinciples />
      </div>
    </section>
  );
}
