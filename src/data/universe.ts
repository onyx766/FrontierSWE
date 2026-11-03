import type { DomainId } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE UNIVERSE  —  HOMEPAGE WORLD CONTENT
 * ─────────────────────────────────────────────────────────────────────────────
 * What the 3D homepage contains and where it sits. No copy or placement lives
 * in the scene code, so moving a project to another island, renaming a label or
 * adding a stop is an edit here and nowhere else.
 *
 * The long-form explanations are not written here at all: `beats.ts` derives
 * them from `src/data/projects.ts`, `domains.ts`, `experience.ts` and
 * `services.ts`, so the robot cannot contradict the rest of the site.
 *
 * Placement is polar, matching the convention in `domains.ts`:
 *   `bearing` — compass degrees seen from above. 0 is north (away from the
 *               opening camera), 90 east, 180 south (towards the camera).
 *   `angle`   — on an island, degrees from that island's outward direction.
 *               Positive turns towards increasing bearing.
 */

export const ISLAND_IDS = [
  'ai-core',
  'about',
  'experience-archive',
  'data-vault',
  'backend-engine',
  'project-lab',
] as const;

export type IslandId = (typeof ISLAND_IDS)[number];

/** Neon families used by the scene. Resolved to colours in `scene/palette.ts`. */
export type IslandAccent = 'violet' | 'blue' | 'orange' | 'cyan';

export type StationSubject =
  | { type: 'project'; slug: string }
  | { type: 'domain'; domain: DomainId }
  | { type: 'welcome' }
  | { type: 'services' }
  | { type: 'career' }
  | { type: 'capabilities' }
  | { type: 'about' }
  | { type: 'principles' };

export interface StationContent {
  /** Stable id. Project stations use the project slug. */
  id: string;
  /** Short name on the beacon, mission log and map. */
  title: string;
  subject: StationSubject;
  /** Degrees from the island's outward direction. Ignored for core stations. */
  angle: number;
}

export interface IslandContent {
  id: IslandId;
  /** Plate headline. May contain `\n` to force a two-line plate. */
  label: string;
  /** Plate sub-line. */
  sublabel: string;
  bearing: number;
  accent: IslandAccent;
  /** Sentence shown when the robot steps onto the island. */
  arrival: string;
  stations: StationContent[];
}

export const islands: IslandContent[] = [
  {
    id: 'ai-core',
    label: 'AI CORE',
    sublabel: 'LLM · Agents · RAG',
    bearing: 0,
    accent: 'violet',
    arrival: 'LLM systems that survive real traffic.',
    stations: [
      {
        id: 'agent-orchestration-platform',
        title: 'Agent Orchestration Platform',
        subject: { type: 'project', slug: 'agent-orchestration-platform' },
        angle: -56,
      },
      {
        id: 'domain-ai-systems',
        title: 'AI Systems',
        subject: { type: 'domain', domain: 'ai-systems' },
        angle: 0,
      },
      {
        id: 'rag-knowledge-service',
        title: 'RAG Knowledge Service',
        subject: { type: 'project', slug: 'rag-knowledge-service' },
        angle: 56,
      },
    ],
  },
  {
    id: 'about',
    label: 'ABOUT',
    sublabel: 'Me · Skills · Tools',
    bearing: 60,
    accent: 'blue',
    arrival: 'Who builds all of this, and how.',
    stations: [
      {
        id: 'about-profile',
        title: 'About Ryan',
        subject: { type: 'about' },
        angle: -42,
      },
      {
        id: 'engineering-principles',
        title: 'Engineering Principles',
        subject: { type: 'principles' },
        angle: 42,
      },
    ],
  },
  {
    id: 'experience-archive',
    label: 'EXPERIENCE\nARCHIVE',
    sublabel: 'Career · Timeline',
    bearing: 120,
    accent: 'orange',
    arrival: 'The record of what has been shipped.',
    stations: [
      {
        id: 'career-timeline',
        title: 'Career Timeline',
        subject: { type: 'career' },
        angle: -42,
      },
      {
        id: 'capability-matrix',
        title: 'Capability Matrix',
        subject: { type: 'capabilities' },
        angle: 42,
      },
    ],
  },
  {
    id: 'data-vault',
    label: 'DATA VAULT',
    sublabel: 'PostgreSQL · Redis · Queues',
    bearing: 180,
    accent: 'orange',
    arrival: 'Where slow systems get fast again.',
    stations: [
      {
        id: 'query-performance-rescue',
        title: 'Query Performance Rescue',
        subject: { type: 'project', slug: 'query-performance-rescue' },
        angle: -42,
      },
      {
        id: 'domain-data',
        title: 'Data',
        subject: { type: 'domain', domain: 'data' },
        angle: 42,
      },
    ],
  },
  {
    id: 'backend-engine',
    label: 'BACKEND ENGINE',
    sublabel: 'APIs · System Design · Scaling',
    bearing: 240,
    accent: 'blue',
    arrival: 'The service layer everything else depends on.',
    stations: [
      {
        id: 'realtime-events-gateway',
        title: 'Realtime Events Gateway',
        subject: { type: 'project', slug: 'realtime-events-gateway' },
        angle: -42,
      },
      {
        id: 'domain-core-engine',
        title: 'Core Engine',
        subject: { type: 'domain', domain: 'core-engine' },
        angle: 42,
      },
    ],
  },
  {
    id: 'project-lab',
    label: 'PROJECT LAB',
    sublabel: 'Featured Work',
    bearing: 300,
    accent: 'cyan',
    arrival: 'Products built from the foundation up.',
    stations: [
      {
        id: 'saas-platform-core',
        title: 'SaaS Platform Core',
        subject: { type: 'project', slug: 'saas-platform-core' },
        angle: -42,
      },
      {
        id: 'services',
        title: 'Services',
        subject: { type: 'services' },
        angle: 42,
      },
    ],
  },
];

