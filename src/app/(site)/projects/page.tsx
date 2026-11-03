import type { Metadata } from 'next';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Reveal } from '@/components/primitives/Reveal';
import { CTABand } from '@/components/sections/CTABand';
import { ProjectIndex } from '@/components/sections/ProjectIndex';
import { projects } from '@/data/projects';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Projects',
  description:
    'Engineering case studies: AI agent runtimes, RAG systems, multi-tenant SaaS foundations, realtime gateways and PostgreSQL performance work. Problem, architecture, challenges and decisions for each.',
  path: '/projects',
  keywords: ['engineering case studies', 'AI system architecture', 'backend portfolio'],
});

export default function ProjectsPage() {
  const placeholderCount = projects.filter((project) => project.placeholder).length;

  return (
    <>
      <section className="site-container pt-10 pb-10 md:pt-16">
        <Reveal>
          <MonoLabel as="p">Case studies</MonoLabel>
        </Reveal>
        <Reveal delay={0.04}>
          <h1 className="text-display-sm mt-6 max-w-3xl">
            Systems, not screenshots
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-body md:text-lg">
            Each case study covers the problem, the requirements, the architecture, the technical
            challenges that actually came up, and the engineering decisions behind them — including
            what each one traded away. Every project page has an interactive architecture diagram
            you can trace a request through.
          </p>
        </Reveal>
      </section>

      <section className="site-container pb-16 md:pb-24">
        <ProjectIndex projects={projects} />

        {placeholderCount > 0 ? (
          <p className="mt-8 max-w-2xl border border-warn/25 bg-warn/5 p-5 text-xs leading-relaxed text-body">
            <MonoLabel size="sm" tone="warn" className="mb-2 block">
              Placeholder content
            </MonoLabel>
            {placeholderCount} of {projects.length} case studies are placeholders: the engineering
            substance is real in kind, but no employer, client, user count or revenue figure has
            been invented. Replace them in{' '}
            <code className="font-mono text-muted">src/data/projects.ts</code> and set{' '}
            <code className="font-mono text-muted">placeholder: false</code>.
          </p>
        ) : null}
      </section>

      <CTABand
        title="Want something like this built?"
        description="Start with what you need and your current stack — the reply will be a concrete scope, not a calendar link."
      />
    </>
  );
}
