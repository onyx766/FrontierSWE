import type { EngagementModel, Service, SmallTask } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVICES
 * ─────────────────────────────────────────────────────────────────────────────
 * Written as things a client can buy, not as a skills list. `typicalScope` is
 * an honest range rather than a price — adjust to match how you actually work.
 */

export const services: Service[] = [
  {
    id: 'ai-llm-engineering',
    title: 'AI / LLM Engineering',
    domain: 'ai-systems',
    summary:
      'LLM features built to survive production traffic: streaming, structured output, cost and latency budgets, evaluation before deployment.',
    deliverables: [
      'Model access behind a provider-agnostic interface',
      'Streaming responses with cancellation and partial persistence',
      'Structured output with schema validation and repair',
      'Token, cost and latency budgets with monitoring',
      'Evaluation set and regression suite running in CI',
    ],
    typicalScope: '2 — 8 weeks',
  },
  {
    id: 'backend-api-development',
    title: 'Backend & API Development',
    domain: 'core-engine',
    summary:
      'FastAPI and Node.js services with versioned contracts, typed boundaries, authentication and background work designed in from the start.',
    deliverables: [
      'REST API with an OpenAPI schema generated from the code',
      'Authentication, roles and tenant scoping',
      'Validation at every boundary with consistent error shapes',
      'Background jobs on a real queue with retries and dead-letter handling',
      'Test suite covering the contract, not just the units',
    ],
    typicalScope: '2 — 10 weeks',
  },
  {
    id: 'saas-development',
    title: 'SaaS Development',
    domain: 'core-engine',
    summary:
      'The foundation a SaaS product needs before features: tenancy, auth, roles, billing hooks, usage metering and an admin surface.',
    deliverables: [
      'Multi-tenant data model with enforced isolation',
      'Auth, sessions, OAuth sign-in and API keys',
      'Permission matrix shared across API and UI',
      'Subscription and usage metering wired to a billing provider',
      'Admin console for support and plan management',
    ],
    typicalScope: '4 — 12 weeks',
  },
  {
    id: 'ai-agent-development',
    title: 'AI Agent Development',
    domain: 'ai-systems',
    summary:
      'Agents that do multi-step work with typed tools, hard budgets, idempotent side effects and a full trace of every decision.',
    deliverables: [
      'Agent runtime with an explicit, resumable step loop',
      'Tool registry with schemas shared by the model and the handler',
      'Step, time and token budgets per run',
      'Append-only execution traces for replay and debugging',
      'Streaming progress to the client while a run is in flight',
    ],
    typicalScope: '3 — 10 weeks',
  },
  {
    id: 'rag-systems',
    title: 'RAG Systems',
    domain: 'ai-systems',
    summary:
      'Retrieval over your own content: ingestion, hybrid search, reranking, citations, and recall measured rather than assumed.',
    deliverables: [
      'Ingestion pipeline with structure-aware chunking',
      'Hybrid vector plus keyword retrieval with rank fusion',
      'Reranking and citation of exact source passages',
      'Evaluation harness reporting recall and citation accuracy',
      'Versioned indexes with zero-downtime re-indexing',
    ],
    typicalScope: '3 — 8 weeks',
  },
  {
    id: 'api-integrations',
    title: 'Third-Party API Integrations',
    domain: 'core-engine',
    summary:
      'Payment, CRM, email, vendor and AI provider APIs wrapped behind an interface you own — with retries, webhooks and replay safety.',
    deliverables: [
      'Adapter layer isolating your domain from the vendor model',
      'Retries, backoff and rate-limit handling',
      'Signed, deduplicated, replay-safe webhook handlers',
      'Sandbox and production configuration separated',
      'Integration tests against recorded vendor responses',
    ],
    typicalScope: '1 — 4 weeks',
  },
  {
    id: 'database-architecture',
    title: 'Database Architecture',
    domain: 'data',
    summary:
      'PostgreSQL schema design, migrations that are safe against live data, caching with a real invalidation story, and queues with back-pressure.',
    deliverables: [
      'Schema with the constraints and indexes the product actually needs',
      'Expand-and-contract migrations safe to run live',
      'Redis caching strategy per access pattern',
      'Durable job queues with retries and visibility',
      'Documented data model and ownership boundaries',
    ],
    typicalScope: '1 — 6 weeks',
  },
  {
    id: 'realtime-systems',
    title: 'Realtime Systems',
    domain: 'realtime',
    summary:
      'WebSocket and streaming features that scale past one instance, survive reconnects, and reconcile state rather than hoping.',
    deliverables: [
      'Authenticated WebSocket gateway with channel authorisation',
      'Horizontal fan-out so any instance serves any client',
      'Replay from cursor after a disconnect',
      'Transactional outbox so state and events cannot diverge',
      'Client library with backoff and idempotent application',
    ],
    typicalScope: '2 — 8 weeks',
  },
  {
    id: 'performance-scalability',
    title: 'Performance & Scalability',
    domain: 'data',
    summary:
      'Finding the real cause of slowness with evidence, fixing it at the root, and leaving monitoring behind so it stays fixed.',
    deliverables: [
      'Queries ranked by total time, with plans analysed',
      'Index, query and access-pattern fixes',
      'N+1 patterns removed at the application layer',
      'Caching where invalidation is well defined',
      'Dashboards and regression alerts',
    ],
    typicalScope: '1 — 4 weeks',
  },
  {
    id: 'debugging-existing-apps',
    title: 'Debugging Existing Applications',
    domain: 'core-engine',
    summary:
      'Dropping into an unfamiliar codebase, reproducing the bug, fixing the cause rather than the symptom, and writing the test that keeps it fixed.',
    deliverables: [
      'Reproduction of the failure, documented',
      'Root-cause analysis rather than a symptom patch',
      'Minimal, reviewable fix',
      'Regression test covering the failure',
      'Written notes on anything adjacent that is likely to break next',
    ],
    typicalScope: '1 day — 2 weeks',
  },
  {
    id: 'deployment-production',
    title: 'Deployment / Production Problems',
    domain: 'infrastructure',
    summary:
      'Getting an application deployed properly, or fixing one that is misbehaving in production — containers, CI/CD, monitoring, incidents.',
    deliverables: [
      'Multi-stage Dockerfiles and a working Compose setup',
      'CI/CD pipeline that type-checks, tests, builds and deploys',
      'Migrations applied in a controlled, reversible step',
      'Structured logs, error tracking and uptime alerting',
      'Diagnosis and fix for the live issue, with notes',
    ],
    typicalScope: '2 days — 4 weeks',
  },
  {
    id: 'mvp-development',
    title: 'MVP Development',
    domain: 'frontend',
    summary:
      'Taking an idea to a working product that real users can use — scoped so the first version ships, built so the second is not a rewrite.',
    deliverables: [
      'Scope cut to what proves the idea',
      'Next.js frontend with a typed API behind it',
      'Auth, data model and the core flow end to end',
      'Deployed with monitoring from day one',
      'Handover notes and a clear path to version two',
    ],
    typicalScope: '3 — 10 weeks',
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SMALL ENGINEERING TASKS
 * ─────────────────────────────────────────────────────────────────────────────
 * Deliberately prominent. A founder with one broken endpoint should see
 * immediately that this is work you will take.
 */

export const smallTasks: SmallTask[] = [
  {
    title: 'Fix a backend or API problem',
    description:
      'An endpoint returning the wrong thing, failing under load, or breaking on an edge case. Reproduced, fixed at the cause, covered by a test.',
    turnaround: '1 — 3 days',
  },
  {
    title: 'Build an API integration',
    description:
      'Connect a third-party service properly — auth, retries, webhook verification, error handling — rather than a fetch call that works once.',
    turnaround: '2 — 5 days',
  },
  {
    title: 'Add OpenAI or Claude functionality',
    description:
      'A model-powered feature added to an existing application: streaming, structured output, cost control and sensible failure behaviour.',
    turnaround: '2 — 5 days',
  },
  {
    title: 'Fix a Next.js issue',
    description:
      'Hydration errors, server and client boundary problems, caching and revalidation behaving unexpectedly, build failures, slow routes.',
    turnaround: '1 — 3 days',
  },
  {
    title: 'Build a FastAPI or Node.js endpoint',
    description:
      'A new endpoint done properly: validation, auth, error shape, tests and documentation that matches the implementation.',
    turnaround: '1 — 2 days',
  },
  {
    title: 'Fix a PostgreSQL performance problem',
    description:
      'A slow query or page. Measured with EXPLAIN ANALYZE, fixed with the right index or rewrite, verified against a realistic workload.',
    turnaround: '1 — 4 days',
  },
  {
    title: 'Deploy or fix a production application',
    description:
      'Get it deployed, containerised and monitored — or diagnose why the live version is failing, restarting or timing out.',
    turnaround: '1 — 5 days',
  },
];

export const engagementModels: EngagementModel[] = [
  {
    title: 'Fixed-scope task',
    description:
      'A defined piece of work with a clear finish line. Scoped up front, delivered as a reviewable change with tests and notes.',
    bestFor: 'Bugs, integrations, single endpoints, performance fixes',
  },
  {
    title: 'Project build',
    description:
      'Designing and building a system end to end, in reviewable increments, with architecture decisions written down as they are made.',
    bestFor: 'New AI systems, backends, SaaS foundations, MVPs',
  },
  {
    title: 'Ongoing engineering',
    description:
      'A recurring block of time per week as the senior engineer on an existing product — features, reviews, architecture, incidents.',
    bestFor: 'Teams without a senior backend or AI engineer',
  },
  {
    title: 'Technical review',
    description:
      'Reading an existing codebase and infrastructure and reporting back on risk, architecture and the highest-value next changes.',
    bestFor: 'Due diligence, inherited codebases, pre-scale checks',
  },
];

/** Anticipates the questions a founder asks before they get in touch. */
export const serviceFaqs: { question: string; answer: string }[] = [
  {
    question: 'Will you take a small, one-off task?',
    answer:
      'Yes — that is what the small tasks section above is for. A single broken endpoint or a one-day integration is a normal engagement, not an inconvenience.',
  },
  {
    question: 'Can you work on an existing codebase you did not write?',
    answer:
      'Most of this work is exactly that. The first step is reproducing the problem and reading enough of the surrounding code to fix the cause rather than the symptom.',
  },
  {
    question: 'How do you handle scope that is still vague?',
    answer:
      'A short scoping conversation first, then a written scope with what is included, what is not, and the assumptions it depends on. Building starts once that is agreed.',
  },
  {
    question: 'What do you need from me to start?',
    answer:
      'A description of the problem, access to the repository or a representative example, and whatever currently runs in production. Anything missing, we work out together.',
  },
  {
    question: 'Do you work with existing engineering teams?',
    answer:
      'Yes — as an additional senior engineer in your process: your repository, your review workflow, your standards.',
  },
  {
    question: 'What happens at the end of an engagement?',
    answer:
      'Handover notes covering architecture, decisions, operational details and known rough edges. Nothing important should live only in my head.',
  },
];
