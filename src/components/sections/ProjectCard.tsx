import Link from 'next/link';
import { Chip, PlaceholderChip } from '@/components/primitives/Chip';
import { CornerBrackets } from '@/components/primitives/Panel';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { MiniArchitecture } from '@/components/system/MiniArchitecture';
import { domains } from '@/data/domains';
import { statusLabels } from '@/data/projects';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';

const STATUS_TONE: Record<Project['status'], 'ok' | 'warn' | 'available'> = {
  production: 'ok',
  active: 'ok',
  prototype: 'warn',
  archived: 'warn',
};

export function ProjectCard({ project, className }: { project: Project; className?: string }) {
  return (
    <article
      className={cn(
        'group relative flex flex-col border border-line bg-panel transition-colors duration-300 hover:border-line-strong',
        className,
      )}
    >
      <CornerBrackets />

      {/* Architecture preview — the shape of the system, before any words. */}
      <div className="border-b border-line bg-void/40 px-4 py-5">
        <MiniArchitecture spec={project.architecture} className="h-auto w-full" />
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg leading-tight font-medium tracking-tight text-primary transition-colors group-hover:text-accent md:text-xl">
            <Link href={`/projects/${project.slug}`} className="outline-none">
              {/* Full-card hit area, while keeping a single real link. */}
              <span className="absolute inset-0 z-10" aria-hidden />
              {project.name}
            </Link>
          </h3>
          <span className="flex shrink-0 items-center gap-2 pt-1">
            <StatusDot state={STATUS_TONE[project.status]} pulse={project.status !== 'archived'} />
            <MonoLabel size="sm">{statusLabels[project.status]}</MonoLabel>
          </span>
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-body">{project.summary}</p>

        <dl className="mt-5 space-y-2.5 border-t border-line-faint pt-4">
          <div className="flex gap-3">
            <dt className="label-mono-sm w-14 shrink-0 pt-0.5 text-faint">Role</dt>
            <dd className="text-xs leading-relaxed text-muted">{project.role}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="label-mono-sm w-14 shrink-0 pt-0.5 text-faint">Areas</dt>
            <dd className="text-xs leading-relaxed text-muted">
              {project.domains.map((id) => domains[id].title).join(' · ')}
            </dd>
          </div>
        </dl>

        <ul className="mt-5 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 6).map((tech) => (
            <li key={tech}>
              <Chip size="sm">{tech}</Chip>
            </li>
          ))}
          {project.technologies.length > 6 ? (
            <li>
              <Chip size="sm" tone="outline">
                +{project.technologies.length - 6}
              </Chip>
            </li>
          ) : null}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6">
          <span className="label-mono-sm relative z-20 text-muted transition-colors group-hover:text-accent">
            Read case study →
          </span>
          {project.links.github ? (
            <a
              href={project.links.github}
              target="_blank"
              rel="noreferrer noopener"
              className="label-mono-sm relative z-20 text-faint transition-colors hover:text-primary"
            >
              GitHub
            </a>
          ) : null}
          {project.links.live ? (
            <a
              href={project.links.live}
              target="_blank"
              rel="noreferrer noopener"
              className="label-mono-sm relative z-20 text-faint transition-colors hover:text-primary"
            >
              Live demo
            </a>
          ) : null}
          {project.placeholder ? <PlaceholderChip className="relative z-20 ml-auto" /> : null}
        </div>
      </div>
    </article>
  );
}
