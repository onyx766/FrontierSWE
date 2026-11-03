import Link from 'next/link';
import { Icon } from '@/components/landing/primitives/Icon';
import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import { quickTasks } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './ServiceQuickTasks.module.css';

/** "1 — 3 days" → "1–3 days": a range dash reads tighter inside a small badge. */
function compactRange(text: string): string {
  return text.replace(/\s*—\s*/g, '–');
}

/**
 * Fixed-scope small tasks, under the service cards. Deliberately visible: the
 * FAQ points back to it ("the small tasks section above"), and a founder with
 * one broken endpoint should see straight away that it's work I take.
 */
export function ServiceQuickTasks({ className }: { className?: string }) {
  return (
    <Reveal className={className}>
      <section
        id="small-tasks"
        aria-labelledby="small-tasks-title"
        className={cn(
          'relative isolate scroll-mt-24 rounded-[1.5rem] border border-lp-line p-5 shadow-lp-sm sm:p-7',
          styles.panel,
        )}
      >
        <div aria-hidden className={styles.decor}>
          <div className={styles.glow} />
          <div className={styles.dots} />
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <span aria-hidden className={styles.badge}>
            <span className={styles.badgeRing} />
            <Icon name="bolt" className="relative size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="small-tasks-title"
              className="text-[1.25rem] leading-tight font-extrabold tracking-[-0.03em]"
            >
              {quickTasks.title}
            </h3>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-lp-body">{quickTasks.description}</p>
          </div>
          <Link
            href={quickTasks.more.href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 self-start pb-0.5 text-sm font-semibold text-lp-violet-700 sm:self-center',
              styles.more,
            )}
          >
            {quickTasks.more.label}
            <Icon name="arrow-right" className={cn('size-4', styles.moreArrow)} strokeWidth={2.25} />
          </Link>
        </div>

        <RevealGroup as="ul" className="mt-6 grid gap-2.5 border-t border-lp-line pt-6 xl:grid-cols-2">
          {quickTasks.items.map((task) => (
            <li key={task.title}>
              <div className={styles.chip}>
                <Icon name="check" className={styles.check} strokeWidth={2.25} />
                <span className="min-w-0">{task.title}</span>
                <span className={styles.time}>
                  <Icon name="clock" className="size-3" strokeWidth={2} />
                  {compactRange(task.turnaround)}
                </span>
              </div>
            </li>
          ))}
        </RevealGroup>
      </section>
    </Reveal>
  );
}
