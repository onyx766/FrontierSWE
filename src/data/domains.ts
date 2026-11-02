import type { Domain, DomainId, TopologyLink, TopologyNode } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE NETWORK
 * ─────────────────────────────────────────────────────────────────────────────
 * Six domains are the site's single taxonomy. They are the nodes on the
 * homepage, the filters on /projects, the categories on /services and the tags
 * on /experience. Add a domain here and it propagates everywhere.
 *
 * Positions are polar: `angle` in degrees (0 = east, 90 = south in SVG space),
 * `radius` normalised 0–1 from the centre. `depth` drives pointer parallax.
 */

export const topologyNodes: TopologyNode[] = [
  {
    id: 'core-engine',
    label: 'Core Engine',
    kind: 'core',
    angle: 0,
    radius: 0,
    depth: 0.25,
    spineOrder: 0,
  },
  {
    id: 'ai-systems',
    label: 'AI Systems',
    kind: 'domain',
    angle: -90,
    radius: 0.92,
    depth: 1,
    spineOrder: 1,
  },
  {
    id: 'data',
    label: 'Data',
    kind: 'domain',
    angle: 0,
    radius: 1,
    depth: 0.85,
    spineOrder: 3,
  },
  {
    id: 'frontend',
    label: 'Frontend',
    kind: 'domain',
    angle: 180,
    radius: 1,
    depth: 0.85,
    spineOrder: 2,
  },
  {
    id: 'realtime',
    label: 'Realtime',
    kind: 'domain',
    angle: 123,
    radius: 0.95,
    depth: 0.7,
    spineOrder: 4,
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    kind: 'domain',
    angle: 57,
    radius: 0.95,
    depth: 0.7,
    spineOrder: 5,
  },
];

export const topologyLinks: TopologyLink[] = [
  { id: 'fe-core', from: 'frontend', to: 'core-engine', kind: 'request', weight: 3, curve: 26 },
  { id: 'core-data', from: 'core-engine', to: 'data', kind: 'data', weight: 3, curve: -26 },
  { id: 'core-ai', from: 'core-engine', to: 'ai-systems', kind: 'request', weight: 3, curve: 20 },
  { id: 'core-rt', from: 'core-engine', to: 'realtime', kind: 'event', weight: 2, curve: -18 },
  { id: 'core-infra', from: 'core-engine', to: 'infrastructure', kind: 'event', weight: 2, curve: 18 },
  { id: 'ai-data', from: 'ai-systems', to: 'data', kind: 'data', weight: 2, curve: 78 },
  { id: 'rt-data', from: 'realtime', to: 'data', kind: 'data', weight: 1, curve: -92 },
  { id: 'infra-ai', from: 'infrastructure', to: 'ai-systems', kind: 'event', weight: 1, curve: -86 },
  { id: 'fe-rt', from: 'frontend', to: 'realtime', kind: 'event', weight: 2, curve: 54 },
];

