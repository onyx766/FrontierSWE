import type { MetadataRoute } from 'next';
import { DOMAIN_IDS } from '@/lib/types';
import { projects } from '@/data/projects';
import { SITE_URL, staticRoutes } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: route.priority,
    })),
    ...DOMAIN_IDS.map((domain) => ({
      url: `${SITE_URL}/system/${domain}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...projects.map((project) => ({
      url: `${SITE_URL}/projects/${project.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
