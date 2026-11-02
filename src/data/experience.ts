import type { ExperienceEntry, StackGroup } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPERIENCE  —  PLACEHOLDER TIMELINE
 * ─────────────────────────────────────────────────────────────────────────────
 * No employer, client or company name is invented here. `organisation` is a
 * generic descriptor and every entry is flagged `placeholder: true`, which
 * renders a visible PLACEHOLDER chip on /experience.
 *
 * TO MAKE THIS REAL: replace `role`, `organisation`, `period`, `summary` and
 * `highlights` with your actual history, then set `placeholder: false`.
 */

export const experience: ExperienceEntry[] = [
  {
    id: 'current',
    role: 'Senior AI / Full-Stack Engineer',
    organisation: '[PLACEHOLDER] Independent — client engagements',
    period: '[PLACEHOLDER] Present',
    summary:
      'Designing and building production AI systems, backend services and SaaS platforms for startups and product teams — from a single endpoint through to full system architecture.',
    highlights: [
      'LLM applications with streaming, structured output, evaluation and cost control',
      'Agent runtimes with typed tool calling, budgets and full execution traces',
      'RAG systems with hybrid retrieval, reranking and measured recall',
      'FastAPI and Node.js services with versioned contracts and typed boundaries',
      'Deployment, monitoring and production troubleshooting',
    ],
    stack: ['Python', 'FastAPI', 'TypeScript', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS'],
    domains: ['ai-systems', 'core-engine', 'infrastructure'],
    placeholder: true,
  },
  {
    id: 'senior-fullstack',
    role: 'Senior Full-Stack Engineer',
    organisation: '[PLACEHOLDER] Product company',
    period: '[PLACEHOLDER] Previous',
    summary:
      'Owned backend and frontend architecture for a multi-tenant SaaS product: tenancy and permissions, API design, data modelling and the React/Next.js product surface.',
    highlights: [
      'Multi-tenant data model with structurally enforced isolation',
      'Authentication, roles and a permission matrix shared across API and UI',
      'Usage metering accurate enough to bill from',
      'Next.js App Router migration with server components by default',
      'Query optimisation and caching as the dataset grew',
    ],
    stack: ['TypeScript', 'Node.js', 'React', 'Next.js', 'PostgreSQL', 'Redis', 'Prisma'],
    domains: ['core-engine', 'data', 'frontend'],
    placeholder: true,
  },
  {
    id: 'backend-engineer',
    role: 'Backend Engineer',
    organisation: '[PLACEHOLDER] Engineering team',
    period: '[PLACEHOLDER] Earlier',
    summary:
      'Built and operated Python backend services and the realtime layer behind them: APIs, queues, WebSocket fan-out and the deployment pipeline that shipped them.',
    highlights: [
      'REST APIs with generated schemas and contract tests',
      'Background job pipelines with retries and dead-letter handling',
      'WebSocket fan-out across multiple instances via Redis pub/sub',
      'Containerisation and CI/CD for repeatable deploys',
      'On-call: incident diagnosis, slow queries, memory and connection leaks',
    ],
    stack: ['Python', 'FastAPI', 'Celery', 'PostgreSQL', 'Redis', 'WebSockets', 'Docker'],
    domains: ['core-engine', 'realtime', 'infrastructure'],
    placeholder: true,
  },
  {
    id: 'fullstack-engineer',
    role: 'Full-Stack Engineer',
    organisation: '[PLACEHOLDER] Early career',
    period: '[PLACEHOLDER] Earliest',
    summary:
      'Shipped features across the stack on web products — JavaScript and TypeScript frontends, Node and Python backends, relational data models.',
    highlights: [
      'Feature delivery end to end, from schema to interface',
      'Moved a growing JavaScript codebase onto TypeScript',
      'First exposure to production operations and on-call',
      'Third-party integrations: payments, email, analytics',
    ],
    stack: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'PostgreSQL'],
    domains: ['frontend', 'core-engine'],
    placeholder: true,
  },
];

