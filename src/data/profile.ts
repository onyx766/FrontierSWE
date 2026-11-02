import type { Profile } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROFILE  —  EDIT THIS FIRST
 * ─────────────────────────────────────────────────────────────────────────────
 * Values marked [PLACEHOLDER] are invented contact details and must be
 * replaced before the site goes live. Nothing here claims an employer, a
 * client or a revenue figure; those are yours to add.
 */

export const profile: Profile = {
  name: 'Ryan',
  role: 'Senior AI / Full-Stack Engineer',
  tagline: 'Building production AI systems, scalable backends and SaaS products.',
  yearsExperience: '8+',
  // [PLACEHOLDER] — set your real location, or delete the usages in /about.
  location: 'Remote',
  // [PLACEHOLDER] — set your real working timezone.
  timezone: 'UTC',
  availability: {
    state: 'available',
    label: 'Available for projects',
    detail:
      'Taking on new engineering work now — from a single broken endpoint to a full production AI system.',
  },
  contact: {
    // [PLACEHOLDER] — replace with your real address.
    email: 'hello@example.com',
    // [PLACEHOLDER] — replace or remove.
    github: 'https://github.com/example',
    // [PLACEHOLDER] — replace or remove.
    linkedin: 'https://www.linkedin.com/in/example',
    // [PLACEHOLDER] — replace or remove.
    x: undefined,
    // [PLACEHOLDER] — drop a PDF in /public and point this at it, or remove.
    resumeUrl: undefined,
    placeholder: true,
  },
};

/** Headline capability chips for the homepage strip. */
export const capabilityStrip: string[] = [
  'Python',
  'FastAPI',
  'Node.js',
  'TypeScript',
  'React',
  'Next.js',
  'PostgreSQL',
  'Redis',
  'REST APIs',
  'WebSockets',
  'Docker',
  'AWS',
  'OpenAI API',
  'Claude API',
  'RAG',
  'AI Agents',
  'Tool Calling',
  'SaaS Architecture',
];

/** Short, checkable claims used in the hero and CTA bands. */
export const proofPoints: { label: string; value: string }[] = [
  { label: 'Experience', value: '8+ years engineering' },
  { label: 'Focus', value: 'AI systems · backends · SaaS' },
  { label: 'Engagements', value: 'Small fixes to full builds' },
];
