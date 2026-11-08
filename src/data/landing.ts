import type { IconName } from '@/components/landing/primitives/Icon';
import type { TechIconName } from '@/components/landing/primitives/techIconNames';
import { experience, principles } from '@/data/experience';
import { profile } from '@/data/profile';
import { engagementModels, smallTasks } from '@/data/services';
import { worldHref } from '@/data/universe';
import type { ArchitectureSpec } from '@/lib/types';

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
  profile.contact.telegram
    ? {
        label: 'Telegram',
        href: `https://t.me/${profile.contact.telegram}`,
        icon: 'telegram',
        external: true,
      }
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
  // Counted from the one figure in the profile, so the strip cannot drift from it.
  {
    icon: 'calendar',
    value: { count: Number.parseInt(profile.yearsExperience, 10), suffix: '+' },
    label: 'Years Experience',
  },
  { icon: 'layers', value: { count: 37, suffix: '+' }, label: 'Projects Delivered' },
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

/**
 * The Engineering Work Archive. Every statement here is either from the
 * project's own live site, from its repository, or from what Onyx has said
 * about his role. Nothing is estimated: no metrics, no invented duties.
 *
 *   `contribution` — Onyx's own part. Keep it to what he actually did.
 *   `engineering`  — verified from the code (Zypact, BPS) …
 *   `capabilities` — … or, where that isn't available, what the product does,
 *                    labelled as such on the page.
 */

export type ProjectVisualKind = 'agents' | 'rag' | 'vision';