/**
 * Capability matrix. `depth` is 1–5 and drives the depth bars on /experience.
 * These are self-assessed — adjust them to be honest about your own level.
 */
export const stackGroups: StackGroup[] = [
  {
    label: 'AI Systems',
    domain: 'ai-systems',
    items: [
      { name: 'OpenAI API', depth: 5 },
      { name: 'Claude API', depth: 5 },
      { name: 'Tool calling', depth: 5 },
      { name: 'RAG', depth: 5 },
      { name: 'AI agents', depth: 4 },
      { name: 'Embeddings', depth: 4 },
      { name: 'Evaluation', depth: 4 },
      { name: 'Prompt engineering', depth: 4 },
    ],
  },
  {
    label: 'Backend',
    domain: 'core-engine',
    items: [
      { name: 'Python', depth: 5 },
      { name: 'FastAPI', depth: 5 },
      { name: 'Node.js', depth: 5 },
      { name: 'TypeScript', depth: 5 },
      { name: 'REST APIs', depth: 5 },
      { name: 'System design', depth: 4 },
      { name: 'Auth / OAuth', depth: 4 },
      { name: 'Testing', depth: 4 },
    ],
  },
  {
    label: 'Data',
    domain: 'data',
    items: [
      { name: 'PostgreSQL', depth: 5 },
      { name: 'Redis', depth: 5 },
      { name: 'Query tuning', depth: 4 },
      { name: 'pgvector', depth: 4 },
      { name: 'Queues', depth: 4 },
      { name: 'Data modelling', depth: 4 },
    ],
  },
  {
    label: 'Realtime',
    domain: 'realtime',
    items: [
      { name: 'WebSockets', depth: 5 },
      { name: 'SSE / streaming', depth: 4 },
      { name: 'Pub/sub fan-out', depth: 4 },
      { name: 'Event-driven design', depth: 4 },
    ],
  },
  {
    label: 'Infrastructure',
    domain: 'infrastructure',
    items: [
      { name: 'Docker', depth: 5 },
      { name: 'AWS', depth: 4 },
      { name: 'CI/CD', depth: 4 },
      { name: 'Monitoring', depth: 4 },
      { name: 'Linux', depth: 4 },
      { name: 'Terraform', depth: 3 },
    ],
  },
  {
    label: 'Frontend',
    domain: 'frontend',
    items: [
      { name: 'React', depth: 5 },
      { name: 'Next.js', depth: 5 },
      { name: 'TypeScript', depth: 5 },
      { name: 'Tailwind CSS', depth: 4 },
      { name: 'Accessibility', depth: 4 },
      { name: 'Web performance', depth: 4 },
    ],
  },
];

/** How you work. Opinions, not credentials — this is what a founder is buying. */
export const principles: { title: string; body: string }[] = [
  {
    title: 'Measure before optimising',
    body: 'Performance work without evidence reliably improves the wrong thing. Rank by total cost, read the plan, then change one thing and verify it.',
  },
  {
    title: 'Make the unsafe path unavailable',
    body: 'Correctness that depends on everyone remembering a rule fails eventually. Where it matters — tenant scoping, validation, idempotency — the wrong way should not compile.',
  },
  {
    title: 'Boring infrastructure, interesting product',
    body: 'Novelty belongs in the thing the user pays for. Deployment, queues and caching should be unremarkable and well understood.',
  },
  {
    title: 'Traces over guesses',
    body: 'An AI system that cannot be inspected step by step cannot be debugged. Execution traces are a feature, not logging.',
  },
  {
    title: 'Write the decision down',
    body: 'Every non-obvious choice gets a short note on why, and what was traded away. It is how a system stays maintainable after the person who built it leaves.',
  },
  {
    title: 'Ship in reviewable increments',
    body: 'Long-lived branches hide risk. Small changes that each leave the system working are faster in practice and far easier to roll back.',
  },
];
