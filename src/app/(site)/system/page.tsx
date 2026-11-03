import Link from 'next/link';
import type { Metadata } from 'next';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { Reveal } from '@/components/primitives/Reveal';
import { CTABand } from '@/components/sections/CTABand';
import { CapabilityStrip } from '@/components/sections/CapabilityStrip';
import { Hero } from '@/components/sections/Hero';
import { ProjectCard } from '@/components/sections/ProjectCard';
import { SystemSection } from '@/components/system/SystemSection';
import { profile } from '@/data/profile';
import { featuredProjects } from '@/data/projects';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'System map',
  description: `The engineering areas behind ${profile.name}'s work, as an interactive system map. ${profile.tagline}`,
  path: '/system',
});

/**
 * The plain-web view of the portfolio: the interactive topology, the live feed
 * and the featured case studies. It needs no WebGL, so it is also where the
 * homepage sends visitors whose device cannot run the 3D world.
 */
export default function SystemPage() {
  return (
    <>
      <Hero />

      <section className="site-container pb-8">
        <SystemSection />
      </section>

      <CapabilityStrip />

      <section className="site-container pb-8">
        <SectionHeader
          kicker="Selected systems"
          title="Engineering proof, not screenshots"
          description="Each case study covers the problem, the architecture, the technical challenges that actually came up, and the engineering decisions behind them — with the trade-offs stated."
          aside={
            <Link
              href="/projects"
              className="label-mono text-muted transition-colors hover:text-accent"
            >
              View all projects →
            </Link>
          }
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredProjects.map((project, index) => (
            <Reveal key={project.slug} delay={index * 0.05} className="flex">
              <ProjectCard project={project} className="w-full" />
            </Reveal>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-faint">
          <MonoLabel size="sm" tone="warn" className="mr-2">
            Note
          </MonoLabel>
          The case studies currently use clearly-marked placeholder content: real engineering
          substance, no invented employers, clients or metrics. Replace them in{' '}
          <code className="font-mono text-muted">src/data/projects.ts</code>.
        </p>
      </section>

      <CTABand />
    </>
  );
}
