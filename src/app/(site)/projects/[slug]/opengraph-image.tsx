import { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from '@/lib/og';
import { getProject, projects, statusLabels } from '@/data/projects';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Engineering case study';

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) {
    return new ImageResponse(<OgCard kicker="Case study" title="Project" />, size);
  }

  return new ImageResponse(
    (
      <OgCard
        kicker="Case study"
        title={project.name}
        description={project.summary}
        tags={project.technologies.slice(0, 7)}
        status={statusLabels[project.status]}
      />
    ),
    size,
  );
}
