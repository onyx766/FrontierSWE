import type { ExperienceEntry, StackGroup } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPERIENCE  —  from Onyx's resume
 * ─────────────────────────────────────────────────────────────────────────────
 * The one career record: the homepage timeline and the 3D world's Experience
 * Archive both read it. Figures are the resume's own. Newest first.
 */

export const experience: ExperienceEntry[] = [
  {
    id: 'instagram',
    role: 'Software Engineer',
    organisation: 'Instagram',
    period: 'Oct 2025 – Apr 2026',
    years: '2025 – 2026',
    location: 'New York City',
    summary:
      'Graph API and Messaging Platform: high-throughput endpoints, Kafka event pipelines and webhooks for business and creator integrations.',
    highlights: [
      'Redis response caching with Kafka-driven invalidation for Graph API v21, cutting database read load by 38% and stabilising P99 latency.',
      'New messaging moderation endpoints (block, unblock, spam routing) that cut developer integration failures by over 25%.',
      'Led the backend migration of partner integrations from the Basic Display API to the Graph API, with deprecation headers and migration telemetry.',
      'Structured webhook confirmation events on Kafka consumers, cutting operational support tickets by 20%.',
      'Multi-asset carousel publishing in the Content Publishing API, launched behind feature flags to beta partners.',
    ],
    stack: ['Node.js', 'TypeScript', 'MySQL', 'Redis', 'Kafka'],
    domains: ['core-engine', 'realtime', 'data'],
    placeholder: false,
  },
  {
    id: 'amazon',
    role: 'Software Engineer',
    organisation: 'Amazon',
    period: 'Aug 2022 – Sep 2025',
    years: '2022 – 2025',
    location: 'New York City',
    summary: 'Real-time in-store ad serving, campaign targeting and advertiser analytics on AWS.',
    highlights: [
      'Moved ad serving from polling to push-based scheduling on AWS ECS, cutting server load by over 60% across thousands of in-store displays.',
      'A pre-aggregated time-series analytics model that cut reporting query latency by over 80%.',
      'HMAC-signed creative manifests for edge devices, and Redis-backed budget pacing that prevents early budget exhaustion.',
      'A Kinesis event ingestion pipeline feeding Python processors and RDS for low-latency campaign dashboards.',
      'Advertiser campaign management and performance dashboards in React with Node.js BFF services.',
    ],
    stack: ['Python', 'AWS', 'DynamoDB', 'Redis', 'Kinesis', 'React', 'Node.js'],
    domains: ['core-engine', 'data', 'infrastructure', 'frontend'],
    placeholder: false,
  },
  {
    id: 'tiktok',
    role: 'Software Engineer',
    organisation: 'TikTok',
    period: 'Jul 2020 – Aug 2022',
    years: '2020 – 2022',
    location: 'San Francisco Bay Area',
    summary:
      'Developer platform: the portal, OAuth and webhook infrastructure behind thousands of third-party integrations.',
    highlights: [
      'Re-architected the developer portal in React and TypeScript: OAuth setup, webhooks and API credential management.',
      'Webhook reliability in Go dispatchers on Kafka: exponential backoff and dead-letter queues, so partner outages lost no events.',
      'Chunked, resumable uploads for multi-gigabyte video publishing, and token lifecycle work in Go: issuance, refresh rotation and audit logging.',
      'An interactive OAuth flow simulator and sandbox webhook events that cut developer onboarding friction.',
      'Analytics API layers in Python and configurable partner dashboards in React and Node.js.',
    ],
    stack: ['React', 'TypeScript', 'Go', 'Python', 'Kafka'],
    domains: ['frontend', 'core-engine', 'realtime'],
    placeholder: false,
  },
];

/**
 * Capability matrix: the skills section of the resume, plus the AI work the
 * projects show. Read by the 3D world's Capability Matrix station.
 */
export const stackGroups: StackGroup[] = [
  {
    label: 'Backend',
    domain: 'core-engine',
    items: [{ name: 'Node.js' }, { name: 'Python' }, { name: 'Go' }, { name: 'FastAPI' }, { name: 'Express' }, { name: 'REST APIs' }, { name: 'GraphQL' }, { name: 'gRPC' }, { name: 'Microservices' }],
  },
  {
    label: 'Frontend',
    domain: 'frontend',
    items: [{ name: 'React' }, { name: 'React Native' }, { name: 'Next.js' }, { name: 'TypeScript' }, { name: 'Redux Toolkit' }, { name: 'React Query' }, { name: 'SSR' }],
  },
  {
    label: 'Data & Messaging',
    domain: 'realtime',
    items: [{ name: 'Apache Kafka' }, { name: 'Redis' }, { name: 'RabbitMQ' }, { name: 'Apache Spark' }, { name: 'ETL pipelines' }, { name: 'Event-driven architecture' }],
  },
  {
    label: 'Databases',
    domain: 'data',
    items: [{ name: 'PostgreSQL' }, { name: 'Amazon Aurora' }, { name: 'DynamoDB' }, { name: 'MySQL' }, { name: 'MongoDB' }],
  },
  {
    label: 'Cloud & DevOps',
    domain: 'infrastructure',
    items: [{ name: 'AWS' }, { name: 'Kubernetes' }, { name: 'Docker' }, { name: 'Terraform' }, { name: 'CI/CD' }, { name: 'Jenkins' }, { name: 'GitLab CI' }],
  },
  {
    label: 'AI Systems',
    domain: 'ai-systems',
    items: [{ name: 'LLM integration' }, { name: 'AI agents' }, { name: 'RAG' }, { name: 'Computer vision (OpenCV)' }, { name: 'Amazon SageMaker' }],
  },
  {
    label: 'Testing & Observability',
    domain: 'infrastructure',
    items: [{ name: 'Jest' }, { name: 'PyTest' }, { name: 'Cypress' }, { name: 'OpenTelemetry' }, { name: 'Prometheus' }, { name: 'Grafana' }, { name: 'ELK Stack' }],
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