/** The disciplines the archive shows, counted from the projects themselves. */
export const projectDisciplines = [
  { id: 'ai', label: 'AI / LLM', icon: 'sparkles' },
  { id: 'vision', label: 'Computer Vision', icon: 'target' },
  { id: 'saas', label: 'SaaS', icon: 'layers' },
  { id: 'backend', label: 'Backend', icon: 'server' },
  { id: 'data', label: 'Data / ML', icon: 'database' },
  { id: 'fullstack', label: 'Full-Stack', icon: 'monitor' },
  { id: 'php', label: 'PHP', icon: 'code' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type ProjectDiscipline = (typeof projectDisciplines)[number]['id'];

/** How a project is laid out in the archive; consecutive projects never share one. */
export type ProjectLayout = 'split' | 'split-reverse' | 'wide' | 'pair' | 'open-source';

export interface LandingProject {
  slug: string;
  name: string;
  /** Short category label shown beside the number, e.g. "AI · SaaS". */
  category: string;
  disciplines: ProjectDiscipline[];
  tagline: string;
  /** What the product does. */
  summary: string;
  /** What Onyx did on it. */
  contribution: string;
  /** Engineering verified from the codebase. */
  engineering?: string[];
  /** What the product does, for projects without verified engineering notes. */
  capabilities?: string[];
  stack: string[];
  href: string;
  host: string;
  layout: ProjectLayout;
  /** A screenshot of the live product, under /public/projects. */
  screenshot?: { src: string; alt: string };
  /** An animated illustration (ProjectVisual). */
  visual?: ProjectVisualKind;
  /** Set for open-source products Onyx worked with but did not create. */
  openSource?: { platform: string };
  /** The system diagram the 3D world's hologram draws, where the architecture is known. */
  architecture?: ArchitectureSpec;
}

export const archiveProjects: LandingProject[] = [
  {
    slug: 'zypact',
    name: 'Zypact',
    category: 'AI · SaaS',
    disciplines: ['ai', 'saas', 'backend'],
    tagline: 'Turn AI answers into evidence.',
    summary:
      'An evidence-backed diagnostic for B2B SaaS teams. It records how Perplexity answers a buyer question that matters commercially, preserves exactly what came back, then asks the same question again after one registered change. The result is an Outcome Card: increase observed, decrease observed, no clear change, or inconclusive.',
    contribution: 'I built Zypact: the web service, its scan and evidence pipeline, and the worker infrastructure behind it.',
    engineering: [
      'Perplexity Sonar integration with explicit protocol approval, admission control and a reservation before every paid call',
      'Evidence stored as the exact provider request and response, with hashes and immutability enforced by the database',
      'A PostgreSQL-backed worker claim queue with leases, fencing, idempotency and recovery',
      'One canonical evidence snapshot behind the dashboard, reports, exports and Outcome Card',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Supabase / PostgreSQL', 'Perplexity Sonar', 'Fly.io workers'],
    href: 'https://zypact.com',
    host: 'zypact.com',
    layout: 'split',
    screenshot: { src: '/projects/zypact.jpg', alt: 'The Zypact homepage' },
    visual: 'rag',
    architecture: {
      layers: [
        { label: 'Client', nodes: [{ id: 'web', label: 'Web App', detail: 'Next.js' }] },
        {
          label: 'Service',
          nodes: [
            { id: 'api', label: 'Scan API', detail: 'Next.js' },
            { id: 'admit', label: 'Admission', detail: 'approval · reservation', tone: 'accent' },
          ],
        },
        {
          label: 'Workers',
          nodes: [
            { id: 'queue', label: 'Claim Queue', detail: 'Postgres leases' },
            { id: 'worker', label: 'Worker', detail: 'Fly.io', tone: 'accent' },
          ],
        },
        {
          label: 'Evidence',
          nodes: [
            { id: 'sonar', label: 'Perplexity Sonar', detail: 'provider' },
            { id: 'store', label: 'Evidence Store', detail: 'hashed · immutable' },
            { id: 'snapshot', label: 'Snapshot', detail: 'Outcome Card', tone: 'accent' },
          ],
        },
      ],
      edges: [
        { from: 'web', to: 'api', label: 'scan' },
        { from: 'api', to: 'admit' },
        { from: 'admit', to: 'queue', label: 'enqueue' },
        { from: 'queue', to: 'worker', label: 'claim' },
        { from: 'worker', to: 'sonar', label: 'ask' },
        { from: 'worker', to: 'store', label: 'record' },
        { from: 'store', to: 'snapshot' },
        { from: 'snapshot', to: 'web', label: 'report' },
      ],
      // Timings only pace the animation; none are shown or claimed.
      paths: [
        {
          label: 'Scan',
          steps: ['web', 'api', 'admit', 'queue', 'worker', 'store', 'snapshot'],
          latencies: [0, 0, 0, 0, 0, 0, 0],
        },
      ],
    },
  },
  {
    slug: 'bps-pro',
    name: 'BPS Pro-Score',
    category: 'Computer Vision',
    disciplines: ['vision'],
    tagline: 'One camera. Every pool table. Zero equipment changes.',
    summary:
      'A pool scoring system. Point a fixed overhead camera at the table, or hand it a recorded clip, and it finds the balls, tracks them, works out which is which, applies the league rules and draws the scoreboard. No changes to the table are needed.',
    contribution: 'I built the vision pipeline in Python and OpenCV.',
    engineering: [
      'Detection that models the felt, a single colour, and keeps whatever is not felt: steadier than describing fifteen ball colours, and no model weights to ship',
      'Ball tracking and identity across frames, feeding a rules engine that scores the game',
      'A calibration flow that measures the table and fits the six pockets to each camera or clip',
      'Runs offline on Raspberry Pi, Windows and macOS, with machine licences and a build manifest signed with Ed25519',
    ],
    stack: ['Python', 'OpenCV', 'NumPy', 'Raspberry Pi', 'Ed25519 licensing'],
    href: 'https://bpspro.co',
    host: 'bpspro.co',
    layout: 'split-reverse',
    screenshot: { src: '/projects/bps-pro.jpg', alt: 'The BPS Pro-Score homepage' },
    visual: 'vision',
    architecture: {
      layers: [
        { label: 'Input', nodes: [{ id: 'camera', label: 'Overhead Camera', detail: 'or a recorded clip' }] },
        {
          label: 'Vision',
          nodes: [
            { id: 'felt', label: 'Felt Model', detail: 'OpenCV' },
            { id: 'tracker', label: 'Tracker', detail: 'ball identity', tone: 'accent' },
          ],
        },
        {
          label: 'Logic',
          nodes: [
            { id: 'calibration', label: 'Calibration', detail: 'table · pockets' },
            { id: 'rules', label: 'Rules Engine', detail: 'league rules', tone: 'accent' },
          ],
        },
        {
          label: 'Output',
          nodes: [
            { id: 'scoreboard', label: 'Scoreboard', detail: 'live score' },
            { id: 'device', label: 'Offline Device', detail: 'Raspberry Pi · Ed25519' },
          ],
        },
      ],
      edges: [
        { from: 'camera', to: 'felt', label: 'frames' },
        { from: 'calibration', to: 'felt', label: 'table geometry' },
        { from: 'felt', to: 'tracker', label: 'balls' },
        { from: 'tracker', to: 'rules', label: 'events' },
        { from: 'rules', to: 'scoreboard' },
        { from: 'device', to: 'camera' },
      ],
      paths: [
        {
          label: 'Frame',
          steps: ['camera', 'felt', 'tracker', 'rules', 'scoreboard'],
          latencies: [0, 0, 0, 0, 0],
        },
      ],
    },
  },
  {
    slug: 'xdial',
    name: 'xDial AI',
    category: 'AI Agent · SaaS',
    disciplines: ['ai', 'saas'],
    tagline: "Skip the phone tree. We'll do it.",
    summary:
      'An AI call assistant. It phones a company for you, works through the automated menu, presses the right keys and waits on hold, then alerts you when a live agent picks up. Each menu it navigates is mapped into a visual phone tree that later calls reuse.',
    contribution: 'An AI product I worked on: the AI calling assistant.',
    capabilities: [
      'Phone-menu (IVR) navigation that presses the right keys automatically',
      'Open-ended requests such as “I need refund support”, with real-time transcription',
      'Hold-for-me: waits in the background and alerts you when a person joins',
      'Phone trees mapped once and cached, so the next call routes in one tap',
    ],
    stack: ['LLM', 'Twilio', 'Firebase', 'Stripe'],
    href: 'https://xdial.ai',
    host: 'xdial.ai',
    layout: 'wide',
    screenshot: { src: '/projects/xdial.jpg', alt: 'The xDial AI homepage' },
    visual: 'agents',
  },
  {
    slug: 'bioreact',
    name: 'BioReact',
    category: 'AI · Data Platform',
    disciplines: ['ai', 'saas', 'data'],
    tagline: 'Shedding light on your data.',
    summary:
      'AI-powered bioprocess optimisation for scientists. BioReact unifies fermentation and bioprocess data, finds the process variables that drive performance, and simulates conditions before a single experiment is run.',
    contribution: 'A project I worked on: the BioReact web platform.',
    capabilities: [
      'Data unified from lab equipment and ELNs, with online and offline time series aligned automatically',
      'Statistical analysis: PCA, ANOVA, factor importance and variation analysis',
      'AI/ML simulations that predict growth, yield and viability conditions in silico',
      'Visualisations such as heatmaps and box plots to spot the variables that matter',
    ],
    stack: ['Next.js', 'React', 'AI / ML'],
    href: 'https://www.bioreact.co/',
    host: 'bioreact.co',
    layout: 'split',
    screenshot: { src: '/projects/bioreact.jpg', alt: 'The BioReact homepage' },
  },
  {
    slug: 'fanforge',
    name: 'FanForge',
    category: 'Full-Stack',
    disciplines: ['fullstack'],
    tagline: 'A creator-first marketplace.',
    summary:
      'Official and fan-made merch in one place. Independent sellers list products, and buyers browse by category and support creators with no platform fee.',
    contribution: 'Full-stack development of the marketplace.',
    capabilities: [
      'Product listings from independent sellers',
      'Category browsing, search and filters',
      'Accounts, sign-in and a cart',
    ],
    stack: ['React', 'Vite'],
    href: 'https://www.fanforgecf.com/',
    host: 'fanforgecf.com',
    layout: 'pair',
    screenshot: { src: '/projects/fanforge.jpg', alt: 'The FanForge marketplace homepage' },
  },
  {
    slug: 'tranga-pods',
    name: 'Tranga Pods',
    category: 'Full-Stack',
    disciplines: ['fullstack'],
    tagline: 'Curate, transact, retain.',
    summary:
      'The web platform for Tranga’s micro-retail pods, which turn unused venue space into revenue: a Convenience Pod and a Fragrance Pod, with contactless payment and sales insight for venues.',
    contribution: 'Full-stack development of the Tranga Pods site.',
    capabilities: [
      'Product stories for both pod lines',
      'How-it-works, partnership and venue enquiry flows',
      'Contact and customer support',
    ],
    stack: [],
    href: 'https://www.trangapods.com/',
    host: 'trangapods.com',
    layout: 'pair',
    screenshot: { src: '/projects/tranga-pods.jpg', alt: 'The Tranga Pods homepage' },
  },
  {
    slug: 'dolibarr',
    name: 'Dolibarr',
    category: 'PHP · ERP / CRM',
    disciplines: ['php'],
    tagline: 'PHP work on an open-source ERP & CRM.',
    summary:
      'Dolibarr is a community-maintained, open-source ERP and CRM written in PHP, covering customers, proposals, orders, invoices, stock and projects.',
    contribution: 'PHP development work on Dolibarr.',
    stack: ['PHP', 'MySQL'],
    href: 'https://www.dolibarr.org/',
    host: 'dolibarr.org',
    layout: 'open-source',
    openSource: { platform: 'Open-source ERP & CRM' },
  },
  {
    slug: 'kanboard',
    name: 'Kanboard',
    category: 'PHP · Project Management',
    disciplines: ['php'],
    tagline: 'PHP work on an open-source Kanban tool.',
    summary:
      'Kanboard is a community-maintained, open-source project-management tool written in PHP, built around Kanban boards, with plugins and a JSON-RPC API.',
    contribution: 'PHP development work on Kanboard.',
    stack: ['PHP', 'JSON-RPC'],
    href: 'https://kanboard.org/',
    host: 'kanboard.org',
    layout: 'open-source',
    openSource: { platform: 'Open-source Kanban' },
  },
];

/** The anchor each project's section carries, for the index's jump links. */
export const projectAnchor = (slug: string) => `work-${slug}`;

/** Disciplines with the number of projects in each, leaving out any with none. */
export const disciplineCounts = projectDisciplines
  .map((discipline) => ({
    ...discipline,
    count: archiveProjects.filter((project) => project.disciplines.includes(discipline.id)).length,
  }))
  .filter((discipline) => discipline.count > 0);

export const projectsIntro = {
  eyebrow: 'Projects',
  title: 'Engineering Work Archive',
  description: `${archiveProjects.length} real projects across AI systems, computer vision, SaaS platforms, full-stack products and PHP.`,
  indexTitle: 'Project Index',
};

/* ──────────────────────────────── Experience ────────────────────────────── */

export interface TimelineEntry {
  /** Year range for the pill and the summit milestone, e.g. "2022 – 2025". */
  period: string;
  company: string;
  role: string;
  /** Exact months, shown beside the role. */
  dates: string;
  location: string;
  summary: string;
  highlights: string[];
  tech: string[];
  current?: boolean;
}

export const experienceIntro = {
  title: 'Experience',
  accent: `${profile.yearsExperience} Years`,
  description:
    'Developer platforms, real-time event pipelines and high-throughput APIs at Instagram, Amazon and TikTok.',
  more: { label: 'How I work', href: '#about' } satisfies LandingLink,
};

/** The homepage timeline, read from the one career record in experience.ts. */
export const timeline: TimelineEntry[] = experience.map((entry) => ({
  period: entry.years,
  company: entry.organisation,
  role: entry.role,
  dates: entry.period,
  location: entry.location,
  summary: entry.summary,
  highlights: entry.highlights.slice(0, 3),
  tech: entry.stack,
}));

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
