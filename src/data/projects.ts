import type { Project, ProjectStatus } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROJECTS  —  PLACEHOLDER CASE STUDIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Every entry below has `placeholder: true` and renders a visible PLACEHOLDER
 * chip on the site, so nothing here can be mistaken for a shipped client
 * project. The engineering content describes systems of the kind described in
 * your stack — it names no employer, client, user count or revenue figure.
 *
 * TO MAKE THESE REAL:
 *   1. Replace `name`, `summary`, `intro`, `period`, `links`.
 *   2. Rewrite `caseStudy` with what actually happened.
 *   3. Replace the `metrics` values and remove `placeholder: true` from each.
 *   4. Set `placeholder: false` on the project.
 *   5. Add real screenshots to /public and fill in `caseStudy.media`.
 *
 * The `architecture` block drives the interactive diagram. Edit `layers`,
 * `edges` and `paths` and the diagram and request animation update themselves.
 */

export const projects: Project[] = [
  {
    slug: 'agent-orchestration-platform',
    name: 'Agent Orchestration Platform',
    summary:
      'Multi-step AI agent runtime with typed tool calling, step budgets, streaming progress and full execution traces.',
    intro:
      'A backend service that runs LLM agents against a registry of typed tools, streams progress to the client while a run is in flight, and records every model call, tool invocation and argument so a run can be replayed and debugged after the fact.',
    domains: ['ai-systems', 'core-engine', 'realtime'],
    role: 'Lead engineer — architecture, backend, agent runtime, evaluation harness',
    status: 'production',
    period: '[PLACEHOLDER] 2024',
    technologies: [
      'Python',
      'FastAPI',
      'Claude API',
      'OpenAI API',
      'Tool calling',
      'PostgreSQL',
      'Redis',
      'WebSockets',
      'Celery',
      'Docker',
    ],
    featured: true,
    links: {},
    architecture: {
      layers: [
        { label: 'Client', nodes: [{ id: 'web', label: 'Web App', detail: 'Next.js' }] },
        {
          label: 'Edge',
          nodes: [
            { id: 'api', label: 'API Gateway', detail: 'FastAPI' },
            { id: 'ws', label: 'WS Stream', detail: 'progress events' },
          ],
        },
        {
          label: 'Runtime',
          nodes: [
            { id: 'runner', label: 'Agent Runner', detail: 'step loop', tone: 'accent' },
            { id: 'tools', label: 'Tool Registry', detail: 'typed schemas' },
          ],
        },
        {
          label: 'Services',
          nodes: [
            { id: 'model', label: 'Model Provider', detail: 'Claude / OpenAI', tone: 'accent' },
            { id: 'queue', label: 'Job Queue', detail: 'Celery + Redis' },
            { id: 'db', label: 'PostgreSQL', detail: 'runs · traces' },
          ],
        },
      ],
      edges: [
        { from: 'web', to: 'api', label: 'POST /agent/run' },
        { from: 'api', to: 'runner' },
        { from: 'api', to: 'queue', label: 'enqueue' },
        { from: 'runner', to: 'tools' },
        { from: 'runner', to: 'model', label: 'stream' },
        { from: 'tools', to: 'db' },
        { from: 'runner', to: 'db', label: 'trace' },
        { from: 'queue', to: 'ws' },
        { from: 'ws', to: 'web', label: 'progress' },
      ],
      paths: [
        {
          label: 'Agent run',
          steps: ['web', 'api', 'runner', 'model', 'tools', 'db', 'ws'],
          latencies: [0, 14, 6, 840, 62, 11, 4],
        },
      ],
    },
    caseStudy: {
      problem:
        'An LLM prompt wrapped in a request handler works until the work takes more than one model call. Once an agent needs to read data, call an external API and then decide what to do next, three things break at once: the HTTP request times out, failures become invisible because nothing is recorded, and a model that returns malformed tool arguments takes the whole run down. What was needed was a runtime that could execute multi-step work reliably and leave an audit trail behind it.',
      requirements: [
        'Execute multi-step agent runs that exceed a normal HTTP request lifetime',
        'Define tools once, with schemas enforced on both the model and the handler side',
        'Stream progress to the client so a long run shows movement rather than a spinner',
        'Record every step — prompt, model response, tool call, arguments, result, latency, cost',
        'Bound every run with step, time and token limits so no single run can run away',
        'Make side effects idempotent, because retries are inevitable',
        'Support more than one model provider without rewriting the runtime',
      ],
      role: 'Lead engineer. I owned the architecture, the agent runtime and tool protocol, the persistence and trace model, the streaming layer, and the evaluation harness used to gate changes to prompts and tool definitions.',
      architecture:
        'Requests arrive at a FastAPI gateway, which validates input, creates a run record and enqueues the work. A worker executes the agent loop: build context, call the model, validate any returned tool call against its schema, dispatch to the handler, append the result and loop until the model stops or a budget is hit. Each transition is written to Postgres as an append-only trace row and published to Redis, where the WebSocket gateway fans it out to subscribed clients. Model access sits behind a provider interface so Claude and OpenAI are swappable per run.',
      challenges: [
        {
          title: 'Malformed tool arguments',
          body: 'Models occasionally return arguments that do not match the declared schema — a missing field, a string where a number belongs, a hallucinated tool name. Failing the run on the first mistake made the system feel fragile. The runtime validates arguments against the tool schema, and on failure returns the validation error to the model as a tool result rather than raising, giving it one bounded chance to correct itself before the step is marked failed.',
        },
        {
          title: 'Runs that outlive the request',
          body: 'A run doing real work takes tens of seconds to minutes. Holding an HTTP connection open for that is fragile and does not survive a deploy. Moving execution to a queue solved the lifetime problem but created a new one: the client now had no idea what was happening. Progress had to be streamed over a separate channel and the run had to be resumable from its persisted state.',
        },
        {
          title: 'Non-idempotent side effects',
          body: 'When a worker is retried after a crash, any tool that had already written data would write it again. Tool calls are keyed by run id plus step index, and handlers that mutate state check for an existing result for that key before acting — turning at-least-once delivery into effectively-once effects.',
        },
        {
          title: 'Debugging behaviour instead of guessing',
          body: 'An agent that produces a bad answer gives no stack trace. Without a trace of the exact context, model output and tool results for each step, diagnosis is speculation. The trace model was treated as a product feature rather than logging, and is the single most useful thing in the system.',
        },
        {
          title: 'Prompt and tool changes causing silent regressions',
          body: 'Changing a tool description to fix one behaviour frequently broke another. A fixed set of scenarios with expected outcomes runs in CI, so a change that reduces success rate on the existing set fails the build rather than reaching users.',
        },
      ],
      decisions: [
        {
          decision: 'Queue-backed execution rather than long-lived HTTP requests',
          rationale:
            'Runs survive deploys and client disconnects, retries become possible, and workers scale independently of the API.',
          tradeoff:
            'Requires a second channel for progress and more moving parts than a synchronous handler.',
        },
        {
          decision: 'Append-only trace table rather than mutable run state',
          rationale:
            'Full history of every step makes replay and debugging possible, and makes cost and latency attribution exact.',
          tradeoff: 'More rows written per run; needs retention and partitioning as volume grows.',
        },
        {
          decision: 'Tool schemas as the single source of truth',
          rationale:
            'One definition generates the model-facing tool spec and validates the handler input, so the two cannot drift apart.',
          tradeoff: 'Adding a tool is slightly more ceremony than writing a function.',
        },
        {
          decision: 'Provider-agnostic model interface',
          rationale:
            'Model capability moves quickly; the runtime should not need rewriting to take advantage of a better model.',
          tradeoff:
            'The interface sits at the lowest common denominator, so provider-specific features need explicit escape hatches.',
        },
        {
          decision: 'Hard budgets on steps, wall-clock time and tokens',
          rationale: 'Bounds worst-case cost and prevents a looping agent from consuming a worker.',
          tradeoff: 'Legitimately long tasks have to be decomposed into several runs.',
        },
      ],
      implementation: [
        'FastAPI gateway with Pydantic request and response models, returning a run id immediately',
        'Agent loop implemented as an explicit state machine, so each transition is persisted and resumable',
        'Tool registry with a decorator that derives the model-facing JSON schema from Pydantic models',
        'Celery workers with Redis as broker, concurrency tuned to provider rate limits',
        'Trace rows written in the same transaction as any state change the step produced',
        'Redis pub/sub bridging workers to the WebSocket gateway so any instance can serve any client',
        'Structured logs carrying run id and step index on every line for correlation',
        'Evaluation harness replaying a fixed scenario set and reporting success rate, latency and cost per change',
      ],
      performance: [
        'Model latency dominates total run time, so gateway and tool work are kept well under the model call cost',
        'Tool results and retrieved context cached in Redis to avoid repeated identical work inside a single run',
        'Worker concurrency bounded by provider rate limits, with backoff on 429 responses rather than retry storms',
        'Streaming model output means time-to-first-token is what the user perceives, not total run duration',
        'Trace table partitioned by time with a retention window, keeping the hot path small',
        'Token budgeting per step keeps context from growing unbounded over a long run',
      ],
      result:
        'Multi-step agent work runs as a durable background job with live progress in the UI, every run is inspectable step by step, and prompt or tool changes are validated against a fixed scenario set before they ship. [PLACEHOLDER — replace with your real outcome and the numbers behind it.]',
      metrics: [
        { label: 'Avg run latency', value: '—', placeholder: true },
        { label: 'Tool call success', value: '—', placeholder: true },
        { label: 'Steps per run', value: '—', placeholder: true },
        { label: 'Cost per run', value: '—', placeholder: true },
      ],
      media: [
        {
          label: '[PLACEHOLDER] Run trace view',
          caption: 'Step-by-step execution trace with model output, tool arguments and latency.',
        },
        {
          label: '[PLACEHOLDER] Live progress stream',
          caption: 'Client view while a run is in flight, driven by WebSocket progress events.',
        },
      ],
    },
    placeholder: true,
  },

  {
    slug: 'rag-knowledge-service',
    name: 'RAG Knowledge Service',
    summary:
      'Retrieval service over a private document corpus: hybrid vector and keyword search, reranking, cited answers and measured recall.',
    intro:
      'An ingestion and retrieval service that turns a document corpus into answers with citations. Hybrid retrieval combines embeddings with full-text search, a reranking pass orders candidates, and recall is measured against a fixed evaluation set rather than assumed.',
    domains: ['ai-systems', 'data', 'infrastructure'],
    role: 'Lead engineer — ingestion pipeline, retrieval, evaluation, deployment',
    status: 'production',
    period: '[PLACEHOLDER] 2024',
    technologies: [
      'Python',
      'FastAPI',
      'PostgreSQL',
      'pgvector',
      'Redis',
      'OpenAI Embeddings',
      'Claude API',
      'Docker',
      'AWS',
    ],
    featured: true,
    links: {},
    architecture: {
      layers: [
        {
          label: 'Ingest',
          nodes: [
            { id: 'source', label: 'Document Sources', detail: 'upload · sync' },
            { id: 'parse', label: 'Parse / Chunk' },
          ],
        },
        {
          label: 'Index',
          nodes: [
            { id: 'embed', label: 'Embedding Worker', detail: 'batched' },
            { id: 'store', label: 'pgvector + FTS', detail: 'PostgreSQL', tone: 'accent' },
          ],
        },
        {
          label: 'Query',
          nodes: [
            { id: 'api', label: 'Query API', detail: 'FastAPI' },
            { id: 'cache', label: 'Redis Cache' },
            { id: 'retrieve', label: 'Hybrid Retrieval', tone: 'accent' },
            { id: 'rerank', label: 'Reranker' },
          ],
        },
        {
          label: 'Answer',
          nodes: [
            { id: 'model', label: 'Model Provider', detail: 'Claude', tone: 'accent' },
            { id: 'evals', label: 'Eval Harness', detail: 'recall · citations', tone: 'muted' },
          ],
        },
      ],
      edges: [
        { from: 'source', to: 'parse' },
        { from: 'parse', to: 'embed', label: 'chunks' },
        { from: 'embed', to: 'store', label: 'upsert' },
        { from: 'api', to: 'cache' },
        { from: 'api', to: 'retrieve' },
        { from: 'retrieve', to: 'store', label: 'vector + keyword' },
        { from: 'retrieve', to: 'rerank', label: 'top-k' },
        { from: 'rerank', to: 'model', label: 'context' },
        { from: 'model', to: 'evals' },
      ],
      paths: [
        {
          label: 'Question to cited answer',
          steps: ['api', 'cache', 'retrieve', 'store', 'rerank', 'model'],
          latencies: [0, 3, 8, 34, 48, 910],
        },
      ],
    },
    caseStudy: {
      problem:
        'Embedding a corpus and returning the nearest chunks produces a demo that answers easy questions and fails confidently on the rest. Semantic search misses exact identifiers, product codes and names; chunk boundaries cut answers in half; and without citations nobody can tell a grounded answer from an invented one. The requirement was retrieval that could be measured and answers that could be checked.',
      requirements: [
        'Ingest documents in several formats and keep the index current as they change',
        'Retrieve correctly for both conceptual questions and exact-term lookups',
        'Return citations pointing at the specific source passage for every claim',
        'Measure retrieval quality against a fixed question set instead of spot-checking',
        'Keep query latency low enough for an interactive interface',
        'Enforce per-tenant isolation so no query can retrieve another tenant’s documents',
        'Re-index after an embedding model change without downtime',
      ],
      role: 'Lead engineer. I built the ingestion and chunking pipeline, the hybrid retrieval and reranking layer, the citation model, the evaluation harness, and the containerised deployment.',
      architecture:
        'Documents are parsed, split into overlapping chunks with heading context preserved, and embedded in batches by a worker that writes vectors and text into PostgreSQL — pgvector for similarity, a tsvector column for keyword search. At query time the API runs both searches, fuses the result sets by rank, reranks the merged candidates, and passes the top passages to the model with instructions to cite them. Queries and embeddings are cached in Redis. An evaluation harness runs a fixed question set against the index and reports recall at k and citation accuracy.',
      challenges: [
        {
          title: 'Pure vector search missing exact terms',
          body: 'Embeddings are good at meaning and poor at precision. A question containing a specific identifier would return conceptually similar passages and not the one containing the identifier. Adding full-text search alongside the vector index and fusing the two ranked lists fixed the class of failure that mattered most to users.',
        },
        {
          title: 'Chunking destroying answers',
          body: 'Fixed-size chunks split tables, lists and procedures across boundaries, so no single chunk contained a complete answer. Chunking was moved to structural boundaries with overlap and inherited heading context prepended to each chunk, so a retrieved chunk carries enough surrounding meaning to stand alone.',
        },
        {
          title: 'Keeping retrieval transactional',
          body: 'A separate vector database meant documents and their embeddings could disagree after a partial failure. Keeping vectors in PostgreSQL alongside the source rows made ingestion a single transaction and removed an entire category of consistency bug, at the cost of some specialised index features.',
        },
        {
          title: 'No way to tell whether a change helped',
          body: 'Every tuning decision — chunk size, k, fusion weights, reranking — felt like an improvement in isolation. A fixed set of questions with known correct sources turned those arguments into measurements, and several changes that felt better measured worse.',
        },
        {
          title: 'Re-indexing without downtime',
          body: 'Changing the embedding model invalidates every stored vector. Indexes are versioned and written in the background; queries switch to the new version only once it has been built and evaluated, with the previous version kept for rollback.',
        },
      ],
      decisions: [
        {
          decision: 'pgvector inside PostgreSQL rather than a dedicated vector database',
          rationale:
            'Keeps embeddings, documents and tenant metadata in one transactional store, removing sync logic and one piece of infrastructure.',
          tradeoff:
            'Gives up some specialised index tuning, and very large corpora will eventually need a different plan.',
        },
        {
          decision: 'Hybrid retrieval with rank fusion',
          rationale:
            'Covers both semantic and exact-match questions; neither method alone was acceptable.',
          tradeoff: 'Two queries and a fusion step per request, plus fusion weights to maintain.',
        },
        {
          decision: 'Reranking the merged candidate set',
          rationale:
            'Allows wide, cheap retrieval followed by precise ordering, which improved answer quality more than any prompt change.',
          tradeoff: 'Adds latency to every query and another dependency to the hot path.',
        },
        {
          decision: 'Citations as structured data, not prose',
          rationale:
            'The answer references chunk ids, so the UI can link to exact passages and an unsupported claim is detectable.',
          tradeoff: 'Requires validating model output against the supplied context before returning.',
        },
        {
          decision: 'Tenant filtering applied in the SQL query, not after retrieval',
          rationale: 'Isolation enforced by the database rather than by application discipline.',
          tradeoff: 'Index design has to account for the tenant predicate.',
        },
      ],
      implementation: [
        'Format-aware parsers producing a normalised document tree before chunking',
        'Structural chunking with overlap and inherited heading context per chunk',
        'Batched embedding worker with retry and backoff, resumable from the last committed chunk',
        'Single PostgreSQL schema holding documents, chunks, vectors and tsvector columns',
        'Hybrid query combining vector distance and keyword rank, fused and then reranked',
        'Redis caching for repeated queries and for embeddings of recurring question text',
        'Answer validation checking every citation against the context actually supplied',
        'Evaluation harness reporting recall at k, citation accuracy, latency and cost per run',
      ],
      performance: [
        'Retrieval kept well inside interactive budget so the model call dominates perceived latency',
        'Approximate vector index tuned for recall at the k that reranking needs, not for raw speed',
        'Candidate set deliberately wide before reranking and narrow after, to trade cheap work for quality',
        'Embedding cost bounded by batching at ingest and caching recurring query embeddings',
        'Ingestion runs on workers so a large upload never blocks queries',
        'Answers streamed, so the interface responds before the full answer exists',
      ],
      result:
        'Retrieval quality became a number that moves rather than an opinion, exact-term questions stopped failing, and every answer links to the passages it came from. [PLACEHOLDER — replace with your real outcome and measured recall figures.]',
      metrics: [
        { label: 'Recall @ k', value: '—', placeholder: true },
        { label: 'Query latency p95', value: '—', placeholder: true },
        { label: 'Corpus size', value: '—', placeholder: true },
        { label: 'Citation accuracy', value: '—', placeholder: true },
      ],
      media: [
        {
          label: '[PLACEHOLDER] Cited answer view',
          caption: 'Answer with inline citations linking to the exact source passage.',
        },
        {
          label: '[PLACEHOLDER] Evaluation report',
          caption: 'Recall and citation accuracy across the fixed question set, per index version.',
        },
      ],
    },
    placeholder: true,
  },

  {
    slug: 'saas-platform-core',
    name: 'SaaS Platform Core',
    summary:
      'Multi-tenant SaaS foundation: authentication, roles, billing hooks, usage metering and an admin surface.',
    intro:
      'The layer every SaaS product needs before it can have features: tenant isolation, authentication and roles, subscription and usage metering, webhook handling, and an admin interface for support work — built so product teams add features instead of rebuilding plumbing.',
    domains: ['core-engine', 'data', 'frontend'],
    role: 'Lead engineer — backend architecture, data model, billing integration, admin UI',
    status: 'production',
    period: '[PLACEHOLDER] 2023 — 2024',
    technologies: [
      'TypeScript',
      'Next.js',
      'Node.js',
      'PostgreSQL',
      'Redis',
      'REST APIs',
      'OAuth 2.0',
      'Docker',
      'AWS',
    ],
    featured: true,
    links: {},
    architecture: {
      layers: [
        {
          label: 'Client',
          nodes: [
            { id: 'app', label: 'Product App', detail: 'Next.js' },
            { id: 'admin', label: 'Admin Console' },
          ],
        },
        {
          label: 'Edge',
          nodes: [
            { id: 'api', label: 'API Layer', detail: 'route handlers', tone: 'accent' },
            { id: 'auth', label: 'Auth / Sessions' },
          ],
        },
        {
          label: 'Domain',
          nodes: [
            { id: 'tenancy', label: 'Tenancy & RBAC', tone: 'accent' },
            { id: 'metering', label: 'Usage Metering' },
            { id: 'billing', label: 'Billing Adapter' },
          ],
        },
        {
          label: 'Data',
          nodes: [
            { id: 'db', label: 'PostgreSQL', detail: 'row-level scoping', tone: 'accent' },
            { id: 'cache', label: 'Redis', detail: 'sessions · limits' },
            { id: 'queue', label: 'Queue', detail: 'webhooks · jobs' },
          ],
        },
      ],
      edges: [
        { from: 'app', to: 'api' },
        { from: 'admin', to: 'api' },
        { from: 'api', to: 'auth' },
        { from: 'auth', to: 'cache', label: 'session' },
        { from: 'api', to: 'tenancy' },
        { from: 'tenancy', to: 'db', label: 'scoped query' },
        { from: 'api', to: 'metering' },
        { from: 'metering', to: 'queue' },
        { from: 'billing', to: 'queue', label: 'webhooks' },
        { from: 'queue', to: 'db' },
      ],
      paths: [
        {
          label: 'Authenticated request',
          steps: ['app', 'api', 'auth', 'cache', 'tenancy', 'db'],
          latencies: [0, 9, 4, 2, 3, 17],
        },
        {
          label: 'Billing webhook',
          steps: ['billing', 'queue', 'db'],
          latencies: [0, 6, 21],
        },
      ],
    },
    caseStudy: {
      problem:
        'Early-stage SaaS products tend to grow tenancy by accident: a workspace id threaded through some queries, roles checked in a few handlers, usage counted from logs when someone asks. Each of those becomes a data-leak or billing-accuracy risk as the product grows, and every new feature re-litigates the same questions. The requirement was a foundation that made the correct thing the default.',
      requirements: [
        'Tenant isolation that cannot be bypassed by forgetting a WHERE clause',
        'Authentication with sessions, OAuth sign-in and API keys for machine clients',
        'Role-based permissions checked consistently across every surface',
        'Usage metering accurate enough to bill from',
        'Subscription lifecycle handled through verified, replay-safe webhooks',
        'An admin surface for support: impersonation, plan changes, usage inspection',
        'Migrations safe to run against live tenant data',
      ],
      role: 'Lead engineer. I designed the tenancy and permission model, the metering pipeline, the billing integration and webhook handling, and built the admin console.',
      architecture:
        'Requests pass through an auth layer that resolves a session or API key into a principal with a tenant and a role set. Every data access goes through a scoped repository that requires that tenant context, so an unscoped query is a type error rather than a silent leak. Usage events are recorded on the request path and aggregated by workers. Billing is isolated behind an adapter; the provider’s webhooks land on a queue, are verified and deduplicated, then applied to subscription state.',
      challenges: [
        {
          title: 'Tenant scoping that cannot be forgotten',
          body: 'Relying on developers to add a tenant predicate to every query fails eventually, and the failure is a data leak. Data access was moved behind repositories that cannot be constructed without a tenant context, and the raw client is not exported — so the unsafe path is unavailable rather than merely discouraged.',
        },
        {
          title: 'Metering accurate enough to bill from',
          body: 'Counting usage in the request path is fast but lost on crashes; counting from logs is durable but approximate. Events are written transactionally with the work they describe and aggregated asynchronously, so the billable record and the action that caused it cannot disagree.',
        },
        {
          title: 'Webhooks arriving twice, late, or out of order',
          body: 'Payment providers retry, and events do not always arrive in the order they occurred. Handlers verify the signature, deduplicate on event id, and apply changes based on the state transition rather than assuming the current state — so a replayed or late event is harmless.',
        },
        {
          title: 'Permissions drifting between surfaces',
          body: 'The product UI, the API and the admin console each had their own notion of what a role could do, and they diverged. A single permission matrix is now the source of truth, consumed by all three, with the server-side check authoritative and the UI merely reflecting it.',
        },
        {
          title: 'Migrations against live tenant data',
          body: 'Adding a non-null column or a new index to a large live table can lock it. Migrations are split into expand-and-contract steps, indexes are created concurrently, and backfills run in batches outside the deploy.',
        },
      ],
      decisions: [
        {
          decision: 'Shared schema with enforced row-level scoping, not a database per tenant',
          rationale:
            'One migration path and one connection pool; operationally far simpler at this scale.',
          tradeoff:
            'Isolation depends on correct scoping, so that scoping has to be structurally enforced rather than reviewed.',
        },
        {
          decision: 'Usage events written in the same transaction as the billable action',
          rationale: 'Makes the billing record exactly as durable as the thing it bills for.',
          tradeoff: 'Slightly more write volume on the hot path and a table that needs retention.',
        },
        {
          decision: 'Billing provider behind an adapter interface',
          rationale:
            'Provider APIs are opinionated and change; the domain should not be coupled to one vendor’s object model.',
          tradeoff: 'An extra mapping layer to maintain between domain and provider concepts.',
        },
        {
          decision: 'Single permission matrix shared by every surface',
          rationale: 'Removes the class of bug where the UI allows what the API rejects.',
          tradeoff: 'Permission changes touch one central file, which needs careful review.',
        },
        {
          decision: 'Admin console as a route group in the same app',
          rationale:
            'Reuses auth, data access and components rather than maintaining a second deployment.',
          tradeoff: 'Requires strict route-level authorisation to keep the surfaces separate.',
        },
      ],
      implementation: [
        'Session and API-key authentication resolving to a single typed principal',
        'Tenant-scoped repository layer; the unscoped database client is not exported',
        'Permission matrix in one module, enforced server-side and mirrored in the UI',
        'Usage events written transactionally and aggregated by scheduled workers',
        'Signed, deduplicated webhook handlers applying state transitions idempotently',
        'Redis for sessions and rate limits, with per-tenant and per-key buckets',
        'Admin console with audited impersonation, plan changes and usage inspection',
        'Expand-and-contract migrations with concurrent index creation and batched backfills',
      ],
      performance: [
        'Session lookups served from Redis, keeping auth off the database on every request',
        'Composite indexes lead with the tenant column so scoped queries stay selective',
        'Aggregation moved off the request path, so metering adds a single insert',
        'Rate limiting per tenant and per API key, protecting noisy neighbours from each other',
        'Server components render dashboards without shipping the data-fetching layer to the client',
        'Read-heavy reporting queries served from a replica',
      ],
      result:
        'New features inherit tenancy, permissions and metering instead of reimplementing them, usage is accurate enough to bill from, and support work happens in the admin console rather than in a database shell. [PLACEHOLDER — replace with your real outcome.]',
      metrics: [
        { label: 'API p95', value: '—', placeholder: true },
        { label: 'Tenants supported', value: '—', placeholder: true },
        { label: 'Metering accuracy', value: '—', placeholder: true },
        { label: 'Deploy frequency', value: '—', placeholder: true },
      ],
      media: [
        {
          label: '[PLACEHOLDER] Admin console',
          caption: 'Tenant inspection, plan management and audited impersonation.',
        },
        {
          label: '[PLACEHOLDER] Usage dashboard',
          caption: 'Per-tenant usage against plan limits, aggregated from metering events.',
        },
      ],
    },
    placeholder: true,
  },

  {
    slug: 'realtime-events-gateway',
    name: 'Realtime Events Gateway',
    summary:
      'Horizontally scalable WebSocket gateway with channel subscriptions, replay from cursor and at-least-once delivery.',
    intro:
      'A WebSocket service that lets any application instance serve any client. Connections authenticate, subscribe to channels, survive reconnects, and replay missed messages from their last acknowledged cursor — so a client that slept through a deploy comes back consistent.',
    domains: ['realtime', 'infrastructure', 'core-engine'],
    role: 'Lead engineer — gateway, delivery semantics, scale-out, monitoring',
    status: 'active',
    period: '[PLACEHOLDER] 2024',
    technologies: [
      'Node.js',
      'TypeScript',
      'WebSockets',
      'Redis',
      'PostgreSQL',
      'Docker',
      'AWS',
      'OpenTelemetry',
    ],
    featured: false,
    links: {},
    architecture: {
      layers: [
        { label: 'Client', nodes: [{ id: 'client', label: 'Clients', detail: 'web · mobile' }] },
        {
          label: 'Edge',
          nodes: [
            { id: 'lb', label: 'Load Balancer', detail: 'sticky optional' },
            { id: 'gw', label: 'WS Gateway', detail: 'N instances', tone: 'accent' },
          ],
        },
        {
          label: 'Coordination',
          nodes: [
            { id: 'bus', label: 'Redis Pub/Sub', tone: 'accent' },
            { id: 'registry', label: 'Session Registry' },
            { id: 'log', label: 'Message Log', detail: 'replay cursor' },
          ],
        },
        {
          label: 'Producers',
          nodes: [
            { id: 'api', label: 'Application API' },
            { id: 'workers', label: 'Workers', detail: 'job progress' },
            { id: 'db', label: 'PostgreSQL', detail: 'outbox' },
          ],
        },
      ],
      edges: [
        { from: 'client', to: 'lb', label: 'wss' },
        { from: 'lb', to: 'gw' },
        { from: 'gw', to: 'registry', label: 'presence' },
        { from: 'gw', to: 'bus', label: 'subscribe' },
        { from: 'gw', to: 'log', label: 'replay' },
        { from: 'api', to: 'db', label: 'commit + outbox' },
        { from: 'db', to: 'bus', label: 'publish' },
        { from: 'workers', to: 'bus', label: 'progress' },
      ],
      paths: [
        {
          label: 'Event fan-out',
          steps: ['api', 'db', 'bus', 'gw', 'client'],
          latencies: [0, 14, 3, 2, 6],
        },
        {
          label: 'Reconnect with replay',
          steps: ['client', 'lb', 'gw', 'log', 'client'],
          latencies: [0, 4, 7, 19, 5],
        },
      ],
    },
    caseStudy: {
      problem:
        'A single-process WebSocket server works until there are two processes. Then a client connected to instance A never receives an event emitted on instance B, sticky sessions become a scaling constraint, and every deploy drops every connection. On top of that, a client that reconnects has no way to learn what it missed, so the UI silently diverges from the server.',
      requirements: [
        'Any instance can serve any client — no sticky-session requirement',
        'Authenticated connections with per-channel authorisation',
        'Events emitted anywhere in the system reach every subscribed client',
        'Reconnecting clients replay what they missed from their last acknowledged cursor',
        'A database commit and the event announcing it cannot disagree',
        'Deploys do not lose messages, only connections — which clients recover from',
        'Visibility into connection counts, fan-out latency and delivery failures',
      ],
      role: 'Lead engineer. I built the gateway, the delivery and replay semantics, the outbox integration with the application database, and the monitoring around connection health and fan-out latency.',
      architecture:
        'Clients connect through a load balancer to one of N stateless gateway instances. The gateway authenticates the connection, authorises each channel subscription, and subscribes to the corresponding Redis channels. Producers do not talk to the gateway: application code commits its change and an outbox row in one transaction, and a relay publishes committed outbox rows to Redis. Every message carries a monotonic sequence number per channel and is appended to a bounded message log, which a reconnecting client reads from its last acknowledged cursor.',
      challenges: [
        {
          title: 'Fan-out across instances',
          body: 'Direct connection tracking inside a process cannot reach clients on other instances. Redis pub/sub became the fan-out layer and the gateway became stateless with respect to which client lives where, which also removed the sticky-session requirement from the load balancer.',
        },
        {
          title: 'Commit and event disagreeing',
          body: 'Publishing an event after a transaction commits means a crash in between loses the event; publishing before means an event can describe a change that was rolled back. An outbox table written in the same transaction, with a relay publishing committed rows, makes the two consistent by construction.',
        },
        {
          title: 'Clients missing messages while disconnected',
          body: 'Pub/sub has no memory, so anything published while a client is away is gone. Each channel keeps a bounded, sequence-numbered log; clients acknowledge a cursor and, on reconnect, request everything after it. Past the retention window the client is told to resynchronise from scratch rather than being left silently stale.',
        },
        {
          title: 'Slow clients causing memory growth',
          body: 'A client that stops reading while messages keep arriving grows its send buffer until the process suffers. Per-connection buffers are bounded; when a connection exceeds its limit it is closed with a resynchronise instruction, protecting the instance at the cost of that client reconnecting.',
        },
        {
          title: 'Duplicate delivery',
          body: 'Retries and replay overlaps mean the same message can arrive twice. Delivery is at-least-once with sequence numbers, and the client applies messages idempotently and ignores sequences it has already seen.',
        },
      ],
      decisions: [
        {
          decision: 'Redis pub/sub for fan-out rather than a full message broker',
          rationale:
            'Redis was already in the stack for cache and sessions; latency is low and operations are simple.',
          tradeoff:
            'No built-in durability, which is why the replay log exists alongside it; a higher durability bar would justify a real broker.',
        },
        {
          decision: 'Transactional outbox for producing events',
          rationale: 'Removes the entire class of bug where state and events diverge.',
          tradeoff: 'Adds a relay process and a small publish delay after commit.',
        },
        {
          decision: 'At-least-once delivery with client-side idempotency',
          rationale:
            'Exactly-once across a network is not achievable cheaply; sequence numbers plus idempotent application get the same user-visible result.',
          tradeoff: 'Clients must handle duplicates, so that contract has to be documented and tested.',
        },
        {
          decision: 'Bounded replay window rather than unlimited history',
          rationale: 'Keeps storage and recovery cost predictable.',
          tradeoff: 'Long-absent clients need a full resynchronisation path, which must also be built.',
        },
        {
          decision: 'Stateless gateway instances',
          rationale: 'Allows scaling and rolling deploys without session affinity.',
          tradeoff: 'All coordination state moves to Redis, making it a critical dependency.',
        },
      ],
      implementation: [
        'Node and TypeScript gateway with token authentication at connection time and per-channel authorisation on subscribe',
        'Heartbeat and idle timeout detection to reclaim dead connections promptly',
        'Redis pub/sub subscription managed per channel, shared across connections on the same instance',
        'Outbox relay publishing committed rows in order, with an at-least-once guarantee',
        'Per-channel sequence numbers and a bounded replay log',
        'Bounded per-connection send buffers with a documented overflow policy',
        'Client library with exponential backoff, cursor tracking and idempotent application',
        'Metrics for connections, subscriptions, fan-out latency, replay requests and buffer overflows',
      ],
      performance: [
        'Fan-out cost scales with subscribers per channel, not with total connections',
        'One Redis subscription per channel per instance rather than per connection',
        'Messages batched within a tick to reduce syscall overhead on busy channels',
        'Replay log bounded by length and age, keeping recovery reads small',
        'Payloads kept minimal — ids and deltas, with the client fetching detail when it needs it',
        'Graceful shutdown drains and closes connections so clients reconnect in a controlled way',
      ],
      result:
        'Live features work the same with one instance or ten, deploys cost a reconnect rather than a divergent UI, and a client returning after an outage catches up from its cursor. [PLACEHOLDER — replace with your real outcome and measured fan-out latency.]',
      metrics: [
        { label: 'Fan-out p95', value: '—', placeholder: true },
        { label: 'Concurrent connections', value: '—', placeholder: true },
        { label: 'Replay window', value: '—', placeholder: true },
        { label: 'Delivery failures', value: '—', placeholder: true },
      ],
      media: [
        {
          label: '[PLACEHOLDER] Connection dashboard',
          caption: 'Connections, subscriptions and fan-out latency per channel.',
        },
        {
          label: '[PLACEHOLDER] Reconnect trace',
          caption: 'A client reconnecting and replaying from its last acknowledged cursor.',
        },
      ],
    },
    placeholder: true,
  },

  {
    slug: 'query-performance-rescue',
    name: 'Query Performance Rescue',
    summary:
      'Diagnosing and fixing a PostgreSQL workload that degraded under growth: indexing, access patterns and caching.',
    intro:
      'A focused engagement on an application that had become slow as its data grew. The work was measurement first — finding which queries actually caused the pain — then indexing, query rewrites, removing N+1 access patterns and adding caching where it was safe to invalidate.',
    domains: ['data', 'core-engine', 'infrastructure'],
    role: 'Consulting engineer — diagnosis, optimisation, verification',
    status: 'archived',
    period: '[PLACEHOLDER] 2023',
    technologies: [
      'PostgreSQL',
      'Redis',
      'Python',
      'SQLAlchemy',
      'EXPLAIN ANALYZE',
      'pg_stat_statements',
      'Docker',
    ],
    featured: false,
    links: {},
    architecture: {
      layers: [
        { label: 'Observe', nodes: [{ id: 'stats', label: 'pg_stat_statements', detail: 'ranked by total time' }] },
        {
          label: 'Diagnose',
          nodes: [
            { id: 'explain', label: 'EXPLAIN ANALYZE', tone: 'accent' },
            { id: 'trace', label: 'Request Traces' },
          ],
        },
        {
          label: 'Fix',
          nodes: [
            { id: 'index', label: 'Indexes', detail: 'composite · partial' },
            { id: 'rewrite', label: 'Query Rewrites' },
            { id: 'nplusone', label: 'Access Patterns', detail: 'N+1 removal' },
            { id: 'cache', label: 'Redis Cache', tone: 'accent' },
          ],
        },
        {
          label: 'Verify',
          nodes: [
            { id: 'bench', label: 'Load Replay' },
            { id: 'monitor', label: 'Monitoring', detail: 'regression alerts', tone: 'muted' },
          ],
        },
      ],
      edges: [
        { from: 'stats', to: 'explain' },
        { from: 'stats', to: 'trace' },
        { from: 'explain', to: 'index' },
        { from: 'explain', to: 'rewrite' },
        { from: 'trace', to: 'nplusone' },
        { from: 'rewrite', to: 'cache' },
        { from: 'index', to: 'bench' },
        { from: 'cache', to: 'bench' },
        { from: 'bench', to: 'monitor' },
      ],
      paths: [
        {
          label: 'Diagnose to verified fix',
          steps: ['stats', 'explain', 'index', 'bench', 'monitor'],
          latencies: [0, 0, 0, 0, 0],
        },
      ],
    },
    caseStudy: {
      problem:
        'An application that performed well at launch had become slow in specific places as data grew — some pages took seconds, a few timed out under load, and the database showed high CPU with no obvious single cause. The instinct was to add hardware. The actual problem was a handful of queries doing enormously more work than they needed to.',
      requirements: [
        'Identify the queries responsible for the majority of database time, with evidence',
        'Fix the worst offenders without changing application behaviour',
        'Add indexes without locking live tables',
        'Introduce caching only where invalidation is well defined',
        'Verify improvements against a realistic workload rather than a single request',
        'Leave monitoring behind so a regression is caught early',
      ],
      role: 'Consulting engineer. I did the diagnosis, implemented the fixes, verified them against a replayed workload, and set up the monitoring that keeps the gains from quietly eroding.',
      architecture:
        'Not a build but a loop: rank queries by total time using pg_stat_statements, read the plans for the top entries with EXPLAIN ANALYZE, correlate with application request traces to find N+1 patterns the database alone cannot reveal, apply the narrowest fix that addresses the plan, then verify against a replayed workload before moving to the next.',
      challenges: [
        {
          title: 'The slowest query was not the problem',
          body: 'The query everyone complained about was slow but rare. Ranking by total accumulated time instead of per-call duration surfaced a fast query running thousands of times per page — the real cause. Optimisation without that ranking would have improved the wrong thing.',
        },
        {
          title: 'Indexes that could not be used',
          body: 'Several queries had an index that looked right but could not be used, because a function was applied to the column in the predicate or the leading column of a composite index was absent from the filter. Fixing these meant rewriting predicates to be index-sargable, not adding more indexes.',
        },
        {
          title: 'N+1 patterns invisible from the database',
          body: 'From the database each query looked trivial. Only when correlated with request traces did the pattern appear: one query to list, then one per row to load a relation. Fixing those at the ORM layer with eager loading removed more total time than any single index.',
        },
        {
          title: 'Adding indexes to live tables',
          body: 'A plain CREATE INDEX takes a lock that would have caused an outage on the largest tables. Indexes were created concurrently, outside the deploy, and verified as valid before the queries that depended on them shipped.',
        },
        {
          title: 'Caching as a way to hide the problem',
          body: 'Caching an expensive query makes the symptom disappear and the cause permanent, and adds a staleness bug. Caching was applied only after the underlying query was made reasonable, and only where invalidation could be tied to a specific write.',
        },
      ],
      decisions: [
        {
          decision: 'Measure and rank before changing anything',
          rationale:
            'Optimisation without ranking by total time reliably improves queries that do not matter.',
          tradeoff: 'Slower start; no visible progress during the diagnosis phase.',
        },
        {
          decision: 'Composite and partial indexes over more single-column indexes',
          rationale:
            'Matching the actual predicate and ordering of real queries, while keeping write overhead down.',
          tradeoff: 'Indexes become query-specific, so they need revisiting when access patterns change.',
        },
        {
          decision: 'Fix N+1 patterns in the application, not with a database workaround',
          rationale: 'Removes the work entirely instead of making a repeated query marginally faster.',
          tradeoff: 'Requires application changes and careful review of what is eagerly loaded.',
        },
        {
          decision: 'Cache last, and only with explicit invalidation',
          rationale: 'A cache in front of a bad query postpones the problem and adds a staleness class of bug.',
          tradeoff: 'Less immediate improvement than caching first would have shown.',
        },
        {
          decision: 'Leave regression monitoring in place',
          rationale: 'Query performance degrades gradually with data growth; alerting catches it before users do.',
          tradeoff: 'Requires someone to own the alerts afterwards.',
        },
      ],
      implementation: [
        'pg_stat_statements enabled and queries ranked by total accumulated time',
        'Plans read with EXPLAIN (ANALYZE, BUFFERS) to distinguish bad plans from genuinely large work',
        'Composite and partial indexes matching real predicates and sort orders',
        'Predicates rewritten to be index-sargable where a function or cast was blocking index use',
        'Eager loading applied at the ORM layer to collapse N+1 access patterns',
        'Connection pool sizing corrected to stop the database being saturated by idle connections',
        'Redis caching added for a small number of expensive, well-bounded read paths',
        'Dashboards and alerts on slow-query count and p95 query time by endpoint',
      ],
      performance: [
        'Work removed rather than relocated: fewer rows read per request, not just faster reads',
        'Index-only scans enabled for the hottest list queries by including the selected columns',
        'Pagination moved to keyset where offset-based paging was scanning and discarding rows',
        'Caching applied only to read paths with a clear invalidation trigger',
        'Fixes verified against a replayed production-shaped workload, not a single warm request',
        'Monitoring in place so growth-driven regressions surface before they become incidents',
      ],
      result:
        'The queries responsible for most database time were identified with evidence and fixed at the root, verified against a realistic workload, with monitoring left behind to catch regressions. No hardware was added. [PLACEHOLDER — replace with your real before-and-after numbers.]',
      metrics: [
        { label: 'p95 before → after', value: '—', placeholder: true },
        { label: 'DB CPU reduction', value: '—', placeholder: true },
        { label: 'Queries per request', value: '—', placeholder: true },
        { label: 'Engagement length', value: '—', placeholder: true },
      ],
      media: [
        {
          label: '[PLACEHOLDER] Before / after plan comparison',
          caption: 'EXPLAIN ANALYZE output for the worst query before and after the fix.',
        },
        {
          label: '[PLACEHOLDER] Latency dashboard',
          caption: 'p95 request latency across the optimisation window.',
        },
      ],
    },
    placeholder: true,
  },
];

export const statusLabels: Record<ProjectStatus, string> = {
  production: 'Production',
  active: 'Active',
  prototype: 'Prototype',
  archived: 'Completed',
};

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export const featuredProjects: Project[] = projects.filter((project) => project.featured);

/** Case-study section order, used for the sticky rail on project pages. */
export const caseStudySections = [
  { id: 'problem', label: 'Problem' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'role', label: 'My role' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'technologies', label: 'Technologies' },
  { id: 'performance', label: 'Performance' },
  { id: 'result', label: 'Result' },
  { id: 'demo', label: 'Demo' },
  { id: 'links', label: 'Links' },
] as const;
