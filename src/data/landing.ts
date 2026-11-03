import type { IconName } from '@/components/landing/primitives/Icon';
import type { TechIconName } from '@/components/landing/primitives/techIconNames';
import { principles } from '@/data/experience';
import { profile } from '@/data/profile';
import { getProject } from '@/data/projects';
import { engagementModels, serviceFaqs, smallTasks } from '@/data/services';
import { projectStationId, worldHref } from '@/data/universe';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LANDING PAGE  —  the light homepage at `/`
 * ─────────────────────────────────────────────────────────────────────────────
 * All copy for the homepage lives here; components only render it. Where the
 * homepage repeats something the rest of the site already says (profile,
 * projects, services, principles) it is imported, not restated.
 *
 * Values marked [CONFIRM] came from the homepage design rather than from the
 * other data files — check them before going live.
 */

export interface LandingLink {
  label: string;
  href: string;
}

/* ─────────────────────────────── Navigation ─────────────────────────────── */

/** In-page sections the nav links to and highlights while scrolling. */
export const navSections: { id: string; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'projects', label: 'Projects' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
];

export const startProjectHref = '#contact';

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
  external: boolean;
}

const maybeSocials: (SocialLink | null)[] = [
  profile.contact.github
    ? { label: 'GitHub', href: profile.contact.github, icon: 'github', external: true }
    : null,
  profile.contact.linkedin
    ? { label: 'LinkedIn', href: profile.contact.linkedin, icon: 'linkedin', external: true }
    : null,
  { label: 'Email', href: `mailto:${profile.contact.email}`, icon: 'mail', external: false },
];

/** Off-site and mail links, from the profile. Absent ones are left out. */
export const socialLinks: SocialLink[] = maybeSocials.filter(
  (item): item is SocialLink => item !== null,
);

/* ────────────────────────────────── Hero ────────────────────────────────── */

export const hero = {
  eyebrow: 'Senior AI + Full-Stack Engineer',
  /** Rendered as three lines; the last word of the last line is the accent. */
  title: { lines: ['I Build', 'AI Products'], lastLead: 'That', lastAccent: 'Ship' },
  subtitle: 'From idea to production — AI systems, scalable backends and SaaS products.',
  primaryCta: { label: 'View My Work', href: '#projects' } satisfies LandingLink,
  secondaryCta: { label: 'Start a Project', href: startProjectHref } satisfies LandingLink,
  annotation: ['Explore My', 'Engineering City', '(3D Experience)'],
  worldCta: { label: 'Enter 3D World', href: worldHref() } satisfies LandingLink,
  dragHint: 'Drag to rotate',
};

export interface HeroStat {
  icon: IconName | 'status';
  /** A number counts up; text renders as is. */
  value: { count: number; suffix?: string } | { text: string };
  label: string;
  accent?: boolean;
}

export const heroStats: HeroStat[] = [
  { icon: 'calendar', value: { count: 8, suffix: '+' }, label: 'Years Experience' },
  // [CONFIRM] From the design; not stated anywhere else on the site.
  { icon: 'layers', value: { count: 30, suffix: '+' }, label: 'Projects Delivered' },
  { icon: 'sparkles', value: { text: 'AI / LLM' }, label: 'Production Experience', accent: true },
  { icon: 'wand', value: { text: 'End-to-End' }, label: 'Design → Build → Deploy' },
  { icon: 'status', value: { text: 'Available for Work' }, label: "Let's build something together." },
];

/* ─────────────────────────────── Tech marquee ───────────────────────────── */

