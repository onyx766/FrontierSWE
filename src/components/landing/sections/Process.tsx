import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { GradientText, SectionHeading } from '@/components/landing/primitives/SectionHeading';
import { Tilt } from '@/components/landing/primitives/Tilt';
import { RevealGroup } from '@/components/primitives/Reveal';
import { processIntro, processSteps } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './Process.module.css';

const pad = (value: number) => String(value).padStart(2, '0');

/** The title's last word takes the accent, as the other headings do. */
function accented(title: string): ReactNode {
  const words = title.split(' ');
  const accent = words.pop();
  if (!accent || words.length === 0) return title;
  return (
    <>
      {words.join(' ')} <GradientText italic>{accent}</GradientText>
    </>
  );
}

/**
 * Process: the four steps every engagement runs through, as cards on a rail.
 * The rail draws in station by station when the list scrolls into view, then
 * a spark keeps travelling it. Server-rendered; only the tilt is a client
 * component, and the reveal is the shared CSS-driven primitive.
 */
export function Process() {
  return (
    <section id="process" aria-labelledby="process-title" className="lp-section">
      <div className="lp-container">
        <SectionHeading
          id="process-title"
          align="center"
          eyebrow={processIntro.eyebrow}
          title={accented(processIntro.title)}
          description={processIntro.description}
        />

        <RevealGroup as="ol" className={cn(styles.steps, 'mt-14 md:mt-16')}>
          {processSteps.map((step, index) => (
            <li key={step.title} className={styles.step} style={{ '--i': index } as CSSProperties}>
              <span aria-hidden className={styles.rail}>
                <span className={styles.track} />
                <span className={styles.line} />
                <span data-motion="packet" className={styles.spark}>
                  <span className={styles.sparkDot} />
                </span>
              </span>

              <Tilt className={cn('lp-card lp-spotlight', styles.card)} max={6} lift={6}>
                <span aria-hidden className={styles.number}>
                  <span className={styles.numberOutline}>{pad(index + 1)}</span>
                  <span className={styles.numberFill}>{pad(index + 1)}</span>
                </span>
                <h3 className="mt-3 text-[1.25rem] leading-snug font-bold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 text-[0.94rem] leading-relaxed text-lp-body">{step.description}</p>
                <div className="mt-auto pt-5">
                  <p className="flex flex-col items-start gap-2 border-t border-dashed border-lp-line-strong pt-4">
                    <span className="text-[0.68rem] font-semibold tracking-[0.14em] text-lp-muted uppercase">
                      Output:
                    </span>
                    <span className={cn('lp-chip max-w-full', styles.output)}>
                      <Icon name="check" className="size-3.5 text-lp-violet" strokeWidth={2.4} />
                      <span className="font-semibold text-lp-ink-2">{step.output}</span>
                    </span>
                  </p>
                </div>
              </Tilt>

              <span aria-hidden className={styles.station}>
                <span className={styles.halo} />
                <span className={styles.ring}>
                  <span className={styles.ringBoost}>
                    <span className={styles.ringSpin}>
                      <svg viewBox="0 0 64 64" focusable="false">
                        <circle
                          cx="32"
                          cy="32"
                          r="30.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeDasharray="2.5 5.5"
                        />
                        <circle className={styles.satellite} cx="32" cy="1.5" r="2.75" />
                      </svg>
                    </span>
                  </span>
                </span>
                <span className={styles.disc}>
                  <span className={styles.flip}>
                    <Icon name={step.icon} className="size-full" />
                  </span>
                </span>
                <span data-motion="packet" className={styles.pulse} />
                <span className={styles.burst} />
              </span>
            </li>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
