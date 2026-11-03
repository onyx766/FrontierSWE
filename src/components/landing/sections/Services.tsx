import Link from 'next/link';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { SectionHeading, SectionShell } from '@/components/landing/primitives/SectionHeading';
import { Tilt } from '@/components/landing/primitives/Tilt';
import { RevealGroup } from '@/components/primitives/Reveal';
import { landingServices, servicesIntro } from '@/data/landing';
import { cn } from '@/lib/utils';
import { ServiceQuickTasks } from './ServiceQuickTasks';
import { ServicesOrbit } from './ServicesOrbit';
import styles from './Services.module.css';

/*
 * Card grid: one column on phones; from 640px a six-track grid, so cards run
 * in rows of three and a short last row widens to fill (five → three + two);
 * from 1280px one row of five, as in the design.
 */
const SPAN_THIRD = 'sm:col-span-2 xl:col-span-1';
const SPAN_HALF = 'sm:col-span-3 xl:col-span-1';
const SPAN_FULL = 'sm:col-span-6 xl:col-span-1';

function spanFor(index: number, count: number): string {
  const remainder = count % 3;
  if (remainder === 0 || index < count - remainder) return SPAN_THIRD;
  return remainder === 2 ? SPAN_HALF : SPAN_FULL;
}

export function Services() {
  return (
    <SectionShell
      id="services"
      labelledBy="services-title"
      className={styles.section}
      // A narrower heading column than the other sections, as in the design,
      // so the row of five cards gets the width.
      gridClassName="xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] xl:gap-x-12"
      heading={
        <>
          <SectionHeading
            id="services-title"
            title={servicesIntro.title}
            description={servicesIntro.description}
          >
            <LpButton href={servicesIntro.more.href} variant="outline" size="sm">
              {servicesIntro.more.label}
            </LpButton>
          </SectionHeading>
          <ServicesOrbit services={landingServices} className="mt-14 hidden lg:block" />
        </>
      }
    >
      <RevealGroup as="ul" className="grid grid-cols-1 gap-3 sm:grid-cols-6 xl:grid-cols-5">
        {landingServices.map((service, index) => (
          // Each card spans four rows of a shared subgrid, so titles, captions
          // and descriptions line up across a row whatever their length. The
          // <li> carries the reveal transform; <Tilt> owns its own.
          <li
            key={service.id}
            data-svc={index}
            className={cn('row-span-4 grid grid-rows-subgrid gap-y-0', spanFor(index, landingServices.length))}
          >
            <Tilt
              max={8}
              lift={6}
              className={cn(
                'lp-card lp-spotlight lp-gradient-border row-span-4 grid grid-rows-subgrid gap-y-0 p-5 sm:p-4',
                styles.card,
                service.featured && styles.featured,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={styles.iconBox}>
                  <Icon name={service.icon} className={styles.iconGlyph} />
                </span>
                <span aria-hidden className={styles.arrow}>
                  <Icon name="arrow-right" className="size-3.5" strokeWidth={2.25} />
                </span>
              </div>
              <h3 className="mt-4 text-base leading-[1.25] font-bold tracking-[-0.015em] sm:text-[0.9375rem]">
                <Link href={service.href} className={styles.titleLink}>
                  {service.title}
                </Link>
              </h3>
              <p
                className={cn(
                  'mt-1.5 text-[0.8125rem] leading-snug sm:text-[0.78rem]',
                  service.featured ? 'font-medium text-lp-violet-700' : 'text-lp-muted',
                )}
              >
                {service.caption}
              </p>
              <p
                className={cn(
                  'mt-3.5 border-t pt-3.5 text-sm leading-relaxed text-lp-body sm:text-[0.8rem]',
                  service.featured ? 'border-lp-violet/20' : 'border-lp-line',
                )}
              >
                {service.description}
              </p>
            </Tilt>
          </li>
        ))}
      </RevealGroup>

      <ServiceQuickTasks className="mt-5 md:mt-6" />
    </SectionShell>
  );
}
