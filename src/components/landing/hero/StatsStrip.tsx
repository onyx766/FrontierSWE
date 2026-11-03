import { RevealGroup } from '@/components/primitives/Reveal';
import { CountUp } from '@/components/landing/primitives/CountUp';
import { Icon } from '@/components/landing/primitives/Icon';
import { heroStats, type HeroStat } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './StatsStrip.module.css';

function StatValue({ stat }: { stat: HeroStat }) {
  if ('count' in stat.value) {
    return <CountUp value={stat.value.count} suffix={stat.value.suffix ?? ''} />;
  }
  return <>{stat.value.text}</>;
}

/** The at-a-glance strip under the hero: five facts in one white card. */
export function StatsStrip() {
  return (
    <section aria-label="At a glance" className="relative z-10 pb-4">
      <div className="lp-container">
        <RevealGroup
          as="ul"
          role="list"
          className={cn(
            styles.strip,
            'lp-card grid grid-cols-2 gap-1 p-2 md:grid-cols-3 lg:grid-cols-[0.85fr_0.95fr_1fr_1fr_1.3fr] lg:gap-0 lg:p-2.5',
          )}
        >
          {heroStats.map((stat) => (
            <li
              key={stat.label}
              className={cn(
                styles.cell,
                'group relative flex items-center gap-3.5 rounded-[0.9rem] px-4 py-4 last:col-span-2 md:last:col-span-2 lg:last:col-span-1 lg:px-5',
              )}
            >
              {stat.icon === 'status' ? (
                <span aria-hidden className={cn(styles.badge, 'border-emerald-200/70 bg-emerald-50')}>
                  <span className="relative inline-flex size-2.5">
                    <span className="absolute inset-0 rounded-full bg-lp-green animate-lp-pulse-ring" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-lp-green" />
                  </span>
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    styles.badge,
                    stat.accent
                      ? 'border-lp-lilac/60 bg-lp-tint text-lp-violet-600'
                      : 'border-lp-line bg-white text-lp-ink-2',
                  )}
                >
                  <Icon name={stat.icon} className={cn(styles.icon, 'size-[1.2rem]')} />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-[1.2rem] leading-tight font-bold tracking-[-0.02em] text-lp-ink transition-colors duration-300 group-hover:text-lp-violet-700">
                  <StatValue stat={stat} />
                </span>
                <span className="mt-1 block text-[0.8rem] leading-snug text-lp-muted">{stat.label}</span>
              </span>
            </li>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
