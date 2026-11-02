import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ActionLink } from '@/components/primitives/Button';
import { Chip, PlaceholderChip } from '@/components/primitives/Chip';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Panel } from '@/components/primitives/Panel';
import { Reveal } from '@/components/primitives/Reveal';
import { StatusDot } from '@/components/primitives/StatusDot';
import { CTABand } from '@/components/sections/CTABand';
import {
  CaseStudySection,
  Prose,
  TickList,
} from '@/components/sections/CaseStudySection';
import { SectionRail } from '@/components/sections/SectionRail';
import { ArchitectureDiagram } from '@/components/system/ArchitectureDiagram';
import { domains } from '@/data/domains';
import { caseStudySections, getProject, projects, statusLabels } from '@/data/projects';
import { buildMetadata, projectSchema } from '@/lib/seo';
import { SITE_URL } from '@/data/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};

  return buildMetadata({
    title: project.name,
    description: project.summary,
    path: `/projects/${project.slug}`,
    image: `${SITE_URL}/projects/${project.slug}/opengraph-image`,
    type: 'article',
    keywords: project.technologies,
  });
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const study = project.caseStudy;
  const index = projects.findIndex((item) => item.slug === project.slug);
  const next = projects[(index + 1) % projects.length];

  const schema = projectSchema({
    name: project.name,
    description: project.summary,
    slug: project.slug,
    technologies: project.technologies,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="site-container pt-10 pb-12 md:pt-16">
        <Reveal>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2.5">
            <Link href="/projects" className="label-mono transition-colors hover:text-accent">
              Projects
            </Link>
            <span aria-hidden className="text-faint">
              /
            </span>
            <MonoLabel tone="accent">{project.slug}</MonoLabel>
          </nav>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Reveal delay={0.04}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  <StatusDot state={project.status === 'archived' ? 'warn' : 'ok'} />
                  <MonoLabel size="sm">{statusLabels[project.status]}</MonoLabel>
                </span>
                <span aria-hidden className="text-faint">
                  ·
                </span>
                <MonoLabel size="sm" tone="faint">
                  {project.period}
                </MonoLabel>
                {project.placeholder ? <PlaceholderChip /> : null}
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="text-display-sm mt-6">{project.name}</h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-primary">
                {project.summary}
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-body">{project.intro}</p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap gap-3">
                {project.links.github ? (
                  <ActionLink href={project.links.github} external variant="secondary">
                    View on GitHub
                  </ActionLink>
                ) : null}
                {project.links.live ? (
                  <ActionLink href={project.links.live} external variant="secondary">
                    Live demo
                  </ActionLink>
                ) : null}
                <ActionLink href="/start-project" variant="primary">
                  Build something like this
                </ActionLink>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.18}>
            <Panel className="p-5">
              <dl className="space-y-4">
                <div>
                  <dt className="label-mono-sm text-faint">Role</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-body">{project.role}</dd>
                </div>
                <div className="border-t border-line-faint pt-4">
                  <dt className="label-mono-sm text-faint">Engineering areas</dt>
                  <dd className="mt-2.5 flex flex-wrap gap-1.5">
                    {project.domains.map((id) => (
                      <Link key={id} href={`/system/${id}`}>
                        <Chip size="sm" tone="outline" className="hover:border-accent/40 hover:text-accent">
                          {domains[id].title}
                        </Chip>
                      </Link>
                    ))}
                  </dd>
                </div>
                <div className="border-t border-line-faint pt-4">
                  <dt className="label-mono-sm text-faint">Metrics</dt>
                  <dd className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    {study.metrics.map((metric) => (
                      <div key={metric.label}>
                        <p className="font-sans text-lg leading-none font-medium text-primary tabular-nums">
                          {metric.value}
                        </p>
                        <p className="label-mono-sm mt-1.5 text-faint">{metric.label}</p>
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ── Interactive architecture ───────────────────────────────────────── */}
      <section className="site-container pb-16">
        <Reveal>
          <ArchitectureDiagram
            spec={project.architecture}
            label={`${project.name} — architecture`}
          />
        </Reveal>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-faint">
          Trace a request through the system: each node lights as it is reached and the latency
          readout accumulates. Figures are illustrative of the shape of the work, not measured
          production numbers.
        </p>
      </section>

      {/* ── Case study ─────────────────────────────────────────────────────── */}
      <div className="site-container pb-16 md:pb-24">
        <div className="grid gap-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
          <div className="hidden lg:block">
            <SectionRail sections={caseStudySections} className="sticky top-28" />
          </div>

          <div className="space-y-14">
            <CaseStudySection id="problem" index={1} title="Problem">
              <Prose>{study.problem}</Prose>
            </CaseStudySection>

            <CaseStudySection id="requirements" index={2} title="Requirements">
              <TickList items={study.requirements} />
            </CaseStudySection>

            <CaseStudySection id="role" index={3} title="My role">
              <Prose>{study.role}</Prose>
            </CaseStudySection>

            <CaseStudySection id="architecture" index={4} title="Architecture">
              <Prose>{study.architecture}</Prose>
            </CaseStudySection>

            <CaseStudySection id="challenges" index={5} title="Technical challenges">
              <ul className="grid gap-px bg-line md:grid-cols-2">
                {study.challenges.map((challenge) => (
                  <li key={challenge.title} className="bg-void p-6">
                    <h3 className="text-base font-medium text-primary">{challenge.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-body">{challenge.body}</p>
                  </li>
                ))}
              </ul>
            </CaseStudySection>

            <CaseStudySection id="decisions" index={6} title="Engineering decisions">
              <ul className="space-y-px bg-line">
                {study.decisions.map((decision) => (
                  <li key={decision.decision} className="bg-void p-6">
                    <h3 className="text-base font-medium text-primary">{decision.decision}</h3>
                    <dl className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <dt className="label-mono-sm text-accent">Why</dt>
                        <dd className="mt-2 text-sm leading-relaxed text-body">
                          {decision.rationale}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-mono-sm text-warn">Trade-off</dt>
                        <dd className="mt-2 text-sm leading-relaxed text-body">
                          {decision.tradeoff}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </CaseStudySection>

            <CaseStudySection id="implementation" index={7} title="Implementation">
              <TickList items={study.implementation} />
            </CaseStudySection>

            <CaseStudySection id="technologies" index={8} title="Technologies">
              <ul className="flex flex-wrap gap-1.5">
                {project.technologies.map((tech) => (
                  <li key={tech}>
                    <Chip>{tech}</Chip>
                  </li>
                ))}
              </ul>
            </CaseStudySection>

            <CaseStudySection
              id="performance"
              index={9}
              title="Performance & scalability considerations"
            >
              <TickList items={study.performance} />
            </CaseStudySection>

            <CaseStudySection id="result" index={10} title="Result">
              <Prose>{study.result}</Prose>
              <dl className="mt-8 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
                {study.metrics.map((metric) => (
                  <div key={metric.label} className="bg-void p-5">
                    <dd className="font-sans text-2xl leading-none font-medium text-primary tabular-nums">
                      {metric.value}
                    </dd>
                    <dt className="label-mono-sm mt-3 text-faint">{metric.label}</dt>
                    {metric.placeholder ? (
                      <PlaceholderChip className="mt-3" />
                    ) : null}
                  </div>
                ))}
              </dl>
            </CaseStudySection>

            <CaseStudySection id="demo" index={11} title="Screenshots & demo">
              <ul className="grid gap-5 md:grid-cols-2">
                {study.media.map((item) => (
                  <li key={item.label} className="border border-line bg-panel">
                    <div className="flex aspect-16/10 items-center justify-center border-b border-line bg-void/60">
                      <div className="text-center">
                        <MonoLabel size="sm" tone="faint" className="block">
                          No media yet
                        </MonoLabel>
                        <p className="mt-2 px-6 font-mono text-[0.625rem] tracking-[0.12em] text-muted uppercase">
                          {item.label}
                        </p>
                      </div>
                    </div>
                    <p className="p-4 text-sm leading-relaxed text-body">{item.caption}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs leading-relaxed text-faint">
                Add real screenshots to <code className="font-mono text-muted">/public</code> and
                reference them from{' '}
                <code className="font-mono text-muted">caseStudy.media</code> in{' '}
                <code className="font-mono text-muted">src/data/projects.ts</code>.
              </p>
            </CaseStudySection>

            <CaseStudySection id="links" index={12} title="Links">
              {project.links.github || project.links.live ? (
                <div className="flex flex-wrap gap-3">
                  {project.links.github ? (
                    <ActionLink href={project.links.github} external>
                      GitHub repository
                    </ActionLink>
                  ) : null}
                  {project.links.live ? (
                    <ActionLink href={project.links.live} external>
                      Live demo
                    </ActionLink>
                  ) : null}
                </div>
              ) : (
                <div className="border border-line bg-panel p-6">
                  <MonoLabel size="sm" tone="warn" className="block">
                    No links configured
                  </MonoLabel>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-body">
                    Add a repository or live URL to this project&rsquo;s{' '}
                    <code className="font-mono text-muted">links</code> object in{' '}
                    <code className="font-mono text-muted">src/data/projects.ts</code> and the
                    buttons appear here and on the project card.
                  </p>
                </div>
              )}
            </CaseStudySection>
          </div>
        </div>
      </div>

      <section className="site-container pb-8">
        <Link
          href={`/projects/${next!.slug}`}
          className="group flex flex-wrap items-baseline justify-between gap-4 border border-line bg-void p-6 transition-colors hover:bg-panel"
        >
          <div>
            <MonoLabel size="sm" tone="faint">
              Next case study →
            </MonoLabel>
            <p className="mt-3 text-lg text-primary transition-colors group-hover:text-accent">
              {next!.name}
            </p>
          </div>
          <p className="max-w-sm text-sm text-body">{next!.summary}</p>
        </Link>
      </section>

      <CTABand secondary={{ label: 'All projects', href: '/projects' }} />
    </>
  );
}
