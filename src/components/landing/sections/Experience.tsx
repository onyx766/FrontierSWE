import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { GradientText, SectionHeading } from '@/components/landing/primitives/SectionHeading';
import { RevealGroup } from '@/components/primitives/Reveal';
import { experienceIntro, timeline } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './Experience.module.css';
import { ExperienceSection } from './ExperienceSection';
import { SummitArt } from './SummitArt';

type CssVars = CSSProperties & Record<`--${string}`, string>;

/** "2019 – 2022" → "2019": the tag on the role's milestone. */
function startYear(period: string): string {
  return /\d{4}/.exec(period)?.[0] ?? period;
}

/**
 * Experience: the heading, a vertical timeline (newest first) and the summit
 * illustration, whose trail carries one milestone per role. Hovering a role
 * highlights its milestone and the other way round, in CSS alone; the client
 * wrapper only lights the timeline as it scrolls past and starts the trail.
 */
export function Experience() {
  // The rail shades violet → lilac from the newest stop to the oldest.
  const span = Math.max(1, timeline.length - 1);

  return (
    <ExperienceSection id="experience" labelledBy="experience-title" className={cn('lp-section', styles.section)}>
      <div
        className={cn(
          'lp-container grid gap-10 lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] lg:gap-14 xl:gap-20',
          styles.content,
        )}
      >
        <div className={styles.lead}>
          <SectionHeading
            id="experience-title"
            title={
              <>
                {experienceIntro.title}
                <br />
                <GradientText italic>{experienceIntro.accent}</GradientText>
              </>
            }
            description={experienceIntro.description}
          >
            <Link
              href={experienceIntro.more.href}
              className={cn(styles.more, 'group inline-flex items-center gap-1.5 text-sm font-semibold text-lp-violet-700')}
            >
              {experienceIntro.more.label}
              <Icon
                name="arrow-right"
                strokeWidth={2}
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </SectionHeading>
        </div>

        <div className="min-w-0">
          <RevealGroup as="ol" className={styles.timeline}>
            {timeline.map((entry, index) => {
              const rail: CssVars = {
                '--rail-a': `${((index / span) * 100).toFixed(1)}%`,
                '--rail-b': `${((Math.min(index + 1, span) / span) * 100).toFixed(1)}%`,
              };
              return (
                <li
                  key={entry.period}
                  className={styles.entry}
                  data-entry={index}
                  data-current={entry.current ? '' : undefined}
                  style={rail}
                >
                  <span className={styles.rail} aria-hidden="true" />
                  <span className={styles.node} aria-hidden="true" />
                  <div className={styles.card}>
                    <h3 className={cn(styles.role, 'text-[1rem] leading-snug sm:text-[1.0625rem]')}>{entry.role}</h3>
                    <p className={styles.period}>
                      {entry.current ? <span className={styles.live} aria-hidden="true" /> : null}
                      {entry.period}
                    </p>
                    <p className={cn(styles.summary, 'mt-1.5 text-[0.875rem] leading-relaxed text-lp-body sm:text-[0.9375rem]')}>
                      {entry.summary}
                    </p>
                    <div className={cn(styles.tech, 'mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2')}>
                      <span className="text-[0.75rem] font-semibold leading-6 text-lp-ink-2">Tech:</span>
                      <ul className="flex flex-wrap gap-1.5">
                        {entry.tech.map((name) => (
                          <li key={name} className={styles.chip}>
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </RevealGroup>
        </div>
      </div>

      <SummitArt
        className={styles.art}
        milestones={timeline.map((entry) => ({ label: startYear(entry.period), current: Boolean(entry.current) }))}
      />
    </ExperienceSection>
  );
}
