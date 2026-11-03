import type { CSSProperties } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { TechIcon } from '@/components/landing/primitives/TechIcon';
import { marqueeRows } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './TechMarquee.module.css';

/** Seconds per loop, per row: slow enough to read, and unequal so the rows never fall into step. */
const ROW_SECONDS = [62, 70];

const ROW_LABELS = ['Technologies', 'More technologies'];

type MarqueeItem = (typeof marqueeRows)[number][number];

function Pill({ item }: { item: MarqueeItem }) {
  return (
    <li className={styles.pill}>
      <span className={styles.glyph}>
        <TechIcon name={item.icon} className="size-5" />
      </span>
      {item.name}
    </li>
  );
}

/**
 * A band under the stats strip: the stack as two rows of pills drifting in
 * opposite directions. Hovering a row holds it still; the round control
 * pauses both. Under reduced motion it is one still, centred set of pills.
 */
export function TechMarquee() {
  return (
    <section id="stack" aria-labelledby="stack-title" className={styles.section}>
      <div className="lp-container">
        <div className={styles.head}>
          <span aria-hidden className={styles.rule} />
          <div className={styles.headCenter}>
            <h2 id="stack-title" className={styles.title}>
              Technologies I ship with
            </h2>
            <label className={styles.toggle}>
              <input type="checkbox" className={cn('sr-only', styles.toggleInput)} />
              <span aria-hidden className={styles.toggleIcon}>
                <Icon name="pause" className={cn('size-3.5', styles.iconPause)} strokeWidth={2.4} />
                <Icon name="play" className={cn('size-3.5', styles.iconPlay)} strokeWidth={2.2} />
              </span>
              <span className="sr-only">Pause the scrolling technology list</span>
            </label>
          </div>
          <span aria-hidden className={cn(styles.rule, styles.ruleEnd)} />
        </div>

        <div className={styles.rows}>
          {marqueeRows.map((row, rowIndex) => (
            <div
              key={ROW_LABELS[rowIndex] ?? rowIndex}
              className={styles.row}
              data-reverse={rowIndex % 2 === 1 ? '' : undefined}
              style={{ '--marquee-duration': `${ROW_SECONDS[rowIndex] ?? 66}s` } as CSSProperties}
            >
              <div className={styles.track}>
                <ul aria-label={ROW_LABELS[rowIndex] ?? 'Technologies'} className={styles.list}>
                  {row.map((item) => (
                    <Pill key={item.name} item={item} />
                  ))}
                </ul>
                {/* The second copy that closes the loop; screen readers skip it. */}
                <ul aria-hidden className={cn(styles.list, styles.copy)}>
                  {row.map((item) => (
                    <Pill key={item.name} item={item} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
