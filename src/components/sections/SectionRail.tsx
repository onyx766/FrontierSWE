'use client';

import { useEffect, useState } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { cn } from '@/lib/utils';

interface SectionRailProps {
  sections: readonly { id: string; label: string }[];
  className?: string;
}

/**
 * Sticky case-study navigation with scroll tracking.
 *
 * Uses one IntersectionObserver over the section headings rather than a scroll
 * listener, so there is no work per scroll event. Links are real anchors, so
 * the rail is useful with JavaScript disabled — only the active highlight
 * depends on it.
 */
export function SectionRail({ sections, className }: SectionRailProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Case study sections" className={className}>
      <MonoLabel size="sm" tone="faint" className="block">
        Contents
      </MonoLabel>
      <ol className="mt-4 space-y-px">
        {sections.map((section, index) => {
          const active = activeId === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex items-baseline gap-3 border-l py-1.5 pl-3 transition-colors',
                  active
                    ? 'border-accent text-accent'
                    : 'border-line text-muted hover:border-line-strong hover:text-body',
                )}
              >
                <span className="font-mono text-[0.5625rem] tabular-nums opacity-60">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-[0.625rem] tracking-[0.12em] uppercase">
                  {section.label}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
