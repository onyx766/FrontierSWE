import type { DomainId } from '@/lib/types';

export const SITE_NAME = 'Ryan // Engineering Network';
export const SITE_SHORT_NAME = 'Ryan';
export const SITE_DESCRIPTION =
  'Senior AI / Full-Stack Engineer. Production AI systems, scalable backends, SaaS products. 6+ years. Available for projects.';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export interface NavItem {
  label: string;
  href: string;
}

/**
 * The site is one page: every destination is a section of the homepage.
 * Used by the 3D world's top bar, which links back into those sections.
 */
export const navItems: NavItem[] = [
  { label: 'Projects', href: '/#projects' },
  { label: 'Experience', href: '/#experience' },
  { label: 'Skills', href: '/#skills' },
  { label: 'Services', href: '/#services' },
  { label: 'About', href: '/#about' },
];

/** Homepage sections the 3D world links back to. */
export const sectionHref = {
  projects: '/#projects',
  experience: '/#experience',
  services: '/#services',
  about: '/#about',
  architecture: '/#architecture',
  contact: '/#contact',
} as const;

/** Routes that should appear in the sitemap with their relative priority. */
export const staticRoutes: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/world', priority: 0.6 },
];

/** Engineering areas have no pages of their own; they are covered under Skills. */
export function domainHref(_id: DomainId): string {
  return '/#skills';
}
