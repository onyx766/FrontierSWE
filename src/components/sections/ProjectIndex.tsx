'use client';

import { useMemo, useState } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { ProjectCard } from '@/components/sections/ProjectCard';
import { domainList } from '@/data/domains';
import { cn } from '@/lib/utils';
import type { DomainId, Project } from '@/lib/types';

/**
 * Project index with a domain filter.
 *
 * The filter uses the same six-domain taxonomy as the homepage topology, so a
 * visitor who clicked the AI SYSTEMS node and a visitor who filtered by it see
 * a consistent world. Filtering is client-side over an already-rendered list:
 * every card is in the server HTML, so the page is fully indexable and works
 * without JavaScript (unfiltered).
 */
export function ProjectIndex({ projects }: { projects: Project[] }) {
  const [active, setActive] = useState<DomainId | 'all'>('all');

  const counts = useMemo(() => {
    const result = new Map<DomainId | 'all', number>([['all', projects.length]]);
    for (const domain of domainList) {
      result.set(
        domain.id,
        projects.filter((project) => project.domains.includes(domain.id)).length,
      );
    }
    return result;
  }, [projects]);

  const visible = useMemo(
    () =>
      active === 'all'
        ? projects
        : projects.filter((project) => project.domains.includes(active)),
    [active, projects],
  );

  const filters: { id: DomainId | 'all'; label: string }[] = [
    { id: 'all', label: 'All systems' },
    ...domainList.map((domain) => ({ id: domain.id, label: domain.title })),
  ];

  return (
    <div>
      <div className="hairline-top relative flex flex-wrap items-center justify-between gap-4 pt-5">
        <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-accent" />
        <div
          role="group"
          aria-label="Filter projects by engineering area"
          className="flex flex-wrap gap-1.5"
        >
          {filters.map((filter) => {
            const selected = active === filter.id;
            const count = counts.get(filter.id) ?? 0;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActive(filter.id)}
                aria-pressed={selected}
                disabled={count === 0}
                className={cn(
                  'flex items-center gap-2 border px-3 py-2 font-mono text-[0.625rem] tracking-[0.14em] uppercase transition-colors',
                  selected
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-line text-muted hover:border-line-strong hover:text-body',
                  count === 0 && 'cursor-not-allowed opacity-35 hover:border-line hover:text-muted',
                )}
              >
                {filter.label}
                <span className="text-[0.5625rem] tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <MonoLabel size="sm" tone="faint">
          {visible.length} of {projects.length} shown
        </MonoLabel>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 border border-line bg-panel p-8 text-sm text-muted">
          No case studies in this area yet.
        </p>
      ) : null}
    </div>
  );
}
