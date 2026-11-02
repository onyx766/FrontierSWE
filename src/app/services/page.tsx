import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Reveal, RevealGroup, RevealItem } from '@/components/primitives/Reveal';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { CTABand } from '@/components/sections/CTABand';
import { domains } from '@/data/domains';
import { engagementModels, serviceFaqs, services, smallTasks } from '@/data/services';
import { buildMetadata, serviceSchema } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Services',
  description:
    'AI/LLM engineering, backend and API development, SaaS builds, AI agents, RAG systems, database architecture, realtime systems, performance work, debugging and deployment — large projects and small one-off tasks.',
  path: '/services',
  keywords: ['hire AI engineer', 'freelance backend engineer', 'FastAPI contractor', 'RAG development'],
});

export default function ServicesPage() {
  const schema = serviceSchema(services);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <section className="site-container pt-10 pb-10 md:pt-16">
        <Reveal>
          <MonoLabel as="p">Services</MonoLabel>
        </Reveal>
        <Reveal delay={0.04}>
          <h1 className="text-display-sm mt-6 max-w-3xl">What you can hire me for</h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-body md:text-lg">
            Twelve kinds of engagement, from a full production AI system down to a single broken
            endpoint. Scope is written down before building starts, including what is excluded.
          </p>
        </Reveal>
      </section>

      {/* ── Main services ──────────────────────────────────────────────────── */}
      <section className="site-container pb-16 md:pb-24">
        <SectionHeader
          kicker="Engineering services"
          aside={
            <MonoLabel size="sm" tone="faint">
              {services.length} offerings
            </MonoLabel>
          }
        />

        <RevealGroup as="ul" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <RevealItem
              as="li"
              key={service.id}
              className="flex scroll-mt-24 flex-col bg-void p-6 md:p-7"
            >
              <div id={service.id} className="flex items-start justify-between gap-4">
                <h2 className="text-lg leading-tight font-medium tracking-tight text-primary">
                  {service.title}
                </h2>
                <Link
                  href={`/system/${service.domain}`}
                  className="label-mono-sm shrink-0 pt-1 text-faint transition-colors hover:text-accent"
                >
                  {domains[service.domain].label}
                </Link>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-body">{service.summary}</p>

              <ul className="mt-5 space-y-2.5 border-t border-line-faint pt-4">
                {service.deliverables.map((deliverable) => (
                  <li key={deliverable} className="flex gap-3">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 bg-accent" />
                    <span className="text-xs leading-relaxed text-muted">{deliverable}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                <MonoLabel size="sm" tone="faint">
                  Typical {service.typicalScope}
                </MonoLabel>
                <Link
                  href="/start-project"
                  className="label-mono-sm text-muted transition-colors hover:text-accent"
                >
                  Enquire →
                </Link>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ── Small tasks: deliberately prominent ────────────────────────────── */}
      <section id="small-tasks" className="site-container scroll-mt-24 pb-16 md:pb-24">
        <div className="relative border border-accent/25 bg-accent/[0.035] p-6 md:p-10">
          <span aria-hidden className="absolute top-0 left-0 h-px w-20 bg-accent" />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14">
            <div>
              <MonoLabel as="p" tone="accent">
                Small engineering tasks
              </MonoLabel>
              <h2 className="text-display-sm mt-6">No project is too small</h2>
              <p className="mt-5 text-base leading-relaxed text-body">
                You do not need a large budget or a long engagement. A single broken endpoint, one
                integration, one slow query — these are normal, welcome pieces of work, scoped and
                quoted in a day.
              </p>
              <ActionLink href="/start-project" variant="primary" className="mt-8">
                Send a small task
              </ActionLink>
            </div>

            <ul className="divide-y divide-line">
              {smallTasks.map((task) => (
                <li key={task.title} className="flex flex-wrap gap-x-6 gap-y-2 py-4 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-medium text-primary">{task.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-body">{task.description}</p>
                  </div>
                  <MonoLabel size="sm" tone="accent" className="shrink-0 pt-1">
                    {task.turnaround}
                  </MonoLabel>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Engagement models ──────────────────────────────────────────────── */}
      <section id="engagement" className="site-container scroll-mt-24 pb-16 md:pb-24">
        <SectionHeader
          kicker="Engagement models"
          title="Four ways to work together"
          description="Pick the shape that matches the problem. If you are not sure, describe the problem and the right shape usually becomes obvious."
        />
        <RevealGroup as="ul" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
          {engagementModels.map((model) => (
            <RevealItem as="li" key={model.title} className="bg-void p-6">
              <h3 className="text-base font-medium text-primary">{model.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{model.description}</p>
              <div className="mt-5 border-t border-line-faint pt-4">
                <MonoLabel size="sm" tone="faint" className="block">
                  Best for
                </MonoLabel>
                <p className="mt-2 text-xs leading-relaxed text-muted">{model.bestFor}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="site-container pb-16 md:pb-24">
        <SectionHeader kicker="Before you get in touch" title="Common questions" />
        <dl className="mt-10 grid gap-px bg-line md:grid-cols-2">
          {serviceFaqs.map((faq) => (
            <div key={faq.question} className="bg-void p-6 md:p-7">
              <dt className="text-base font-medium text-primary">{faq.question}</dt>
              <dd className="mt-3 text-sm leading-relaxed text-body">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CTABand
        title="Tell me what is broken, or what you want built"
        description="The form asks what you need, your current stack, budget range and timeline — enough to come back with a concrete scope."
        secondary={{ label: 'See case studies', href: '/projects' }}
      />
    </>
  );
}