/** The stop on the core loop, directly in front of the crystal. The robot starts here. */
export const coreStation: StationContent & { bearing: number } = {
  id: 'welcome',
  title: 'Mission Briefing',
  subject: { type: 'welcome' },
  angle: 0,
  bearing: 180,
};

/** Where the 3D world lives. The plain portfolio links here; nothing 3D loads before. */
export const WORLD_PATH = '/world';

/** Query parameter that opens the world at one station, e.g. `/world?at=<project-slug>`. */
export const WORLD_AT_PARAM = 'at';

/** The station that explains a project, if the world has one. Station ids are project slugs. */
export function projectStationId(slug: string): string | null {
  const found = islands.some((island) =>
    island.stations.some(
      (station) => station.subject.type === 'project' && station.subject.slug === slug,
    ),
  );
  return found ? slug : null;
}

/** Link into the world: the opening shot, or straight to one station. */
export function worldHref(stationId?: string | null): string {
  return stationId
    ? `${WORLD_PATH}?${WORLD_AT_PARAM}=${encodeURIComponent(stationId)}`
    : WORLD_PATH;
}

/** Every project, then the people-facing stops. The guided tour walks this list. */
export const tourOrder: string[] = [
  'welcome',
  'agent-orchestration-platform',
  'rag-knowledge-service',
  'saas-platform-core',
  'realtime-events-gateway',
  'query-performance-rescue',
  'career-timeline',
  'about-profile',
];

/** The plate on the crystal. */
export const corePlate = { title: 'RYAN', lines: ['AI / FULL-STACK', 'ENGINEER'] };

/** Tag on a station hologram whose content is still placeholder. */
export const placeholderLabel = 'Placeholder';

/** Lines of the opening statement, rendered as one <h1>. */
export const heroLines: string[] = [
  'Building',
  'AI Systems,',
  'Scalable Backends',
  '& SaaS Products.',
];

/** The mono caption under the opening statement. */
export const heroCaption: string[] = ['of engineering'];

/** Rows of the opening status panel. Decorative status, not a measured uptime. */
export const statusRows: { label: string; value: string }[] = [
  { label: 'AI Systems', value: 'Online' },
  { label: 'Backend', value: 'Online' },
  { label: 'Database', value: 'Online' },
  { label: 'Projects', value: 'Online' },
];

export const controlsHelp: { keys: string[]; label: string }[] = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Walk' },
  { keys: ['Shift'], label: 'Run' },
  { keys: ['Space'], label: 'Jump' },
  { keys: ['E'], label: 'Next' },
  { keys: ['Q'], label: 'Back' },
  { keys: ['Esc'], label: 'Close' },
  { keys: ['T'], label: 'Guided tour' },
  { keys: ['C'], label: 'Overview' },
];

/** Every word on the HUD that does not come from the content above. */
export const hudCopy = {
  /** The world's own name in its top bar; the plain site keeps `SITE_NAME`. */
  brand: { name: 'Ryan', title: 'Engineering Universe' },
  exit: { label: 'Exit 3D', long: 'Return to portfolio' },
  skipToLog: 'Skip to mission log',
  cta: 'Start a Project',
  menu: { open: 'Open menu', close: 'Close menu' },
  /** Short pill text per `AvailabilityState`; the full label is in `profile.availability`. */
  availability: { available: 'Available', limited: 'Limited', unavailable: 'Booked' },
  yearsUnit: 'years',
  status: { title: 'System status', link: 'Open the system map on the portfolio' },
  explore: {
    title: 'Explore',
    hint: 'Drag · Scroll · Click',
    touchHint: 'Drag · Tap',
    action: 'Walk the world on foot',
    walk: 'to walk',
  },
  loading: {
    label: 'Assembling the universe',
    slow: 'Taking a while on this connection. The plain pages are ready now:',
  },
  failure: {
    title: 'The 3D world could not start here',
    body: 'This browser or device could not open WebGL. Nothing is lost: every project and system is on the plain pages.',
    system: 'Back to the portfolio',
    projects: 'Browse the projects',
  },
  noScript: 'The 3D world needs JavaScript. Every project below is a plain page.',
  log: {
    title: 'Mission log',
    /** Follows "3 of 14". */
    explored: 'explored',
    coreGroup: 'The Crystal',
    here: 'Here',
    show: 'Show the mission log',
    hide: 'Hide the mission log',
  },
  map: { label: 'Map', travel: 'Walk to' },
  actions: {
    overview: 'Overview',
    tour: 'Guided tour',
    stopTour: 'Stop tour',
    voiceOn: 'Turn the voice off',
    voiceOff: 'Turn the voice on',
    voice: 'Voice',
  },
  travel: { walking: 'Walking to', cancel: 'Cancel', tourStop: 'Stop' },
  briefing: {
    close: 'Close briefing',
    back: 'Back',
    next: 'Next',
    nextStop: 'Next stop',
    beats: 'Sections',
    goTo: 'Go to',
    open: 'Open briefing',
  },
  controls: {
    label: 'Controls',
    help: 'Show all controls',
    hideHelp: 'Hide controls',
    pointer: [
      { keys: ['Drag'], label: 'Orbit' },
      { keys: ['Wheel'], label: 'Zoom' },
      { keys: ['?'], label: 'This list' },
    ],
  },
} as const;
