import type { Metadata, Viewport } from 'next';
import { Hero } from '@/components/landing/hero/Hero';
import { StatsStrip } from '@/components/landing/hero/StatsStrip';
import { About } from '@/components/landing/sections/About';
import { Contact } from '@/components/landing/sections/Contact';
import { Engagement } from '@/components/landing/sections/Engagement';
import { Experience } from '@/components/landing/sections/Experience';
import { Faq } from '@/components/landing/sections/Faq';
import { FinalCta } from '@/components/landing/sections/FinalCta';
import { HowIEngineer } from '@/components/landing/sections/HowIEngineer';
import { Process } from '@/components/landing/sections/Process';
import { Projects } from '@/components/landing/sections/Projects';
import { Services } from '@/components/landing/sections/Services';
import { Skills } from '@/components/landing/sections/Skills';
import { TechMarquee } from '@/components/landing/sections/TechMarquee';
import { capabilityStrip, profile } from '@/data/profile';
import { buildMetadata, personSchema } from '@/lib/seo';

export const metadata: Metadata = {
  ...buildMetadata({
    title: `${profile.name} — ${profile.role}`,
    description: profile.tagline,
    path: '/',
  }),
  // Absolute: the root template would otherwise append the name a second time.
  title: { absolute: `${profile.name} — ${profile.role}` },
};

/** The homepage is the one light page; the browser chrome should match it. */
export const viewport: Viewport = {
  themeColor: '#f7f6fc',
  colorScheme: 'light',
};

/**
 * The homepage: a long, light landing page. Readable without WebGL or
 * JavaScript — the canvases are decoration, and the 3D world is one link away
 * (`/world`); none of its code loads until a visitor follows that link.
 * This is the whole site: every link elsewhere on it is an in-page anchor.
 */
export default function HomePage() {
  const schema = personSchema({
    name: profile.name,
    role: profile.role,
    description: profile.tagline,
    skills: capabilityStrip,
    sameAs: [profile.contact.github, profile.contact.linkedin, profile.contact.x].filter(
      (value): value is string => typeof value === 'string',
    ),
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Static, locally-authored object — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Hero />
      <StatsStrip />
      <TechMarquee />
      <Skills />
      <Projects />
      <Experience />
      <HowIEngineer />
      <Services />
      <Process />
      <Engagement />
      <About />
      <Faq />
      <Contact />
      <FinalCta />
    </>
  );
}
