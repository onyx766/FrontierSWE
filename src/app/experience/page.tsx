import Link from 'next/link';
import type { Metadata } from 'next';
import { Chip, PlaceholderChip } from '@/components/primitives/Chip';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Reveal, RevealGroup, RevealItem } from '@/components/primitives/Reveal';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { CTABand } from '@/components/sections/CTABand';
import { domains } from '@/data/domains';
import { experience, principles, stackGroups } from '@/data/experience';
import { profile } from '@/data/profile';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Experience',
  description: `${profile.yearsExperience} years of engineering across AI systems, backend services, data, realtime and infrastructure. Capability matrix by domain.`,
  path: '/experience',
});

export default function ExperiencePage() {
  return (
    <>
      <section className="site-container pt-10 pb-10 md:pt-16">
        <Reveal>
          <MonoLabel as="p">Experience</MonoLabel>
        </Reveal>
        <Reveal delay={0.04}>
          <h1 className="text-display-sm mt-6 max-w-3xl">
            {profile.yearsExperience} years building and running software
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-body md:text-lg">
            Backend and full-stack engineering, with the last stretch focused on production AI
            systems. The case studies are the better signal of how the work is done — this page is
            the shape of the history and the depth per area.
          </p>
        </Reveal>
      </section>

      {/* ── Timeline ───────────────────────────────────────────────────────── */}
      <section className="site-container pb-16 md:pb-24">
        <SectionHeader
          kicker="Timeline"
          aside={
            experience.some((entry) => entry.placeholder) ? <PlaceholderChip /> : null
          }
        />

        <ol className="mt-10">
          {experience.map((entry, index) => (
            <Reveal key={entry.id} delay={index * 0.04} as="li">
              <article className="grid gap-6 border-t border-line py-8 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-10">
                <div>
                  <MonoLabel size="sm" tone="accent" className="block">
                    {entry.period}
                  </MonoLabel>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{entry.organisation}</p>
                </div>

                <div>
                  <h2 className="text-lg font-medium tracking-tight text-primary md:text-xl">
                    {entry.role}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-body">
                    {entry.summary}
                  </p>

                  <ul className="mt-5 space-y-2.5">
                    {entry.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-3">
                        <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 bg-accent" />
                        <span className="text-sm leading-relaxed text-muted">{highlight}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-1.5">
                    {entry.stack.map((item) => (
                      <Chip key={item} size="sm">
                        {item}
                      </Chip>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {entry.domains.map((id) => (
                      <Link
                        key={id}
                        href={`/system/${id}`}
                        className="label-mono-sm text-faint transition-colors hover:text-accent"
                      >
                        {domains[id].label} →
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </ol>

        <p className="mt-6 max-w-2xl border border-warn/25 bg-warn/5 p-5 text-xs leading-relaxed text-body">
          <MonoLabel size="sm" tone="warn" className="mb-2 block">
            Placeholder content
          </MonoLabel>
          Roles and organisations here are generic descriptors, not invented employers. Replace them
          with your real history in{' '}
          <code className="font-mono text-muted">src/data/experience.ts</code> and set{' '}
          <code className="font-mono text-muted">placeholder: false</code>.
        </p>
      </section>

      {/* ── Capability matrix ──────────────────────────────────────────────── */}
      <section className="site-container pb-16 md:pb-24">
        <SectionHeader
          kicker="Capability matrix"
          title="Depth by area"
          description="Self-assessed depth, grouped by the same six domains as the network. Five means it has been owned in production under load; three means it has been used successfully with supervision."
        />

        <RevealGroup className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {stackGroups.map((group) => (
            <RevealItem key={group.label} className="bg-void p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-base font-medium text-primary">{group.label}</h3>
                <Link
                  href={`/system/${group.domain}`}
                  className="label-mono-sm text-faint transition-colors hover:text-accent"
                >
                  {group.domain}
                </Link>
              </div>

              <ul className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-body">{item.name}</span>
                    <span className="flex gap-1" aria-label={`Depth ${item.depth} of 5`}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <span
                          key={level}
                          aria-hidden
                          className={
                            level <= item.depth ? 'h-3 w-0.5 bg-accent' : 'h-3 w-0.5 bg-line-strong'
                          }
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ── Principles ─────────────────────────────────────────────────────── */}
      <section className="site-container pb-16 md:pb-24">
        <SectionHeader
          kicker="How the work gets done"
          title="Engineering principles"
          description="Opinions rather than credentials. These are the habits that make the difference between code that works today and a system that still works in a year."
        />
        <RevealGroup as="ul" className="mt-10 grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
          {principles.map((principle) => (
            <RevealItem as="li" key={principle.title} className="bg-void p-6 md:p-7">
              <h3 className="text-base font-medium text-primary">{principle.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{principle.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <CTABand secondary={{ label: 'See case studies', href: '/projects' }} />
    </>
  );
}
