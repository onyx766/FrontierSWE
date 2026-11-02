import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Chip } from '@/components/primitives/Chip';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Panel } from '@/components/primitives/Panel';
import { Reveal, RevealGroup, RevealItem } from '@/components/primitives/Reveal';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { CTABand } from '@/components/sections/CTABand';
import { ProjectCard } from '@/components/sections/ProjectCard';
import { DomainArchitecture } from '@/components/system/DomainArchitecture';
import { domainList, domains, isDomainId } from '@/data/domains';
import { projects } from '@/data/projects';
import { services } from '@/data/services';
import { DOMAIN_IDS } from '@/lib/types';
import { buildMetadata } from '@/lib/seo';

interface PageProps {
  params: Promise<{ domain: string }>;
}

export function generateStaticParams() {
  return DOMAIN_IDS.map((domain) => ({ domain }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { domain: id } = await params;
  if (!isDomainId(id)) return {};
  const domain = domains[id];

  return buildMetadata({
    title: domain.title,
    description: `${domain.tagline} ${domain.summary.slice(0, 120)}`,
    path: `/system/${id}`,
    keywords: domain.stack,
  });
}

export default async function DomainPage({ params }: PageProps) {
  const { domain: id } = await params;
  if (!isDomainId(id)) notFound();

  const domain = domains[id];
  const related = projects.filter((project) => project.domains.includes(id));
  const relatedServices = services.filter((service) => service.domain === id);

  const index = domainList.findIndex((item) => item.id === id);
  const previous = domainList[(index - 1 + domainList.length) % domainList.length];
  const next = domainList[(index + 1) % domainList.length];

  return (
    <>
      <section className="site-container pt-10 pb-12 md:pt-16">
        <Reveal>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2.5">
            <Link href="/#topology" className="label-mono transition-colors hover:text-accent">
              Network
            </Link>
            <span aria-hidden className="text-faint">
              /
            </span>
            <MonoLabel tone="accent">{domain.id}</MonoLabel>
          </nav>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Reveal delay={0.04}>
              <h1 className="text-display-sm">{domain.title}</h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-primary md:text-xl">
                {domain.tagline}
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-body">
                {domain.summary}
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.16}>
            <Panel className="p-5">
              <MonoLabel as="p">Stack</MonoLabel>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {domain.stack.map((item) => (
                  <li key={item}>
                    <Chip size="sm">{item}</Chip>
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-2.5 border-t border-line-faint pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Capabilities</dt>
                  <dd className="font-mono text-xs text-body tabular-nums">
                    {domain.capabilities.length}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Case studies</dt>
                  <dd className="font-mono text-xs text-body tabular-nums">{related.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Services</dt>
                  <dd className="font-mono text-xs text-body tabular-nums">
                    {relatedServices.length}
                  </dd>
                </div>
              </dl>
            </Panel>
          </Reveal>
        </div>
      </section>

      <section className="site-container pb-16">
        <Reveal>
          <DomainArchitecture domain={domain} className="border border-line bg-panel/50" />
        </Reveal>
      </section>

      <section className="site-container pb-16 md:pb-24">
        <SectionHeader kicker="Capabilities" title="What this covers" />
        <RevealGroup as="ul" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {domain.capabilities.map((capability) => (
            <RevealItem as="li" key={capability.title} className="bg-void p-6 md:p-7">
              <h3 className="text-base font-medium text-primary">{capability.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{capability.description}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {related.length > 0 ? (
        <section className="site-container pb-16 md:pb-24">
          <SectionHeader
            kicker="Case studies in this area"
            aside={
              <Link href="/projects" className="label-mono transition-colors hover:text-accent">
                All projects →
              </Link>
            }
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.map((project, projectIndex) => (
              <Reveal key={project.slug} delay={projectIndex * 0.05} className="flex">
                <ProjectCard project={project} className="w-full" />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {relatedServices.length > 0 ? (
        <section className="site-container pb-16 md:pb-24">
          <SectionHeader kicker="Hire for this" />
          <ul className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {relatedServices.map((service) => (
              <li key={service.id}>
                <Link
                  href={`/services#${service.id}`}
                  className="group flex h-full flex-col border border-line bg-panel p-6 transition-colors hover:border-line-strong"
                >
                  <h3 className="text-base font-medium text-primary transition-colors group-hover:text-accent">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-body">{service.summary}</p>
                  <MonoLabel size="sm" className="mt-auto pt-6">
                    {service.typicalScope}
                  </MonoLabel>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="site-container pb-8">
        <nav
          aria-label="Adjacent network nodes"
          className="grid gap-px border border-line bg-line sm:grid-cols-2"
        >
          <Link href={`/system/${previous!.id}`} className="group bg-void p-6 transition-colors hover:bg-panel">
            <MonoLabel size="sm" tone="faint">
              ← Previous node
            </MonoLabel>
            <p className="mt-3 text-base text-primary transition-colors group-hover:text-accent">
              {previous!.title}
            </p>
          </Link>
          <Link
            href={`/system/${next!.id}`}
            className="group bg-void p-6 text-right transition-colors hover:bg-panel"
          >
            <MonoLabel size="sm" tone="faint">
              Next node →
            </MonoLabel>
            <p className="mt-3 text-base text-primary transition-colors group-hover:text-accent">
              {next!.title}
            </p>
          </Link>
        </nav>
      </section>

      <CTABand
        title={`Need ${domain.title.toLowerCase()} work?`}
        description={domain.tagline}
        secondary={{ label: 'Back to network', href: '/#topology' }}
      />
    </>
  );
}