export const marqueeRows: { name: string; icon: TechIconName }[][] = [
  [
    { name: 'OpenAI', icon: 'openai' },
    { name: 'Claude', icon: 'claude' },
    { name: 'LangChain', icon: 'langchain' },
    { name: 'LlamaIndex', icon: 'llamaindex' },
    { name: 'Python', icon: 'python' },
    { name: 'FastAPI', icon: 'fastapi' },
    { name: 'Node.js', icon: 'nodejs' },
    { name: 'TypeScript', icon: 'typescript' },
    { name: 'Django', icon: 'django' },
    { name: 'WebSockets', icon: 'websockets' },
    { name: 'PostgreSQL', icon: 'postgresql' },
    { name: 'Redis', icon: 'redis' },
    { name: 'pgvector', icon: 'pgvector' },
  ],
  [
    { name: 'React', icon: 'react' },
    { name: 'Next.js', icon: 'nextjs' },
    { name: 'Tailwind CSS', icon: 'tailwind' },
    { name: 'Three.js', icon: 'threejs' },
    { name: 'Framer Motion', icon: 'framer' },
    { name: 'Docker', icon: 'docker' },
    { name: 'AWS', icon: 'aws' },
    { name: 'Terraform', icon: 'terraform' },
    { name: 'CI/CD', icon: 'cicd' },
    { name: 'Linux', icon: 'linux' },
    { name: 'Celery', icon: 'celery' },
    { name: 'Prisma', icon: 'prisma' },
    { name: 'Monitoring', icon: 'monitoring' },
  ],
];

/* ────────────────────────────────── Skills ──────────────────────────────── */

export interface SkillTab {
  id: string;
  label: string;
  caption: string;
  icon: IconName;
  title: string;
  description: string;
  tools: { name: string; icon: TechIconName }[];
  highlights: string[];
}

export const skillsIntro = {
  title: 'My Skills',
  description: 'The tools and technologies I use to turn complex ideas into real products.',
};

export const skillTabs: SkillTab[] = [
  {
    id: 'ai',
    label: 'AI / LLM',
    caption: 'Agents, RAG, Tool Use',
    icon: 'cpu',
    title: 'AI / LLM Stack',
    description: 'Building practical AI systems with LLMs, agents, RAG and tool calling.',
    tools: [
      { name: 'OpenAI', icon: 'openai' },
      { name: 'Claude', icon: 'claude' },
      { name: 'LangChain', icon: 'langchain' },
      { name: 'LlamaIndex', icon: 'llamaindex' },
      { name: 'RAG', icon: 'rag' },
      { name: 'Agents', icon: 'agents' },
    ],
    highlights: [
      'Streaming and structured output',
      'Hybrid retrieval with reranking',
      'Typed tool calling with traces',
    ],
  },
  {
    id: 'backend',
    label: 'Backend',
    caption: 'APIs, Services',
    icon: 'layers',
    title: 'Backend Stack',
    description: 'Typed, observable services and APIs that stay fast and predictable under load.',
    tools: [
      { name: 'Python', icon: 'python' },
      { name: 'FastAPI', icon: 'fastapi' },
      { name: 'Node.js', icon: 'nodejs' },
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'Django', icon: 'django' },
      { name: 'WebSockets', icon: 'websockets' },
    ],
    highlights: [
      'Versioned, documented contracts',
      'Background jobs with retries',
      'Auth, roles and rate limits',
    ],
  },
  {
    id: 'frontend',
    label: 'Frontend',
    caption: 'Web Apps, UX',
    icon: 'monitor',
    title: 'Frontend Stack',
    description: 'Fast, accessible product surfaces, with server components by default.',
    tools: [
      { name: 'React', icon: 'react' },
      { name: 'Next.js', icon: 'nextjs' },
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'Tailwind CSS', icon: 'tailwind' },
      { name: 'Three.js', icon: 'threejs' },
      { name: 'Framer Motion', icon: 'framer' },
    ],
    highlights: [
      'Streaming UI for AI features',
      'Accessible, keyboard-first',
      'Performance budgets that hold',
    ],
  },
  {
    id: 'data',
    label: 'Data',
    caption: 'Storage, Processing',
    icon: 'database',
    title: 'Data Stack',
    description: 'Data models, queues and retrieval layers designed around the queries that matter.',
    tools: [
      { name: 'PostgreSQL', icon: 'postgresql' },
      { name: 'Redis', icon: 'redis' },
      { name: 'pgvector', icon: 'pgvector' },
      { name: 'Celery', icon: 'celery' },
      { name: 'Prisma', icon: 'prisma' },
      { name: 'Pipelines', icon: 'pipelines' },
    ],
    highlights: [
      'Query plans read, not guessed',
      'Vector + keyword search in one store',
      'Idempotent, replayable pipelines',
    ],
  },
  {
    id: 'infra',
    label: 'Infrastructure',
    caption: 'Deploy, Scale',
    icon: 'box',
    title: 'Infrastructure Stack',
    description: 'Repeatable deploys, monitoring from day one, and infrastructure that is easy to reason about.',
    tools: [
      { name: 'Docker', icon: 'docker' },
      { name: 'AWS', icon: 'aws' },
      { name: 'Terraform', icon: 'terraform' },
      { name: 'CI/CD', icon: 'cicd' },
      { name: 'Linux', icon: 'linux' },
      { name: 'Monitoring', icon: 'monitoring' },
    ],
    highlights: [
      'Containerised, reproducible builds',
      'Infrastructure as code',
      'Alerts that mean something',
    ],
  },
];

