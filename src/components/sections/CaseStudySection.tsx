import type { ReactNode } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Reveal } from '@/components/primitives/Reveal';
import { cn } from '@/lib/utils';

interface CaseStudySectionProps {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * One numbered section of a case study. The numbering is part of the visual
 * language: a case study reads as a document with a structure, which is what
 * makes it credible to an engineer and skimmable for a founder.
 */
export function CaseStudySection({
  id,
  index,
  title,
  children,
  className,
}: CaseStudySectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-24 border-t border-line pt-8', className)}>
      <div className="flex items-baseline gap-4">
        <MonoLabel size="sm" tone="faint" className="tabular-nums">
          {String(index).padStart(2, '0')}
        </MonoLabel>
        <h2 className="text-xl font-medium tracking-tight text-primary md:text-2xl">{title}</h2>
      </div>
      <Reveal className="mt-6">{children}</Reveal>
    </section>
  );
}

/** Body copy inside a case-study section. Constrained measure for readability. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-3xl text-base leading-relaxed text-body', className)}>{children}</p>
  );
}

/** Dense, hairline-separated list used for requirements and implementation. */
export function TickList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('max-w-3xl divide-y divide-line-faint border-y border-line-faint', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-4 py-3.5">
          <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 bg-accent" />
          <span className="text-sm leading-relaxed text-body">{item}</span>
        </li>
      ))}
    </ul>
  );
}
