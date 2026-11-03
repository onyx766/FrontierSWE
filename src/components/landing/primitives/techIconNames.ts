/**
 * Every technology glyph the landing page can draw. A plain module (no JSX) so
 * the data layer can import the type without pulling in any SVG.
 */
export const TECH_ICON_NAMES = [
  // AI / LLM
  'openai',
  'claude',
  'langchain',
  'llamaindex',
  'rag',
  'agents',
  // Backend
  'python',
  'fastapi',
  'nodejs',
  'typescript',
  'django',
  'websockets',
  // Frontend
  'react',
  'nextjs',
  'tailwind',
  'threejs',
  'framer',
  // Data
  'postgresql',
  'redis',
  'pgvector',
  'celery',
  'prisma',
  'pipelines',
  // Infrastructure
  'docker',
  'aws',
  'terraform',
  'cicd',
  'linux',
  'monitoring',
] as const;

export type TechIconName = (typeof TECH_ICON_NAMES)[number];
