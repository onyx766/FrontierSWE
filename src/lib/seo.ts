import type { Metadata } from 'next';
import { SITE_NAME, SITE_SHORT_NAME, SITE_URL } from '@/data/site';

interface PageMetaInput {
  title: string;
  description: string;
  /** Path including the leading slash, e.g. "/projects". */
  path: string;
  /** Overrides the generated OG image. */
  image?: string;
  type?: 'website' | 'article';
  keywords?: string[];
}

const BASE_KEYWORDS = [
  'AI engineer',
  'LLM engineer',
  'full-stack engineer',
  'FastAPI developer',
  'Next.js developer',
  'RAG systems',
  'AI agents',
  'backend engineer',
  'SaaS developer',
  'freelance software engineer',
];

/**
 * Single place metadata is assembled, so every route gets consistent canonical
 * URLs, OpenGraph and Twitter cards without repeating the boilerplate.
 */
export function buildMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  keywords = [],
}: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  // Defaults to the site-wide OG image; pass `image` for a per-page one.
  const ogImage = image ?? `${SITE_URL}/opengraph-image`;

  return {
    title,
    description,
    keywords: [...BASE_KEYWORDS, ...keywords],
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — ${SITE_SHORT_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: 'en_US',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — ${SITE_SHORT_NAME}`,
      description,
      images: [ogImage],
    },
  };
}

/** JSON-LD for the homepage. Helps a search engine understand who this is. */
export function personSchema(input: {
  name: string;
  role: string;
  description: string;
  skills: string[];
  sameAs: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    jobTitle: input.role,
    description: input.description,
    knowsAbout: input.skills,
    url: SITE_URL,
    ...(input.sameAs.length > 0 ? { sameAs: input.sameAs } : {}),
  };
}

export function serviceSchema(services: { title: string; summary: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Engineering services',
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.title,
        description: service.summary,
      },
    })),
  };
}

export function projectSchema(input: {
  name: string;
  description: string;
  slug: string;
  technologies: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: input.name,
    description: input.description,
    url: `${SITE_URL}/projects/${input.slug}`,
    keywords: input.technologies.join(', '),
  };
}
