import type { DomainId, FeedEventKind } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LIVE SYSTEM FEED  —  EVENT VOCABULARY
 * ─────────────────────────────────────────────────────────────────────────────
 * Deliberately boring and realistic. Every template is tied to a topology
 * link, so the rows scrolling in the feed correspond to the packets moving in
 * the diagram — the feed is a readout of the visualisation, not decoration
 * running beside it.
 *
 * This is a visual element, not a claim about live traffic: the panel is
 * labelled as a simulated stream in the UI.
 */

export interface FeedTemplate {
  linkId: string;
  targetNode: DomainId;
  kind: FeedEventKind;
  detail: string;
  /** Inclusive latency range in ms; null means the event has no latency. */
  latency: [number, number] | null;
  /** Relative frequency weight. */
  weight: number;
}

export const feedTemplates: FeedTemplate[] = [
  // frontend → core
  { linkId: 'fe-core', targetNode: 'core-engine', kind: 'API REQUEST', detail: 'GET /projects', latency: [28, 64], weight: 5 },
  { linkId: 'fe-core', targetNode: 'core-engine', kind: 'API REQUEST', detail: 'POST /inquiry', latency: [40, 96], weight: 2 },
  { linkId: 'fe-core', targetNode: 'core-engine', kind: 'API REQUEST', detail: 'GET /services', latency: [22, 48], weight: 3 },

  // core → ai
  { linkId: 'core-ai', targetNode: 'ai-systems', kind: 'API REQUEST', detail: 'POST /agent/run', latency: [180, 340], weight: 4 },
  { linkId: 'core-ai', targetNode: 'ai-systems', kind: 'MODEL RESPONSE', detail: 'claude · stream', latency: [620, 1240], weight: 4 },
  { linkId: 'core-ai', targetNode: 'ai-systems', kind: 'TOOL CALL', detail: 'search_documents', latency: [48, 130], weight: 3 },
  { linkId: 'core-ai', targetNode: 'ai-systems', kind: 'TOOL CALL', detail: 'fetch_record', latency: [18, 70], weight: 2 },

  // core → data
  { linkId: 'core-data', targetNode: 'data', kind: 'DB QUERY', detail: 'pg · select projects', latency: [6, 22], weight: 5 },
  { linkId: 'core-data', targetNode: 'data', kind: 'DB QUERY', detail: 'pg · insert event', latency: [8, 26], weight: 3 },
  { linkId: 'core-data', targetNode: 'data', kind: 'CACHE HIT', detail: 'redis · session', latency: null, weight: 4 },
  { linkId: 'core-data', targetNode: 'data', kind: 'CACHE HIT', detail: 'redis · rate limit', latency: null, weight: 2 },

  // ai → data
  { linkId: 'ai-data', targetNode: 'data', kind: 'VECTOR SEARCH', detail: 'pgvector · top-k 24', latency: [26, 68], weight: 4 },
  { linkId: 'ai-data', targetNode: 'data', kind: 'DB QUERY', detail: 'pg · chunk fetch', latency: [9, 24], weight: 2 },

  // core → realtime
  { linkId: 'core-rt', targetNode: 'realtime', kind: 'WS EVENT', detail: 'run.progress', latency: [2, 9], weight: 5 },
  { linkId: 'core-rt', targetNode: 'realtime', kind: 'WS EVENT', detail: 'run.completed', latency: [2, 7], weight: 2 },

  // realtime → data
  { linkId: 'rt-data', targetNode: 'data', kind: 'QUEUE JOB', detail: 'embed.batch · 64', latency: [120, 420], weight: 3 },
  { linkId: 'rt-data', targetNode: 'data', kind: 'QUEUE JOB', detail: 'outbox.relay', latency: [10, 34], weight: 2 },

  // core → infrastructure
  { linkId: 'core-infra', targetNode: 'infrastructure', kind: 'HEALTH CHECK', detail: 'api · /healthz', latency: [1, 6], weight: 4 },
  { linkId: 'core-infra', targetNode: 'infrastructure', kind: 'DEPLOY', detail: 'api · rollout ok', latency: [1800, 4200], weight: 1 },

  // infrastructure → ai
  { linkId: 'infra-ai', targetNode: 'ai-systems', kind: 'HEALTH CHECK', detail: 'worker · pool 4/4', latency: [2, 8], weight: 2 },

  // frontend → realtime
  { linkId: 'fe-rt', targetNode: 'realtime', kind: 'WS EVENT', detail: 'client.subscribe', latency: [3, 11], weight: 3 },
  { linkId: 'fe-rt', targetNode: 'realtime', kind: 'WS EVENT', detail: 'cursor.ack', latency: [1, 5], weight: 2 },
];

/** Pre-expanded weighted pool so selection is a single index lookup. */
export const feedPool: FeedTemplate[] = feedTemplates.flatMap((template) =>
  Array.from({ length: template.weight }, () => template),
);

/** Static rows rendered on the server and under reduced motion. */
export const staticFeedRows: {
  kind: FeedEventKind;
  detail: string;
  latencyMs: number | null;
}[] = [
  { kind: 'API REQUEST', detail: 'GET /projects', latencyMs: 42 },
  { kind: 'MODEL RESPONSE', detail: 'claude · stream', latencyMs: 840 },
  { kind: 'TOOL CALL', detail: 'search_documents', latencyMs: 96 },
  { kind: 'VECTOR SEARCH', detail: 'pgvector · top-k 24', latencyMs: 38 },
  { kind: 'DB QUERY', detail: 'pg · select projects', latencyMs: 12 },
  { kind: 'CACHE HIT', detail: 'redis · session', latencyMs: null },
  { kind: 'WS EVENT', detail: 'run.progress', latencyMs: 4 },
  { kind: 'HEALTH CHECK', detail: 'api · /healthz', latencyMs: 2 },
];
