import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Panel } from '@/components/primitives/Panel';
import { Reveal, RevealGroup, RevealItem } from '@/components/primitives/Reveal';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { StatusDot } from '@/components/primitives/StatusDot';
import { CTABand } from '@/components/sections/CTABand';
import { domainList } from '@/data/domains';
import { principles } from '@/data/experience';
import { profile } from '@/data/profile';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'About',
  description: `${profile.role} with ${profile.yearsExperience} years of experience. How I work, what I care about technically, and how to get in touch.`,
  path: '/about',
});

const process = [
  {
    step: 'Scope',
    body: 'A short conversation about the problem, then a written scope: what is included, what is not, and the assumptions it depends on. No building starts before that is agreed.',
  },
  {
    step: 'Build',
    body: 'Reviewable increments that each leave the system working. You see progress continuously rather than a reveal at the end, and anything that turns out to be wrong is cheap to change.',
  },
  {
    step: 'Verify',
    body: 'Tests covering the contract, not just the units. Performance checked against a realistic workload. Deployed with logs, metrics and alerting in place from the start.',
  },
  {
    step: 'Hand over',
    body: 'Notes on architecture, decisions and trade-offs, operational details, and the rough edges I know about. Nothing important should live only in my head.',
  },
];

export default function AboutPage() {
  const links = [
    profile.contact.github ? { label: 'GitHub', href: profile.contact.github } : null,
    profile.contact.linkedin ? { label: 'LinkedIn', href: profile.contact.linkedin } : null,
    profile.contact.x ? { label: 'X', href: profile.contact.x } : null,
    profile.contact.resumeUrl ? { label: 'Résumé', href: profile.contact.resumeUrl } : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return (
    <>
      <section className="site-container pt-10 pb-12 md:pt-16">
        <Reveal>
          <MonoLabel as="p">About</MonoLabel>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Reveal delay={0.04}>
              <h1 className="text-display-sm max-w-3xl">
                I build systems that have to keep working
              </h1>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mt-8 max-w-2xl space-y-5 text-base leading-relaxed text-body md:text-lg">
                <p>
                  I am {profile.name}, a {profile.role.toLowerCase()} with{' '}
                  {profile.yearsExperience} years of experience. Most of my work sits where AI meets
                  ordinary production engineering: a model call is the easy part, and everything
                  around it — retrieval, validation, queues, budgets, traces, deployment — is where
                  a feature either survives real traffic or quietly falls apart.
                </p>
                <p>
                  Before LLMs became the centre of the work, I spent years on backend services,
                  relational data models and the realtime layer on top of them. That background is
                  why I treat an AI system as a distributed system rather than a prompt: the failure
                  modes are the familiar ones, and they respond to the familiar fixes.
                </p>
                <p>
                  I work well with founders and small teams who need a senior engineer to own a
                  problem end to end — architecture through deployment — and who would rather have
                  decisions written down than delivered as a surprise.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="space-y-4">
            <Panel className="p-5">
              <MonoLabel as="p">Status</MonoLabel>
              <p className="mt-4 flex items-center gap-2.5">
                <StatusDot state={profile.availability.state} />
                <span className="font-mono text-xs tracking-[0.14em] text-accent uppercase">
                  {profile.availability.label}
                </span>
              </p>
              <dl className="mt-5 space-y-2.5 border-t border-line-faint pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Location</dt>
                  <dd className="text-xs text-body">{profile.location}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Timezone</dt>
                  <dd className="text-xs text-body">{profile.timezone}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="label-mono-sm text-faint">Experience</dt>
                  <dd className="text-xs text-body">{profile.yearsExperience} years</dd>
                </div>
              </dl>
            </Panel>

            <Panel className="p-5">
              <MonoLabel as="p">Contact</MonoLabel>
              <p className="mt-4 text-sm leading-relaxed text-body">
                The start-project form is the fastest route — it collects enough detail for the
                first reply to be a scope rather than a request for a call.
              </p>
              <ActionLink href="/start-project" variant="primary" size="sm" className="mt-5">
                Start a project
              </ActionLink>

              {links.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-faint pt-4">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="label-mono-sm transition-colors hover:text-primary"
                      >
                        {link.label} →
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {profile.contact.placeholder ? (
                <p className="mt-4 border-t border-line-faint pt-4 text-xs leading-relaxed text-faint">
                  <MonoLabel size="sm" tone="warn" className="mr-2">
                    Note
                  </MonoLabel>
                  Contact details are placeholders. Replace them in{' '}
                  <code className="font-mono text-muted">src/data/profile.ts</code>.
                </p>
              ) : null}
            </Panel>
          </Reveal>
        </div>
      </section>

      <section className="site-container pb-16 md:pb-24">
        <SectionHeader
          kicker="How I work"
          title="Four phases, in order"
          description="Deliberately unremarkable. Most engagements go wrong at the scoping stage, not the coding stage."
        />
        <RevealGroup as="ol" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
          {process.map((phase, index) => (
            <RevealItem as="li" key={phase.step} className="bg-void p-6">
              <MonoLabel size="sm" tone="accent" className="tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </MonoLabel>
              <h3 className="mt-3 text-base font-medium text-primary">{phase.step}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{phase.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="site-container pb-16 md:pb-24">
        <SectionHeader kicker="What I care about technically" title="Principles" />
        <RevealGroup as="ul" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {principles.map((principle) => (
            <RevealItem as="li" key={principle.title} className="bg-void p-6 md:p-7">
              <h3 className="text-base font-medium text-primary">{principle.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{principle.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="site-container pb-16 md:pb-24">
        <SectionHeader kicker="Explore the network" title="Six engineering areas" />
        <ul className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {domainList.map((domain) => (
            <li key={domain.id}>
              <Link
                href={`/system/${domain.id}`}
                className="group flex h-full flex-col bg-void p-6 transition-colors hover:bg-panel"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-medium text-primary transition-colors group-hover:text-accent">
                    {domain.title}
                  </h3>
                  <span className="label-mono-sm text-faint">{domain.id}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-body">{domain.tagline}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CTABand secondary={{ label: 'View experience', href: '/experience' }} />
    </>
  );
}
