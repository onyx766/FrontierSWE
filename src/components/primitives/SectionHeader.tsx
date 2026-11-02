import type { ReactNode } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  /** Mono kicker above the title, e.g. "SELECTED SYSTEMS". */
  kicker: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot — usually a link or a count readout. */
  aside?: ReactNode;
  className?: string;
  /** The 4px accent tick that opens a section. */
  tick?: boolean;
}

export function SectionHeader({
  kicker,
  title,
  description,
  aside,
  className,
  tick = true,
}: SectionHeaderProps) {
  return (
    <div className={cn('relative hairline-top pt-6', className)}>
      {tick ? (
        <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-accent" />
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <MonoLabel tone="muted">{kicker}</MonoLabel>
        {aside ? <div className="flex items-center gap-4">{aside}</div> : null}
      </div>
      {title ? (
        <h2 className="text-display-sm mt-6 max-w-4xl">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-body md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
