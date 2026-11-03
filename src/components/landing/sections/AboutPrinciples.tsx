import { Icon, type IconName } from '@/components/landing/primitives/Icon';
import { Tilt } from '@/components/landing/primitives/Tilt';
import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import { about } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './AboutPrinciples.module.css';

/** One glyph per principle, in data order; any principle added later gets sparkles. */
const PRINCIPLE_ICONS: IconName[] = ['gauge', 'shield', 'box', 'search', 'pen-tool', 'git-branch'];

/**
 * The working principles, as numbered cards under the About intro. The
 * section's heading is the <h2>, this block's title an <h3>, so each
 * principle is an <h4>.
 */
export function AboutPrinciples() {
  return (
    <div className="mt-20 md:mt-24 lg:mt-28">
      <Reveal className="flex items-center gap-4 sm:gap-6">
        <h3 className="shrink-0 text-[1.55rem] leading-tight font-extrabold tracking-[-0.035em] md:text-[1.875rem]">
          {about.principlesTitle}
        </h3>
        <span
          aria-hidden
          className="h-px min-w-6 flex-1 bg-gradient-to-r from-lp-lilac via-lp-line-strong to-transparent"
        />
        <Icon name="spark" className="size-3.5 shrink-0 text-lp-violet animate-lp-spin-slow" />
      </Reveal>

      {/* The <li> is what reveals; the Tilt inside it owns the hover transform. */}
      <RevealGroup as="ol" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {about.principles.map((principle, index) => {
          const number = String(index + 1).padStart(2, '0');
          return (
            <li key={principle.title} className="flex">
              <Tilt max={6} lift={6} className="flex w-full">
                <div className={cn('lp-card lp-spotlight w-full', styles.card)}>
                  <div className="flex items-start justify-between gap-4">
                    <span aria-hidden className={styles.number}>
                      <span className={styles.numberBase}>{number}</span>
                      <span className={styles.numberFill}>{number}</span>
                    </span>
                    <span aria-hidden className={styles.icon}>
                      <Icon name={PRINCIPLE_ICONS[index] ?? 'sparkles'} className="relative size-[1.15rem]" />
                    </span>
                  </div>
                  <h4 className="lp-h3 mt-7">{principle.title}</h4>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-lp-body">{principle.body}</p>
                  <span aria-hidden className={styles.bar} />
                </div>
              </Tilt>
            </li>
          );
        })}
      </RevealGroup>
    </div>
  );
}
