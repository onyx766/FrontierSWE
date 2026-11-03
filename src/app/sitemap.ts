import type { MetadataRoute } from 'next';
import { SITE_URL, staticRoutes } from '@/data/site';

/** The site is the homepage plus the 3D world; sections are anchors, not pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: route.priority,
  }));
}