/* ───────────────────────────────── Projects ─────────────────────────────── */

export type ProjectVisualKind = 'agents' | 'rag' | 'saas';

export interface LandingProject {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  stack: string[];
  visual: ProjectVisualKind;
  href: string;
}

const projectSlides: { slug: string; description: string; tags: string[]; visual: ProjectVisualKind }[] = [
  {
    slug: 'agent-orchestration-platform',
    description: 'Multi-agent runtime with typed tool calling, streaming and execution traces.',
    tags: ['AI Agents', 'Backend', 'SaaS'],
    visual: 'agents',
  },
  {
    slug: 'rag-knowledge-service',
    description: 'Hybrid vector and keyword retrieval with reranking, cited answers and measured recall.',
    tags: ['RAG', 'AI', 'Data'],
    visual: 'rag',
  },
  {
    slug: 'saas-platform-core',
    description: 'Multi-tenant foundation: auth and roles, usage metering, billing hooks and an admin surface.',
    tags: ['SaaS', 'Full-Stack', 'Multi-tenant'],
    visual: 'saas',
  },
];

export const landingProjects: LandingProject[] = projectSlides.flatMap((slide) => {
  const project = getProject(slide.slug);
  if (!project) return [];
  return [
    {
      slug: project.slug,
      name: project.name,
      description: slide.description,
      tags: slide.tags,
      stack: project.technologies.slice(0, 5),
      visual: slide.visual,
      // No case-study pages: each project opens at its own stop in the 3D world.
      href: worldHref(projectStationId(project.slug)),
    },
  ];
});

export const projectsIntro = {
  title: 'Selected Projects',
  description: 'Real engineering work, from architecture to production.',
  allProjects: { label: 'Explore Them All in 3D', href: worldHref() } satisfies LandingLink,
};

/* ──────────────────────────────── Experience ────────────────────────────── */

export interface TimelineEntry {
  period: string;
  role: string;
  summary: string;
  tech: string[];
  current?: boolean;
}

export const experienceIntro = {
  title: 'Experience',
  accent: `${profile.yearsExperience} Years`,
  description: 'A journey of building products, leading technical work and delivering real impact.',
  more: { label: 'How I work', href: '#about' } satisfies LandingLink,
};

// [CONFIRM] Dates and titles come from the homepage design.
export const timeline: TimelineEntry[] = [
  {
    period: '2022 – Present',
    role: 'Senior Software Engineer (AI / Full-Stack)',
    summary: 'Design and build AI products, agent systems and scalable SaaS platforms.',
    tech: ['Python', 'FastAPI', 'Next.js', 'PostgreSQL', 'Redis', 'AWS', 'LLMs'],
    current: true,
  },
  {
    period: '2019 – 2022',
    role: 'Software Engineer / Tech Lead',
    summary:
      'Led development of web services and backend systems, improved performance and reliability, and mentored engineers.',
    tech: ['Node.js', 'TypeScript', 'Docker', 'AWS'],
  },
  {
    period: '2016 – 2019',
    role: 'Software Engineer',
    summary: 'Built and maintained core web applications, APIs and data pipelines.',
    tech: ['Python', 'Django', 'PostgreSQL', 'JavaScript'],
  },
];

/* ───────────────────────────── How I engineer ───────────────────────────── */

export interface FlowNode {
  id: string;
  label: string;
  caption: string;
  /** Interface icon, or a technology glyph when `tech` is set. */
  icon: IconName;
  tech?: TechIconName;
  /** Shown on hover/focus: what this layer is responsible for. */
  detail: string;
}

export const architectureIntro = {
  title: 'How I Engineer',
  description: 'A practical, end-to-end approach to turning ideas into reliable products.',
  more: { label: 'See It in Projects', href: '#projects' } satisfies LandingLink,
};

