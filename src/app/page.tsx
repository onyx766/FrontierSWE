import type { Metadata } from 'next';
import { capabilityStrip, profile } from '@/data/profile';
import { buildMetadata, personSchema } from '@/lib/seo';
import { UniverseStage } from '@/universe/UniverseStage';

export const metadata: Metadata = buildMetadata({
  title: `${profile.name} — ${profile.role}`,
  description: profile.tagline,
  path: '/',
});

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
      <UniverseStage />
    </>
  );
}
