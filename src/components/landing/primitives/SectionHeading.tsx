import type { ReactNode } from 'react';
import { Reveal } from '@/components/primitives/Reveal';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/** Violet gradient ink for an accent word or phrase inside a heading. */
export function GradientText({
  children,
  italic = false,
  className,
}: {
  children: ReactNode;
  italic?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('lp-text-gradient', italic && 'lp-italic pr-[0.08em]', className)}>
      {children}
    </span>
  );
}

/** Small uppercase label with the spark marker, as above the hero headline. */
export function Eyebrow({
  children,
  tone = 'light',
  className,
}: {
  children: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'lp-eyebrow inline-flex items-center gap-2',
        tone === 'dark' && 'text-lp-lilac',
        className,
      )}
    >
      <Icon name="spark" className="size-3 text-lp-violet animate-lp-spin" />
      {children}
    </p>
  );
}

interface SectionHeadingProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Anything under the description: a link, a button. */
  children?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  /** id for the <h2>, to label the section with aria-labelledby. */
  id?: string;
  className?: string;
}

/**
 * Section opener: optional eyebrow, the <h2>, a short description. Reveals
 * on scroll. Use `tone="dark"` on the night-coloured bands.
 */
export function SectionHeading({
  title,
  eyebrow,
  description,
  children,
  align = 'left',
  tone = 'light',
  id,
  className,
}: SectionHeadingProps) {
  return (
    <Reveal className={cn(align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      {eyebrow ? (
        <Eyebrow tone={tone} className="mb-4">
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2 id={id} className={cn('lp-h2', tone === 'dark' && 'text-white')}>
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-[0.98rem] leading-relaxed',
            tone === 'dark' ? 'text-white/70' : 'text-lp-body',
            align === 'center' ? 'mx-auto max-w-xl' : 'max-w-sm',
          )}
        >
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </Reveal>
  );
}

interface SectionShellProps {
  id: string;
  /** The left-hand column: normally a <SectionHeading>. */
  heading: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classes for the inner two-column grid. */
  gridClassName?: string;
  labelledBy?: string;
}

/**
 * The reference layout used by most sections: heading on the left, content
 * on the right, stacking on small screens.
 */
export function SectionShell({
  id,
  heading,
  children,
  className,
  gridClassName,
  labelledBy,
}: SectionShellProps) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('lp-section', className)}>
      <div
        className={cn(
          'lp-container grid gap-10 lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] lg:gap-14 xl:gap-20',
          gridClassName,
        )}
      >
        <div>{heading}</div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