/** The main request path, left to right. */
export const flowPath: FlowNode[] = [
  {
    id: 'user',
    label: 'User',
    caption: 'Browser / App',
    icon: 'user',
    detail: 'A request starts with a person: every layer after this exists to answer them quickly and correctly.',
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    caption: '(Frontend)',
    icon: 'monitor',
    tech: 'nextjs',
    detail: 'Server components by default, streaming UI for AI responses, a typed client for the API.',
  },
  {
    id: 'api',
    label: 'API',
    caption: '(FastAPI)',
    icon: 'bolt',
    tech: 'fastapi',
    detail: 'Validation, auth and rate limits at the edge; long work handed to background jobs.',
  },
  {
    id: 'agents',
    label: 'AI Agents',
    caption: '(LLM / Tools)',
    icon: 'robot',
    tech: 'agents',
    detail: 'Model calls and a typed tool registry, with step budgets and a full trace of every run.',
  },
];

/** Where the agents layer fans out to. */
export const flowStores: FlowNode[] = [
  {
    id: 'redis',
    label: 'Redis',
    caption: '(Cache / Queue)',
    icon: 'server',
    tech: 'redis',
    detail: 'Caching, job queues and pub/sub fan-out for realtime progress.',
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    caption: '(Database)',
    icon: 'database',
    tech: 'postgresql',
    detail: 'The source of truth: relational data, run traces and pgvector embeddings in one place.',
  },
];

/* ───────────────────────────────── Services ─────────────────────────────── */

export interface LandingService {
  id: string;
  title: string;
  caption: string;
  description: string;
  icon: IconName;
  href: string;
  featured?: boolean;
}

export const servicesIntro = {
  title: 'Services',
  description: 'What I can build for you.',
  more: { label: 'Get in touch', href: '#contact' } satisfies LandingLink,
};

export const landingServices: LandingService[] = [
  {
    id: 'ai-product',
    title: 'AI Product Development',
    caption: 'LLM, Agents, RAG, Automation',
    description: 'LLM features, agents and retrieval built for production: streaming, evaluation and cost control.',
    icon: 'cpu',
    href: '#contact',
    featured: true,
  },
  {
    id: 'saas',
    title: 'SaaS Development',
    caption: 'End-to-end product building',
    description: 'Auth, tenancy, billing hooks and the product surface — the foundation features are built on.',
    icon: 'layers',
    href: '#contact',
  },
  {
    id: 'backend',
    title: 'Backend & APIs',
    caption: 'Scalable, reliable systems',
    description: 'FastAPI and Node.js services with typed contracts, queues and integrations that hold up.',
    icon: 'plug',
    href: '#contact',
  },
  {
    id: 'system-design',
    title: 'System Design',
    caption: 'Architecture & technical advisory',
    description: 'Architecture you can reason about, with the decisions and trade-offs written down.',
    icon: 'pen-tool',
    href: '#contact',
  },
  {
    id: 'debugging',
    title: 'Debugging & Scaling',
    caption: 'Performance, reliability, cost',
    description: 'Measured fixes for slow queries, failing deploys and systems that buckle under load.',
    icon: 'gauge',
    href: '#contact',
  },
];

/** Small fixed-scope tasks, shown under the services. */
export const quickTasks = {
  title: 'Need something small?',
  description: 'One broken endpoint or a one-day integration is a normal engagement, not an inconvenience.',
  items: smallTasks.map((task) => ({ title: task.title, turnaround: task.turnaround })),
  more: { label: 'Ask about a task', href: '#contact' } satisfies LandingLink,
};

/* ───────────────────────────────── Process ──────────────────────────────── */

export interface ProcessStep {
  title: string;
  description: string;
  icon: IconName;
  output: string;
}

export const processIntro = {
  eyebrow: 'Process',
  title: 'From idea to production',
  description: 'The same four steps whether it is a one-day fix or a full platform — scaled to the work.',
};

