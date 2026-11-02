import type { DomainId } from '@/lib/types';

export const SITE_NAME = 'Ryan // Engineering Network';
export const SITE_SHORT_NAME = 'Ryan';
export const SITE_DESCRIPTION =
  'Senior AI / Full-Stack Engineer. Production AI systems, scalable backends, SaaS products. 8+ years. Available for projects.';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = [
  { label: 'System', href: '/#topology' },
  { label: 'Projects', href: '/projects' },
  { label: 'Services', href: '/services' },
  { label: 'Experience', href: '/experience' },
  { label: 'About', href: '/about' },
];

export const footerColumns: { label: string; items: NavItem[] }[] = [
  {
    label: 'Network',
    items: [
      { label: 'Core Engine', href: '/system/core-engine' },
      { label: 'AI Systems', href: '/system/ai-systems' },
      { label: 'Data', href: '/system/data' },
      { label: 'Realtime', href: '/system/realtime' },
      { label: 'Infrastructure', href: '/system/infrastructure' },
      { label: 'Frontend', href: '/system/frontend' },
    ],
  },
  {
    label: 'Site',
    items: [
      { label: 'Projects', href: '/projects' },
      { label: 'Services', href: '/services' },
      { label: 'Experience', href: '/experience' },
      { label: 'About', href: '/about' },
      { label: 'Start a project', href: '/start-project' },
    ],
  },
];

/** Routes that should appear in the sitemap with their relative priority. */
export const staticRoutes: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/projects', priority: 0.9 },
  { path: '/services', priority: 0.9 },
  { path: '/start-project', priority: 0.9 },
  { path: '/experience', priority: 0.7 },
  { path: '/about', priority: 0.7 },
];

export function domainHref(id: DomainId): string {
  return `/system/${id}`;
}