export const domains: Record<DomainId, Domain> = {
  'core-engine': {
    id: 'core-engine',
    label: 'Core Engine',
    title: 'Core Engine',
    tagline: 'Backend services, API architecture and system design.',
    summary:
      'The service layer everything else depends on: HTTP and async APIs, domain boundaries, authentication, background work and third-party integrations. The goal is a backend that stays understandable at the tenth feature, not just the first — explicit contracts, typed boundaries, and failure handling designed in rather than bolted on.',
    capabilities: [
      {
        title: 'API architecture',
        description:
          'REST and RPC-style APIs with versioned contracts, consistent error shapes, pagination, idempotency keys and OpenAPI schemas generated from the code rather than maintained beside it.',
      },
      {
        title: 'FastAPI services',
        description:
          'Async Python services with Pydantic models at every boundary, dependency-injected sessions and clients, structured logging, and background tasks moved onto a real queue once they outgrow the request cycle.',
      },
      {
        title: 'Node.js / TypeScript services',
        description:
          'Typed Node services and Next.js route handlers sharing validation schemas with the frontend, so a contract change surfaces as a type error instead of a production incident.',
      },
      {
        title: 'System design',
        description:
          'Service boundaries, data ownership, sync-versus-async decisions, and the sequencing that lets a system be extracted later without a rewrite now.',
      },
      {
        title: 'Authentication & authorisation',
        description:
          'Session and token auth, OAuth flows, refresh rotation, API keys for machine clients, role and tenant scoping enforced at the data layer rather than the controller.',
      },
      {
        title: 'Third-party integrations',
        description:
          'Payment, CRM, email and vendor APIs wrapped behind an interface you own, with retries, backoff, webhook verification and replay-safe handlers.',
      },
    ],
    stack: [
      'Python',
      'FastAPI',
      'Pydantic',
      'Node.js',
      'TypeScript',
      'REST',
      'OpenAPI',
      'OAuth 2.0',
      'Celery / RQ',
      'pytest',
    ],
    subArchitecture: {
      nodes: [
        { id: 'client', label: 'Clients', column: 0, row: 0, tone: 'muted' },
        { id: 'gateway', label: 'API Gateway', column: 1, row: 0 },
        { id: 'auth', label: 'Auth / Sessions', column: 1, row: 1 },
        { id: 'api', label: 'FastAPI · Node', column: 2, row: 0, tone: 'accent' },
        { id: 'domain', label: 'Domain Services', column: 2, row: 1 },
        { id: 'integrations', label: 'Integrations', column: 3, row: 0 },
        { id: 'workers', label: 'Workers / Jobs', column: 3, row: 1 },
      ],
      edges: [
        { from: 'client', to: 'gateway', label: 'HTTPS' },
        { from: 'gateway', to: 'auth' },
        { from: 'gateway', to: 'api' },
        { from: 'api', to: 'domain' },
        { from: 'api', to: 'integrations' },
        { from: 'domain', to: 'workers', label: 'enqueue' },
      ],
    },
  },

  'ai-systems': {
    id: 'ai-systems',
    label: 'AI Systems',
    title: 'AI Systems',
    tagline: 'LLM applications, agents, RAG and tool calling in production.',
    summary:
      'LLM features that survive real traffic. That means retrieval you can inspect, tool calls that are validated and bounded, prompts under version control, evaluation before deployment, and cost and latency treated as first-class constraints. A demo and a production AI system are different engineering problems; this is the second one.',
    capabilities: [
      {
        title: 'LLM application engineering',
        description:
          'Model calls behind a provider-agnostic interface, streaming responses, structured output with schema validation and repair, token budgeting, caching and graceful degradation when a provider is slow or down.',
      },
      {
        title: 'AI agents & tool calling',
        description:
          'Agent loops with typed tool definitions, argument validation, permission boundaries, step limits, idempotent side effects and full traces of every decision — so behaviour can be debugged instead of guessed at.',
      },
      {
        title: 'RAG systems',
        description:
          'Document ingestion and chunking, embedding pipelines, hybrid vector plus keyword retrieval, reranking, citation of sources, and recall measured against a fixed question set rather than assumed.',
      },
      {
        title: 'Evaluation & observability',
        description:
          'Golden datasets, regression suites run in CI, LLM-as-judge scoring where it is appropriate, and dashboards for latency, cost per request and failure modes.',
      },
      {
        title: 'OpenAI & Claude integration',
        description:
          'Production use of both provider APIs: streaming, tool use, prompt caching, long-context handling, rate-limit and retry strategy, and a migration path when a better model ships.',
      },
      {
        title: 'AI automation',
        description:
          'Internal workflows where a model does the judgement-heavy step and deterministic code does everything else — classification, extraction, routing, summarisation, triage.',
      },
    ],
    stack: [
      'OpenAI API',
      'Claude API',
      'Tool calling',
      'RAG',
      'pgvector',
      'Embeddings',
      'Reranking',
      'Streaming',
      'Evals',
      'Python',
    ],
    subArchitecture: {
      nodes: [
        { id: 'ingress', label: 'Request', column: 0, row: 0, tone: 'muted' },
        { id: 'orchestrator', label: 'Orchestrator', column: 1, row: 0, tone: 'accent' },
        { id: 'retrieval', label: 'Retrieval', column: 2, row: 0 },
        { id: 'tools', label: 'Tool Registry', column: 2, row: 1 },
        { id: 'vector', label: 'Vector Store', column: 3, row: 0 },
        { id: 'model', label: 'Model Provider', column: 3, row: 1, tone: 'accent' },
        { id: 'evals', label: 'Evals / Traces', column: 4, row: 0, tone: 'muted' },
      ],
      edges: [
        { from: 'ingress', to: 'orchestrator' },
        { from: 'orchestrator', to: 'retrieval' },
        { from: 'orchestrator', to: 'tools' },
        { from: 'retrieval', to: 'vector', label: 'top-k' },
        { from: 'orchestrator', to: 'model', label: 'stream' },
        { from: 'tools', to: 'model' },
        { from: 'model', to: 'evals' },
      ],
    },
  },

  data: {
    id: 'data',
    label: 'Data',
    title: 'Data',
    tagline: 'PostgreSQL, Redis, caching, queues and query performance.',
    summary:
      'Most systems that feel slow are not short of servers — they are short of indexes, or they are doing work twice. This is schema design, query optimisation, caching with an invalidation story, and queues that give you back-pressure instead of silent loss.',
    capabilities: [
      {
        title: 'PostgreSQL architecture',
        description:
          'Normalised schemas with the right constraints, migrations that are safe to run against live tables, partitioning for large tables, and JSONB used deliberately rather than as a way to avoid deciding.',
      },
      {
        title: 'Query optimisation',
        description:
          'Reading EXPLAIN ANALYZE rather than guessing: index selection, composite and partial indexes, removing N+1 access patterns, rewriting queries that cannot use an index, and connection pooling.',
      },
      {
        title: 'Caching strategy',
        description:
          'Redis for read-through and write-through caches, request coalescing, stampede protection, and TTL plus event-based invalidation chosen per access pattern instead of globally.',
      },
      {
        title: 'Queues & background work',
        description:
          'Durable job queues with retries, dead-letter handling, idempotent consumers, visibility into depth and age, and workers that can be scaled independently of the API.',
      },
      {
        title: 'Data modelling',
        description:
          'Multi-tenant boundaries, soft-delete and audit strategy, event tables for history, and a model that answers the questions the product will actually ask.',
      },
      {
        title: 'Vector & search data',
        description:
          'pgvector alongside relational data to keep retrieval transactional, plus full-text search and hybrid ranking when embeddings alone return the wrong thing.',
      },
    ],
    stack: [
      'PostgreSQL',
      'Redis',
      'pgvector',
      'SQLAlchemy',
      'Prisma',
      'Alembic',
      'Celery',
      'BullMQ',
      'EXPLAIN ANALYZE',
      'Full-text search',
    ],
    subArchitecture: {
      nodes: [
        { id: 'api', label: 'API Layer', column: 0, row: 0, tone: 'muted' },
        { id: 'pool', label: 'Connection Pool', column: 1, row: 0 },
        { id: 'cache', label: 'Redis Cache', column: 1, row: 1, tone: 'accent' },
        { id: 'primary', label: 'Postgres Primary', column: 2, row: 0, tone: 'accent' },
        { id: 'replica', label: 'Read Replica', column: 2, row: 1 },
        { id: 'queue', label: 'Job Queue', column: 3, row: 1 },
        { id: 'workers', label: 'Workers', column: 4, row: 1 },
      ],
      edges: [
        { from: 'api', to: 'cache', label: 'read-through' },
        { from: 'api', to: 'pool' },
        { from: 'pool', to: 'primary', label: 'write' },
        { from: 'pool', to: 'replica', label: 'read' },
        { from: 'primary', to: 'queue', label: 'events' },
        { from: 'queue', to: 'workers' },
      ],
    },
  },

  realtime: {
    id: 'realtime',
    label: 'Realtime',
    title: 'Realtime',
    tagline: 'WebSockets, event streams and live application state.',
    summary:
      'Live features are mostly a state-reconciliation problem wearing a transport costume. Connections drop, messages arrive twice, and clients come back after sleeping. This covers the transport, the delivery guarantees, and the reconnect behaviour that makes a live UI trustworthy.',
    capabilities: [
      {
        title: 'WebSocket services',
        description:
          'Authenticated socket connections, room and channel subscriptions, heartbeats, backpressure, and horizontal scale-out via a Redis pub/sub fan-out so any instance can serve any client.',
      },
      {
        title: 'Streaming responses',
        description:
          'Server-sent events and chunked streaming for LLM output and long-running jobs, with cancellation, partial-result persistence and resumption after a dropped connection.',
      },
      {
        title: 'Event-driven architecture',
        description:
          'Domain events as the integration seam between services, with an outbox pattern so a database commit and an emitted event cannot disagree.',
      },
      {
        title: 'Live application state',
        description:
          'Optimistic client updates with server reconciliation, presence, typing and progress indicators, and conflict resolution that is explicit rather than last-write-wins by accident.',
      },
      {
        title: 'Queue-backed pipelines',
        description:
          'Long work pushed to workers that stream progress back to the client, so the UI stays responsive while a multi-minute job runs.',
      },
      {
        title: 'Reconnection & delivery',
        description:
          'Exponential backoff, message sequence numbers, replay from the last acknowledged cursor, and at-least-once delivery with idempotent handlers on the client.',
      },
    ],
    stack: [
      'WebSockets',
      'SSE',
      'Redis Pub/Sub',
      'Socket.IO',
      'FastAPI WebSockets',
      'Event sourcing',
      'Outbox pattern',
      'BullMQ',
    ],
    subArchitecture: {
      nodes: [
        { id: 'client', label: 'Client', column: 0, row: 0, tone: 'muted' },
        { id: 'edge', label: 'WS Gateway', column: 1, row: 0, tone: 'accent' },
        { id: 'session', label: 'Session Registry', column: 1, row: 1 },
        { id: 'bus', label: 'Redis Pub/Sub', column: 2, row: 0, tone: 'accent' },
        { id: 'producer', label: 'Event Producers', column: 3, row: 0 },
        { id: 'queue', label: 'Job Queue', column: 3, row: 1 },
        { id: 'worker', label: 'Workers', column: 4, row: 1 },
      ],
      edges: [
        { from: 'client', to: 'edge', label: 'wss' },
        { from: 'edge', to: 'session' },
        { from: 'edge', to: 'bus', label: 'subscribe' },
        { from: 'producer', to: 'bus', label: 'publish' },
        { from: 'producer', to: 'queue' },
        { from: 'queue', to: 'worker' },
        { from: 'worker', to: 'bus', label: 'progress' },
      ],
    },
  },

  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    title: 'Infrastructure',
    tagline: 'Docker, AWS, CI/CD, monitoring and production operations.',
    summary:
      'Code that only runs on your machine is a prototype. This is containerisation, deployment that is boring and repeatable, logs and metrics you can actually search during an incident, and the operational work that turns a working build into a service someone can rely on.',
    capabilities: [
      {
        title: 'Containerisation',
        description:
          'Multi-stage Dockerfiles with small production images, non-root users, reproducible dependency layers, and Compose setups that let a new developer run the whole stack in one command.',
      },
      {
        title: 'AWS deployment',
        description:
          'Container services, managed Postgres and Redis, object storage, secrets management, load balancing and sensible network boundaries — sized to the project rather than to a reference architecture.',
      },
      {
        title: 'CI/CD pipelines',
        description:
          'Pipelines that type-check, test, build and deploy on merge, with migrations applied in a controlled step and a rollback that has actually been tested.',
      },
      {
        title: 'Monitoring & alerting',
        description:
          'Structured logs, request tracing, error tracking, uptime and latency dashboards, and alerts tied to symptoms users feel instead of every metric that moves.',
      },
      {
        title: 'Production troubleshooting',
        description:
          'Diagnosing live incidents: memory and connection leaks, timeouts, slow queries, container restarts, failed deploys and the configuration drift behind "it works locally".',
      },
      {
        title: 'Cost & scaling',
        description:
          'Right-sizing instances, autoscaling rules, caching at the edge, and finding the handful of requests responsible for most of the bill.',
      },
    ],
    stack: [
      'Docker',
      'Docker Compose',
      'AWS',
      'GitHub Actions',
      'Nginx',
      'Terraform',
      'Sentry',
      'OpenTelemetry',
      'Vercel',
      'Linux',
    ],
    subArchitecture: {
      nodes: [
        { id: 'repo', label: 'Repository', column: 0, row: 0, tone: 'muted' },
        { id: 'ci', label: 'CI Pipeline', column: 1, row: 0, tone: 'accent' },
        { id: 'registry', label: 'Image Registry', column: 2, row: 0 },
        { id: 'migrate', label: 'Migrations', column: 2, row: 1 },
        { id: 'runtime', label: 'Container Runtime', column: 3, row: 0, tone: 'accent' },
        { id: 'edge', label: 'Load Balancer', column: 4, row: 0 },
        { id: 'obs', label: 'Logs · Metrics · Alerts', column: 4, row: 1 },
      ],
      edges: [
        { from: 'repo', to: 'ci', label: 'on merge' },
        { from: 'ci', to: 'registry', label: 'build' },
        { from: 'ci', to: 'migrate' },
        { from: 'registry', to: 'runtime', label: 'deploy' },
        { from: 'runtime', to: 'edge' },
        { from: 'runtime', to: 'obs' },
      ],
    },
  },

  frontend: {
    id: 'frontend',
    label: 'Frontend',
    title: 'Frontend',
    tagline: 'React, Next.js and product engineering that ships.',
    summary:
      'The surface where the system meets a person. Server and client boundaries chosen deliberately, data fetching that does not fight the framework, state that stays legible as the product grows, and performance measured on real devices.',
    capabilities: [
      {
        title: 'Next.js architecture',
        description:
          'App Router with server components by default, client islands where interaction demands them, streaming and suspense boundaries, route handlers, caching and revalidation chosen per route.',
      },
      {
        title: 'React application design',
        description:
          'Component boundaries that match the domain, server state separated from UI state, forms with real validation, and a structure a second developer can navigate without a tour.',
      },
      {
        title: 'TypeScript across the stack',
        description:
          'Types shared between client and server, schemas validating at the boundary, and discriminated unions that make invalid UI states unrepresentable.',
      },
      {
        title: 'Product development',
        description:
          'Turning a rough brief into a shipped interface: scoping, dashboards, onboarding, billing surfaces, admin tooling and the unglamorous screens products actually need.',
      },
      {
        title: 'Performance',
        description:
          'Bundle budgets, code splitting, image and font strategy, avoiding layout shift, and Core Web Vitals treated as a requirement rather than a report.',
      },
      {
        title: 'Accessibility',
        description:
          'Semantic markup, keyboard paths through every flow, visible focus, respected reduced-motion preferences, and contrast that holds up in a dark interface.',
      },
    ],
    stack: [
      'React',
      'Next.js',
      'TypeScript',
      'Tailwind CSS',
      'Framer Motion',
      'React Server Components',
      'Zod',
      'Playwright',
      'Vitest',
    ],
    subArchitecture: {
      nodes: [
        { id: 'browser', label: 'Browser', column: 0, row: 0, tone: 'muted' },
        { id: 'edge', label: 'Edge / CDN', column: 1, row: 0 },
        { id: 'rsc', label: 'Server Components', column: 2, row: 0, tone: 'accent' },
        { id: 'islands', label: 'Client Islands', column: 2, row: 1 },
        { id: 'handlers', label: 'Route Handlers', column: 3, row: 0 },
        { id: 'api', label: 'Backend API', column: 4, row: 0, tone: 'accent' },
        { id: 'ws', label: 'WS Stream', column: 4, row: 1 },
      ],
      edges: [
        { from: 'browser', to: 'edge' },
        { from: 'edge', to: 'rsc', label: 'stream HTML' },
        { from: 'rsc', to: 'islands', label: 'hydrate' },
        { from: 'rsc', to: 'handlers' },
        { from: 'handlers', to: 'api' },
        { from: 'islands', to: 'ws', label: 'subscribe' },
      ],
    },
  },
};

export const domainList: Domain[] = [
  domains['core-engine'],
  domains['ai-systems'],
  domains['data'],
  domains['realtime'],
  domains['infrastructure'],
  domains['frontend'],
];

export function getDomain(id: string): Domain | undefined {
  return (domains as Record<string, Domain | undefined>)[id];
}

export function isDomainId(value: string): value is DomainId {
  return value in domains;
}