export const processSteps: ProcessStep[] = [
  {
    title: 'Discover',
    description: 'Understand the problem, the users and the constraints, then agree a written scope.',
    icon: 'compass',
    output: 'Scope & assumptions',
  },
  {
    title: 'Architect',
    description: 'Design the data model, APIs, AI components and failure modes — trade-offs written down.',
    icon: 'pen-tool',
    output: 'Architecture notes',
  },
  {
    title: 'Build',
    description: 'Ship in reviewable increments with tests and traces, so the system works at every step.',
    icon: 'code',
    output: 'Working increments',
  },
  {
    title: 'Launch & Scale',
    description: 'Deploy with monitoring from day one, then measure, tune and scale what matters.',
    icon: 'rocket',
    output: 'Production + handover',
  },
];

/* ──────────────────────────── Ways to work together ──────────────────────── */

export const engagementIntro = {
  eyebrow: 'Engagement',
  title: 'Ways to work together',
  description: 'Pick the shape that fits the work. Every engagement ends with notes, not just code.',
};

const engagementIcons: IconName[] = ['target', 'rocket', 'infinity', 'search'];

export const engagements = engagementModels.map((model, index) => ({
  ...model,
  icon: engagementIcons[index] ?? 'target',
}));

/* ────────────────────────────────── About ───────────────────────────────── */

export const about = {
  eyebrow: 'About',
  title: 'Engineer first. Product-minded always.',
  paragraphs: [
    `I'm ${profile.name} — a senior engineer who builds AI products end to end: the model calls and agent loops, the backend that keeps them honest, and the interface people actually use.`,
    `For ${profile.yearsExperience} years I've designed and shipped production systems for startups and product teams, from a single broken endpoint to a full platform. I care about traces over guesses, boring infrastructure, and writing decisions down.`,
  ],
  facts: [
    { label: 'Based', value: profile.location, icon: 'map-pin' as IconName },
    { label: 'Focus', value: 'AI systems · backends · SaaS', icon: 'target' as IconName },
    { label: 'Engagements', value: 'Small fixes to full builds', icon: 'layers' as IconName },
    { label: 'Status', value: profile.availability.label, icon: 'clock' as IconName },
  ],
  /** Glyphs that orbit the portrait mark. */
  orbit: ['openai', 'python', 'react', 'postgresql', 'docker', 'claude', 'nextjs', 'redis'] as TechIconName[],
  secondaryCta: { label: 'See my experience', href: '#experience' } satisfies LandingLink,
  principlesTitle: 'Principles I work by',
  principles,
};

/* ─────────────────────────────────── FAQ ────────────────────────────────── */

export const faqIntro = {
  eyebrow: 'FAQ',
  title: 'Questions, answered',
  description: 'The things founders usually ask before getting in touch.',
};

export const faqs = serviceFaqs;

/* ───────────────────────────────── Contact ──────────────────────────────── */

export const contact = {
  eyebrow: 'Contact',
  title: "Let's build something",
  description:
    'Tell me what you need built, from a single broken endpoint to a full production AI system. Email is the quickest way to reach me.',
  availability: profile.availability.detail,
  /** What a useful first message includes. */
  checklist: [
    'What you need built or fixed',
    'Where it runs today, if it exists',
    'Rough timeline and constraints',
  ],
};

/* ──────────────────────────────── Final CTA ─────────────────────────────── */

export const finalCta = {
  lines: ["You've Read My Story.", 'Now Explore It.'],
  description: 'A fully interactive 3D world where my projects, systems and experience come to life.',
  cta: { label: 'Enter My Engineering City', href: worldHref() } satisfies LandingLink,
  secondary: { label: 'Or start a project', href: startProjectHref } satisfies LandingLink,
};

/* ────────────────────────────────── Footer ──────────────────────────────── */

export const footer = {
  role: 'Senior AI + Full-Stack Engineer',
  tagline: 'Building AI products, scalable backends and SaaS.',
  columns: [
    {
      label: 'Explore',
      items: [
        { label: 'Projects', href: '#projects' },
        { label: 'Experience', href: '#experience' },
        { label: 'Skills', href: '#skills' },
        { label: '3D World', href: worldHref() },
      ],
    },
    {
      label: 'Services',
      items: [
        { label: 'AI Development', href: '#services' },
        { label: 'SaaS Development', href: '#services' },
        { label: 'System Design', href: '#architecture' },
        { label: 'Small tasks', href: '#small-tasks' },
      ],
    },
  ] satisfies { label: string; items: LandingLink[] }[],
  availability: 'Available for Work',
};
