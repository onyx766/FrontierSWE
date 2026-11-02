/**
 * Central type system for the engineering-network portfolio.
 * Every piece of site content is typed here; `src/data/*` provides the values.
 */

/* ───────────────────────────── Domains / topology ────────────────────────── */

export const DOMAIN_IDS = [
  'core-engine',
  'ai-systems',
  'data',
  'realtime',
  'infrastructure',
  'frontend',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

/** Node kinds drive visual weight in the topology. */
export type NodeKind = 'core' | 'domain';

/** Link kinds drive packet colour/shape and feed vocabulary. */
export type LinkKind = 'request' | 'data' | 'event';

export interface TopologyNode {
  id: DomainId;
  /** Short label rendered in the diagram, e.g. "AI SYSTEMS". */
  label: string;
  kind: NodeKind;
  /** Polar placement for the desktop radial projection. Angle in degrees, 0 = east. */
  angle: number;
  /** 0 = centre, 1 = outer edge of the layout box. */
  radius: number;
  /** Parallax depth multiplier, 0–1. Core sits shallow, leaves drift more. */
  depth: number;
  /** Order in the mobile vertical spine projection. */
  spineOrder: number;
}

export interface TopologyLink {
  id: string;
  from: DomainId;
  to: DomainId;
  kind: LinkKind;
  /** Visual thickness / traffic weight. */
  weight: 1 | 2 | 3;
  /** Curvature of the bezier, in viewBox units. 0 = straight. */
  curve: number;
}

export interface Capability {
  title: string;
  description: string;
}

export interface SubArchitectureNode {
  id: string;
  label: string;
  /** Column (0-indexed) in the domain sub-architecture grid. */
  column: number;
  /** Row within the column. */
  row: number;
  tone?: 'default' | 'accent' | 'muted';
}

export interface SubArchitectureEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Domain {
  id: DomainId;
  label: string;
  /** Full title used as the page H1, e.g. "Core Engine". */
  title: string;
  /** One-line positioning statement. */
  tagline: string;
  /** Two or three sentences of real substance for the domain page. */
  summary: string;
  capabilities: Capability[];
  stack: string[];
  subArchitecture: {
    nodes: SubArchitectureNode[];
    edges: SubArchitectureEdge[];
  };
}

/* ──────────────────────────────── Projects ───────────────────────────────── */

export type ProjectStatus = 'production' | 'active' | 'prototype' | 'archived';

export interface ArchitectureLayerNode {
  id: string;
  label: string;
  /** Optional sublabel, e.g. "FastAPI" or "pgvector". */
  detail?: string;
  tone?: 'default' | 'accent' | 'muted';
}

export interface ArchitectureLayer {
  /** Layer label shown on the left rail, e.g. "EDGE". */
  label: string;
  nodes: ArchitectureLayerNode[];
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label?: string;
}

/** A declarative, animatable request path through the architecture. */
export interface RequestPath {
  label: string;
  /** Node ids, in order, that a traced request passes through. */
  steps: string[];
  /** Per-step latency in ms, same length as `steps`. Illustrative. */
  latencies: number[];
}

export interface ArchitectureSpec {
  layers: ArchitectureLayer[];
  edges: ArchitectureEdge[];
  paths: RequestPath[];
}

export interface CaseStudyMetric {
  label: string;
  value: string;
  /** Marked true when the number is illustrative rather than measured. */
  placeholder?: boolean;
}

export interface Project {
  slug: string;
  name: string;
  /** One line for cards and meta descriptions. */
  summary: string;
  /** Longer intro paragraph for the case-study header. */
  intro: string;
  domains: DomainId[];
  role: string;
  status: ProjectStatus;
  /** Year or range, e.g. "2024" or "2023 — 2024". */
  period: string;
  technologies: string[];
  featured: boolean;
  links: {
    github?: string;
    live?: string;
  };
  architecture: ArchitectureSpec;
  caseStudy: {
    problem: string;
    requirements: string[];
    role: string;
    architecture: string;
    challenges: { title: string; body: string }[];
    decisions: { decision: string; rationale: string; tradeoff: string }[];
    implementation: string[];
    performance: string[];
    result: string;
    metrics: CaseStudyMetric[];
    /** Described demo surfaces. Replace with real media when available. */
    media: { label: string; caption: string }[];
  };
  /** True while the entry is placeholder content awaiting real detail. */
  placeholder: boolean;
}

/* ──────────────────────────────── Services ───────────────────────────────── */

export interface Service {
  id: string;
  title: string;
  /** Which network domain this service belongs to. */
  domain: DomainId;
  summary: string;
  /** Concrete deliverables a client receives. */
  deliverables: string[];
  /** Typical engagement shape, e.g. "2–6 weeks". */
  typicalScope: string;
}

export interface SmallTask {
  title: string;
  description: string;
  /** Rough turnaround, e.g. "1–3 days". */
  turnaround: string;
}

export interface EngagementModel {
  title: string;
  description: string;
  bestFor: string;
}

/* ─────────────────────────────── Experience ──────────────────────────────── */

export interface ExperienceEntry {
  id: string;
  role: string;
  organisation: string;
  period: string;
  summary: string;
  highlights: string[];
  stack: string[];
  domains: DomainId[];
  placeholder: boolean;
}

export interface StackItem {
  name: string;
  /** Depth of experience, 1–5. */
  depth: 1 | 2 | 3 | 4 | 5;
}

export interface StackGroup {
  label: string;
  domain: DomainId;
  items: StackItem[];
}

/* ──────────────────────────────── Profile ────────────────────────────────── */

export type AvailabilityState = 'available' | 'limited' | 'unavailable';

export interface Profile {
  name: string;
  role: string;
  tagline: string;
  yearsExperience: string;
  location: string;
  timezone: string;
  availability: {
    state: AvailabilityState;
    label: string;
    detail: string;
  };
  contact: {
    email: string;
    github?: string;
    linkedin?: string;
    x?: string;
    resumeUrl?: string;
    /** Placeholder flag so the UI can mark unverified values. */
    placeholder: boolean;
  };
}

/* ───────────────────────── Live feed / event stream ──────────────────────── */

export type FeedEventKind =
  | 'API REQUEST'
  | 'DB QUERY'
  | 'CACHE HIT'
  | 'MODEL RESPONSE'
  | 'TOOL CALL'
  | 'WS EVENT'
  | 'QUEUE JOB'
  | 'DEPLOY'
  | 'HEALTH CHECK'
  | 'VECTOR SEARCH';

export interface FeedEvent {
  id: string;
  kind: FeedEventKind;
  /** Right-hand detail, e.g. "POST /agent/run". */
  detail: string;
  /** Latency in ms, or null for events without one (cache hit). */
  latencyMs: number | null;
  status: 'ok' | 'warn' | 'error';
  /** Which topology link this event travelled, for diagram/feed coherence. */
  linkId: string;
  /** Node that should pulse. */
  targetNode: DomainId;
}

/* ──────────────────────────── Assistant (Ask AI) ─────────────────────────── */

export interface AssistantSource {
  label: string;
  href: string;
}

export interface AssistantAnswer {
  answer: string;
  sources: AssistantSource[];
  /** True when served by the built-in mock knowledge base. */
  mock: boolean;
}

/* ───────────────────────── Start-project inquiry form ────────────────────── */

export const NEED_TYPES = [
  'AI / LLM System',
  'SaaS Product',
  'Backend / API',
  'Existing Bug',
  'AI Integration',
  'Realtime System',
  'Database / Performance',
  'MVP',
  'Other',
] as const;

export type NeedType = (typeof NEED_TYPES)[number];

export const BUDGET_RANGES = [
  'Under $1k — small task',
  '$1k — $5k',
  '$5k — $15k',
  '$15k — $50k',
  '$50k+',
  'Not sure yet',
] as const;

export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const TIMELINES = [
  'ASAP / urgent',
  'Within 2 weeks',
  'Within 1 month',
  '1 — 3 months',
  'Flexible',
] as const;

export type Timeline = (typeof TIMELINES)[number];

export interface InquiryPayload {
  needType: NeedType;
  description: string;
  currentStack: string;
  budget: BudgetRange;
  timeline: Timeline;
  name: string;
  email: string;
  company: string;
}

export type InquiryFieldErrors = Partial<Record<keyof InquiryPayload, string>>;
