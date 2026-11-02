import type { AssistantAnswer, AssistantSource } from '@/lib/types';
import { profile } from '@/data/profile';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASK RYAN'S AI  —  MOCK KNOWLEDGE BASE
 * ─────────────────────────────────────────────────────────────────────────────
 * The assistant works with no AI backend configured: this keyword-matched
 * knowledge base answers the questions visitors actually ask.
 *
 * TO CONNECT A REAL BACKEND:
 *   Set ASSISTANT_PROVIDER in .env to `anthropic`, `openai`, or set
 *   ASSISTANT_RAG_ENDPOINT to your own retrieval service. See
 *   src/app/api/assistant/route.ts — the provider branch is already there and
 *   this file becomes the fallback when a provider call fails.
 *
 * The entries below are also a reasonable corpus to embed for a real RAG
 * backend: they are the canonical answers about this profile.
 */

export interface KnowledgeEntry {
  id: string;
  /** Lowercase terms that should route a question to this entry. */
  keywords: string[];
  answer: string;
  sources: AssistantSource[];
}

export const suggestedQuestions: string[] = [
  'What AI experience does Ryan have?',
  'Has Ryan worked with FastAPI?',
  'Show me backend projects.',
  'Can Ryan build a RAG system?',
  'Is Ryan available?',
  'Can I hire Ryan for a small task?',
];

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'ai-experience',
    keywords: [
      'ai',
      'llm',
      'openai',
      'claude',
      'gpt',
      'model',
      'agent',
      'agents',
      'tool calling',
      'prompt',
      'machine learning',
    ],
    answer:
      'Ryan builds production LLM systems, not demos. That covers agent runtimes with typed tool calling, step and token budgets and full execution traces; RAG pipelines with hybrid retrieval, reranking and cited answers; structured output with schema validation; streaming responses; and evaluation suites that run in CI so a prompt change cannot silently regress. Both the OpenAI and Claude APIs are used in production, behind a provider-agnostic interface so models can be swapped as better ones ship.',
    sources: [
      { label: 'AI Systems', href: '/system/ai-systems' },
      { label: 'Agent Orchestration Platform', href: '/projects/agent-orchestration-platform' },
      { label: 'RAG Knowledge Service', href: '/projects/rag-knowledge-service' },
    ],
  },
  {
    id: 'fastapi',
    keywords: ['fastapi', 'python', 'pydantic', 'async python', 'celery'],
    answer:
      'Yes — FastAPI is one of Ryan’s primary backend tools. That means async services with Pydantic models at every boundary, dependency-injected database sessions and clients, OpenAPI schemas generated from the code rather than maintained alongside it, background work moved onto Celery or RQ once it outgrows the request cycle, and structured logging with request correlation. Both AI case studies on this site have a FastAPI service at their core.',
    sources: [
      { label: 'Core Engine', href: '/system/core-engine' },
      { label: 'Backend & API Development', href: '/services#backend-api-development' },
      { label: 'Agent Orchestration Platform', href: '/projects/agent-orchestration-platform' },
    ],
  },
  {
    id: 'backend-projects',
    keywords: ['backend', 'api', 'node', 'nodejs', 'server', 'microservice', 'rest', 'endpoint'],
    answer:
      'The backend work on this site covers an agent orchestration platform (FastAPI, queue-backed execution, WebSocket progress streaming), a multi-tenant SaaS core (TypeScript and Node, tenancy and permissions, usage metering, billing webhooks), and a realtime events gateway (stateless WebSocket instances with Redis fan-out and replay from cursor). Each has a full case study: problem, architecture, the challenges that actually came up, and the engineering decisions with their trade-offs.',
    sources: [
      { label: 'All projects', href: '/projects' },
      { label: 'SaaS Platform Core', href: '/projects/saas-platform-core' },
      { label: 'Realtime Events Gateway', href: '/projects/realtime-events-gateway' },
    ],
  },
  {
    id: 'rag',
    keywords: ['rag', 'retrieval', 'vector', 'embedding', 'pgvector', 'semantic search', 'knowledge base', 'chatbot'],
    answer:
      'Yes. Ryan has built RAG end to end: ingestion with structure-aware chunking, batched embedding workers, hybrid vector plus keyword retrieval with rank fusion, a reranking pass, and citations as structured data so every claim links to the exact source passage. Retrieval quality is measured against a fixed question set rather than spot-checked, and indexes are versioned so the embedding model can change with no downtime. pgvector inside PostgreSQL keeps retrieval transactional with the source documents.',
    sources: [
      { label: 'RAG Knowledge Service', href: '/projects/rag-knowledge-service' },
      { label: 'RAG Systems service', href: '/services#rag-systems' },
    ],
  },
  {
    id: 'availability',
    keywords: ['available', 'availability', 'free', 'capacity', 'hire', 'hiring', 'start', 'when can you'],
    answer: `${profile.availability.label}. ${profile.availability.detail} The fastest route is the start-project form — it asks what you need built, your current stack, budget range and timeline, which is usually enough to reply with a concrete scope rather than a request for a call.`,
    sources: [
      { label: 'Start a project', href: '/start-project' },
      { label: 'Services', href: '/services' },
    ],
  },
  {
    id: 'small-tasks',
    keywords: ['small', 'quick', 'one-off', 'task', 'cheap', 'minimum', 'bug', 'fix', 'budget'],
    answer:
      'Small tasks are explicitly welcome — there is a whole section of the services page for them. Typical examples: fix a backend or API problem (1–3 days), build an API integration (2–5 days), add OpenAI or Claude functionality to an existing app (2–5 days), fix a Next.js issue (1–3 days), fix a slow PostgreSQL query (1–4 days), or deploy and fix a production application (1–5 days). You do not need a large project to get in touch.',
    sources: [
      { label: 'Small engineering tasks', href: '/services#small-tasks' },
      { label: 'Start a project', href: '/start-project' },
    ],
  },
  {
    id: 'data',
    keywords: ['postgres', 'postgresql', 'sql', 'database', 'redis', 'cache', 'caching', 'query', 'slow', 'performance', 'index', 'queue'],
    answer:
      'Data work is a core strength: PostgreSQL schema design with the constraints and indexes the product actually needs, migrations that are safe to run against live tables, query optimisation driven by EXPLAIN ANALYZE and total-time ranking rather than guesswork, removing N+1 access patterns at the application layer, Redis caching chosen per access pattern with a real invalidation story, and durable job queues with retries and dead-letter handling.',
    sources: [
      { label: 'Data', href: '/system/data' },
      { label: 'Query Performance Rescue', href: '/projects/query-performance-rescue' },
      { label: 'Performance & Scalability', href: '/services#performance-scalability' },
    ],
  },
  {
    id: 'realtime',
    keywords: ['websocket', 'websockets', 'realtime', 'real-time', 'live', 'streaming', 'socket', 'sse', 'pubsub', 'events'],
    answer:
      'Realtime systems that scale past a single process: authenticated WebSocket gateways with per-channel authorisation, Redis pub/sub fan-out so any instance can serve any client, a transactional outbox so a database commit and the event announcing it cannot disagree, sequence numbers with replay from the client’s last acknowledged cursor, bounded send buffers, and at-least-once delivery with idempotent application on the client.',
    sources: [
      { label: 'Realtime', href: '/system/realtime' },
      { label: 'Realtime Events Gateway', href: '/projects/realtime-events-gateway' },
    ],
  },
  {
    id: 'infrastructure',
    keywords: ['docker', 'aws', 'deploy', 'deployment', 'devops', 'ci', 'cd', 'infrastructure', 'kubernetes', 'production', 'monitoring', 'terraform'],
    answer:
      'Containerisation and deployment are part of the delivery, not someone else’s problem: multi-stage Dockerfiles producing small non-root images, Compose setups that run the whole stack locally in one command, CI pipelines that type-check, test, build and deploy on merge with migrations in a controlled step, structured logs and request tracing, and alerting tied to symptoms users feel. Also available for production troubleshooting — timeouts, restarts, leaks, failed deploys and configuration drift.',
    sources: [
      { label: 'Infrastructure', href: '/system/infrastructure' },
      { label: 'Deployment / Production Problems', href: '/services#deployment-production' },
    ],
  },
  {
    id: 'frontend',
    keywords: ['react', 'next', 'nextjs', 'frontend', 'ui', 'tailwind', 'typescript', 'dashboard', 'app router'],
    answer:
      'Frontend is the other half of full-stack here: Next.js App Router with server components by default and client islands only where interaction requires them, types and validation schemas shared between client and server, forms with real validation, performance treated as a requirement rather than a report, and accessibility — semantic markup, keyboard paths, visible focus, respected reduced-motion preferences. This site is itself a Next.js, TypeScript and Tailwind build.',
    sources: [
      { label: 'Frontend', href: '/system/frontend' },
      { label: 'SaaS Platform Core', href: '/projects/saas-platform-core' },
    ],
  },
  {
    id: 'saas',
    keywords: ['saas', 'multi-tenant', 'multitenant', 'tenant', 'billing', 'subscription', 'stripe', 'mvp', 'product', 'startup'],
    answer:
      'SaaS work covers the foundation most products need before features: a multi-tenant data model with isolation enforced structurally rather than by convention, authentication with sessions, OAuth and API keys, a single permission matrix shared by API and UI, usage metering written transactionally with the action it bills for, replay-safe billing webhooks, and an admin console for support. For earlier-stage work, MVP builds are scoped so the first version ships and the second is not a rewrite.',
    sources: [
      { label: 'SaaS Platform Core', href: '/projects/saas-platform-core' },
      { label: 'SaaS Development', href: '/services#saas-development' },
      { label: 'MVP Development', href: '/services#mvp-development' },
    ],
  },
  {
    id: 'experience',
    keywords: ['experience', 'years', 'senior', 'background', 'cv', 'resume', 'history', 'worked'],
    answer: `${profile.yearsExperience} years of engineering experience, currently working as a ${profile.role.toLowerCase()} across AI systems, backend services, data and infrastructure. The experience page has the timeline and a capability matrix by domain. Note that the timeline entries on this site are currently placeholders pending real detail — the project case studies are the better signal of how the work is actually done.`,
    sources: [
      { label: 'Experience', href: '/experience' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    id: 'process',
    keywords: ['process', 'how do you work', 'workflow', 'engagement', 'contract', 'scope', 'review', 'handover', 'communicate'],
    answer:
      'Engagements come in four shapes: a fixed-scope task with a clear finish line, a project build delivered in reviewable increments, ongoing weekly engineering as the senior engineer on an existing product, or a technical review of an existing codebase. Scope gets written down before building starts, including what is excluded and what assumptions it rests on. Work ships in small increments that each leave the system working, and every engagement ends with handover notes.',
    sources: [
      { label: 'Engagement models', href: '/services#engagement' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    id: 'contact',
    keywords: ['contact', 'email', 'reach', 'talk', 'call', 'message', 'get in touch', 'github', 'linkedin'],
    answer: `The start-project form is the quickest way through — it collects what you need built, your stack, budget and timeline up front, so the first reply can be a concrete scope. ${
      profile.contact.placeholder
        ? 'Direct contact details on this site are still placeholders and need replacing before launch.'
        : `Direct email: ${profile.contact.email}.`
    }`,
    sources: [
      { label: 'Start a project', href: '/start-project' },
      { label: 'About', href: '/about' },
    ],
  },
];

const FALLBACK_ANSWER =
  'I can answer questions about Ryan’s AI and LLM work, backend and API engineering, data and PostgreSQL performance, realtime systems, infrastructure and deployment, the project case studies, how engagements work, and current availability. Try one of the suggestions below, or describe what you need built and I will point you at the closest relevant work.';

/**
 * Keyword-scored retrieval over the knowledge base. Deliberately simple and
 * synchronous: no network, no model, runs identically on server and client.
 */
export function answerFromKnowledge(question: string): AssistantAnswer {
  const normalised = question.toLowerCase();

  let best: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (!normalised.includes(keyword)) continue;
      // Longer keyword matches are stronger signals than single words.
      score += keyword.includes(' ') ? 3 : keyword.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best || bestScore === 0) {
    return {
      answer: FALLBACK_ANSWER,
      sources: [
        { label: 'Projects', href: '/projects' },
        { label: 'Services', href: '/services' },
        { label: 'Start a project', href: '/start-project' },
      ],
      mock: true,
    };
  }

  return { answer: best.answer, sources: best.sources, mock: true };
}
