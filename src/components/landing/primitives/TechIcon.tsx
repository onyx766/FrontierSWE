import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TechIconName } from './techIconNames';

export type { TechIconName } from './techIconNames';

/**
 * Technology glyphs: small, original renditions in each project's colours —
 * drawn to be recognised at 20–28px on white, not traced from trademark
 * artwork. All are 24×24.
 *
 * Gradients are avoided except where the colour story needs one (LlamaIndex):
 * the same glyph can appear several times on a page, and a url(#id) fill
 * resolves to the first element with that id, which may sit in a hidden
 * subtree. Its fill names a solid fallback for exactly that case.
 *
 * On a dark surface, set `--tech-ink` (and `--tech-paper` for the knock-out
 * inside Next.js) on any ancestor, e.g. `[--tech-ink:#fff] [--tech-paper:#121029]`:
 * the near-black parts — OpenAI, three.js, Next.js, the AWS letters,
 * LangChain's dark link, the WebSockets arrow — read those instead of their
 * brand dark, the way the marks themselves invert on dark backgrounds.
 */

const INK = '#0e0c22';

/** Inline styles, because var() is not allowed in SVG presentation attributes. */
const inkStroke = (brand: string) => ({ stroke: `var(--tech-ink, ${brand})` });
const inkFill = (brand: string) => ({ fill: `var(--tech-ink, ${brand})` });
const paperStroke = { stroke: 'var(--tech-paper, #fff)' };

/** Claude's starburst as [angle, length] per ray, a little irregular so it reads drawn rather than stamped. */
const CLAUDE_RAYS: [number, number][] = [
  [0, 9.7],
  [31, 8.2],
  [59, 9.4],
  [91, 8.5],
  [121, 9.8],
  [149, 8.1],
  [181, 9.5],
  [210, 8.4],
  [239, 9.7],
  [270, 8.6],
  [300, 9.3],
  [331, 8.3],
];

const LOBES = [0, 60, 120, 180, 240, 300];

const PYTHON_SNAKE =
  'M10.2 2H13.1A2.2 2.2 0 0 1 15.3 4.2V9.1A2.2 2.2 0 0 1 13.1 11.3H8.5A1.2 1.2 0 0 0 7.3 12.5V14.3A2.2 2.2 0 0 1 5.1 16.5H4.7A2.2 2.2 0 0 1 2.5 14.3V9.2A2.2 2.2 0 0 1 4.7 7H6.8A1.2 1.2 0 0 0 8 5.8V4.2A2.2 2.2 0 0 1 10.2 2Z';

const TAILWIND_WAVE =
  'c1.2-3.6 3.6-4.9 6.9-3.6 1.5.6 2.4 1.8 3.8 2.4 1.7.7 3.3.2 4.6-1.4-1.2 3.6-3.6 4.9-6.9 3.6-1.5-.6-2.4-1.8-3.8-2.4-1.7-.7-3.3-.2-4.6 1.4Z';

const CELERY_LEAF = 'M0 0C-1.9-1.3-2.3-4-.9-6.3c.3-.5.8-.5 1.1 0C1.6-4 1.4-1.3 0 0Z';

const VECTOR_ARROW = 'M12 15.4V6.6M9.8 8.8 12 6.6l2.2 2.2';

const GLYPHS: Record<TechIconName, ReactNode> = {
  /* ── AI / LLM ─────────────────────────────────────────────────────────── */
  openai: (
    <g fill="none" strokeWidth="1.55" style={inkStroke(INK)}>
      {LOBES.map((angle) => (
        <rect key={angle} x="9" y="4.3" width="10.4" height="5.2" rx="2.6" transform={`rotate(${angle} 12 12)`} />
      ))}
    </g>
  ),
  claude: (
    <g stroke="#d97757" strokeWidth="2.3" strokeLinecap="round">
      {CLAUDE_RAYS.map(([angle, length]) => (
        <path key={angle} d={`M12 11.2V${(12 - length).toFixed(1)}`} transform={`rotate(${angle} 12 12)`} />
      ))}
    </g>
  ),
  langchain: (
    <g fill="none" strokeWidth="2" transform="rotate(-45 12 12)">
      <rect x="2.6" y="8.7" width="11.4" height="6.6" rx="3.3" style={inkStroke('#1c3c3c')} />
      <rect x="10" y="8.7" width="11.4" height="6.6" rx="3.3" stroke="#2f8f83" />
      {/* Redrawn over the second link at one crossing, so the two interlock. */}
      <path d="M10.7 8.7A3.3 3.3 0 0 1 13.23 9.88" style={inkStroke('#1c3c3c')} />
    </g>
  ),
  llamaindex: (
    <>
      <defs>
        <linearGradient id="ti-llamaindex-fill" x1="19" y1="3" x2="6" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f472b6" />
          <stop offset="0.5" stopColor="#a855f7" />
          <stop offset="1" stopColor="#6d4aff" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ti-llamaindex-fill) #a855f7"
        transform="translate(-0.85 0)"
        d="M5.3 22.5 5.9 12.2C6 9.8 6.4 8.2 7.1 7.2L6.6 2.6C6.5 1.6 7.6 1.2 8 2L9.4 5.6 10.1 5.5 10.2 2.3C10.3 1.4 11.5 1.3 11.6 2.3L11.9 6C14.4 6.2 16.9 7.2 18.8 8.9 20.4 10.3 20.2 12.6 18.2 13L14 13.6C12.7 13.8 12 14.6 12.1 15.8L12.6 22.5Z"
      />
      <circle cx="12.75" cy="9.2" r="1.05" fill="#fff" />
    </>
  ),
  rag: (
    <>
      <g fill="none" stroke="#6d4aff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 10V6.4L10.6 2.5H5.3A1.8 1.8 0 0 0 3.5 4.3v14.4a1.8 1.8 0 0 0 1.8 1.8H10" />
        <path d="M10.4 2.6v3.1a.9.9 0 0 0 .9.9h3.1" />
        <path d="M6.6 9.2h4.6M6.6 12.4h3M6.6 15.6h2.2" stroke="#b6a4ff" />
      </g>
      <circle cx="15.6" cy="15.6" r="4.1" fill="#efeafe" stroke="#4f2ee8" strokeWidth="1.9" />
      <path d="m18.6 18.6 2.9 2.9" stroke="#4f2ee8" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  agents: (
    <>
      <path d="M12 6.6V3.9" stroke="#6d4aff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="3.2" r="1.6" fill="#9b5cff" />
      <rect x="2.2" y="12" width="2.2" height="4.4" rx="1.1" fill="#9b5cff" />
      <rect x="19.6" y="12" width="2.2" height="4.4" rx="1.1" fill="#9b5cff" />
      <rect x="4" y="6.6" width="16" height="14.2" rx="4.2" fill="#6d4aff" />
      <rect x="6.4" y="10" width="11.2" height="6.4" rx="3.2" fill="#fff" />
      <circle cx="9.7" cy="13.2" r="1.35" fill="#4f2ee8" />
      <circle cx="14.3" cy="13.2" r="1.35" fill="#4f2ee8" />
      <path d="M10.2 18.4h3.6" stroke="#c9bbff" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),

  /* ── Backend ──────────────────────────────────────────────────────────── */
  python: (
    <>
      <path fill="#3776ab" d={PYTHON_SNAKE} />
      <path fill="#ffd43b" d={PYTHON_SNAKE} transform="rotate(180 12 12)" />
      <circle cx="10.6" cy="4.5" r="0.95" fill="#fff" />
      <circle cx="13.4" cy="19.5" r="0.95" fill="#fff" />
    </>
  ),
  fastapi: (
    <>
      <circle cx="12" cy="12" r="10" fill="#009688" />
      <path d="M13.4 4.6 7.6 13.1h4.1l-1.1 6.3 5.8-8.6h-4.1Z" fill="#fff" />
    </>
  ),
  nodejs: (
    <>
      <path
        d="M12 2.9 19.9 7.45v9.1L12 21.1l-7.9-4.55v-9.1Z"
        fill="#5fa04e"
        stroke="#5fa04e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
        <path d="M10 8.6v5.3a1.65 1.65 0 0 1-3.3 0" />
        <path d="M17.2 9.5c-.4-.7-1.1-1-1.9-1-1.1 0-1.9.6-1.9 1.5 0 2.1 4 1.3 4 3.6 0 1-.9 1.7-2.2 1.7-1 0-1.8-.4-2.2-1.2" />
      </g>
    </>
  ),
  typescript: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="3.6" fill="#3178c6" />
      <g fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12.2h5.4M10.7 12.2v7.2" />
        <path d="M19.4 13.3c-.4-.8-1.2-1.2-2.2-1.2-1.3 0-2.2.7-2.2 1.7 0 2.4 4.6 1.4 4.6 3.9 0 1.1-1 1.9-2.4 1.9-1.2 0-2.1-.5-2.6-1.4" />
      </g>
    </>
  ),
  django: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="3.6" fill="#0c4b33" />
      <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="9.3" cy="14.3" r="2.5" />
        <path d="M11.8 7.6v9.2" />
        <path d="M15.9 11.4v6.6c0 1.4-.7 2.1-2 2.1" />
      </g>
      <circle cx="15.9" cy="8.6" r="1.05" fill="#fff" />
    </>
  ),
  websockets: (
    <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5h15.5M15.2 4.8l3.8 3.7-3.8 3.7" style={inkStroke(INK)} />
      <path d="M20.5 15.5H5M8.8 11.8 5 15.5l3.8 3.7" stroke="#6d4aff" />
    </g>
  ),

  /* ── Frontend ─────────────────────────────────────────────────────────── */
  react: (
    <>
      <g fill="none" stroke="#1fb3df" strokeWidth="1.3">
        <ellipse cx="12" cy="12" rx="10" ry="3.9" />
        <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(120 12 12)" />
      </g>
      <circle cx="12" cy="12" r="2" fill="#1fb3df" />
    </>
  ),
  nextjs: (
    <>
      <circle cx="12" cy="12" r="10" style={inkFill('#0a0a0a')} />
      <path
        d="M8.7 16.3V7.7l7.2 9.6M15.3 7.7v5.2"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={paperStroke}
      />
    </>
  ),
  tailwind: (
    <g fill="#38bdf8">
      <path d={`M6.3 10.6${TAILWIND_WAVE}`} />
      <path d={`M2.4 16.4${TAILWIND_WAVE}`} />
    </g>
  ),
  threejs: (
    <g fill="none" strokeWidth="1.2" strokeLinejoin="round" style={inkStroke(INK)}>
      <path d="M12 2.6 21.6 19.7H2.4Z" />
      <path d="M7.2 11.15h9.6L12 19.7Z" />
      <path d="M9.6 6.9h4.8L12 11.15ZM4.8 15.4h4.8l-2.4 4.3ZM14.4 15.4h4.8l-2.4 4.3Z" />
    </g>
  ),
  framer: (
    <>
      <path d="M5.5 2.5h13v6.1H12Z" fill="#ff4f9a" />
      <path d="M5.5 9.5H12l6.5 6.1h-13Z" fill="#c04cf0" />
      <path d="M5.5 16.4H12v6.1Z" fill="#7b3ff2" />
    </>
  ),

  /* ── Data ─────────────────────────────────────────────────────────────── */
  postgresql: (
    <>
      <path fill="#6f9bc8" d="M7.4 5.4C4.6 4.2 1.9 5.9 2 9.5c.1 3.2 2.4 5.1 5.6 4.4Z" />
      <path fill="#6f9bc8" d="M16.6 5.4c2.8-1.2 5.5.5 5.4 4.1-.1 3.2-2.4 5.1-5.6 4.4Z" />
      <ellipse cx="12" cy="9.8" rx="5.4" ry="6" fill="#336791" />
      <path d="M12 14v4.3c0 1.7 1.3 2.5 2.9 1.8" fill="none" stroke="#336791" strokeWidth="3" strokeLinecap="round" />
      <circle cx="10" cy="9.2" r="0.9" fill="#fff" />
      <circle cx="14" cy="9.2" r="0.9" fill="#fff" />
    </>
  ),
  redis: (
    <>
      <path d="M3.5 16 12 19.1l8.5-3.1v2.2L12 21.3l-8.5-3.1Z" fill="#a41e11" />
      <path d="M12 12.9 20.5 16 12 19.1 3.5 16Z" fill="#dc382d" />
      <path d="M3.5 11 12 14.1l8.5-3.1v2.2L12 16.3l-8.5-3.1Z" fill="#a41e11" />
      <path d="M12 7.9 20.5 11 12 14.1 3.5 11Z" fill="#dc382d" />
      <path d="M3.5 6 12 9.1 20.5 6v2.2L12 11.3 3.5 8.2Z" fill="#a41e11" />
      <path d="M12 2.9 20.5 6 12 9.1 3.5 6Z" fill="#dc382d" />
      <path d="m12 4.4.7 1 1.3.4-1.3.4-.7 1-.7-1-1.3-.4 1.3-.4Z" fill="#fff" />
    </>
  ),
  pgvector: (
    <>
      <path
        d="M5.5 15.6v3.3c0 1.3 2.9 2.4 6.5 2.4s6.5-1.1 6.5-2.4v-3.3"
        fill="#efeafe"
        stroke="#6d4aff"
        strokeWidth="1.4"
      />
      <ellipse cx="12" cy="15.6" rx="6.5" ry="2.4" fill="#fff" stroke="#6d4aff" strokeWidth="1.4" />
      <g fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15.4V4.2M9.8 6.4 12 4.2l2.2 2.2" stroke="#6d4aff" />
        <path d={VECTOR_ARROW} stroke="#9b5cff" transform="rotate(-52 12 15.4)" />
        <path d={VECTOR_ARROW} stroke="#4f46e5" transform="rotate(52 12 15.4)" />
      </g>
      <circle cx="12" cy="15.4" r="1.4" fill="#4f2ee8" />
    </>
  ),
  celery: (
    <>
      <g fill="none" strokeLinecap="round">
        <path d="M11 21c-.3-4.4-1.4-8.3-3.6-11.6" stroke="#7cb342" strokeWidth="2.4" />
        <path d="M13 21c.3-4.4 1.4-8.3 3.6-11.6" stroke="#7cb342" strokeWidth="2.4" />
        <path d="M12 21.2V9.6" stroke="#9ccc65" strokeWidth="3" />
      </g>
      <g fill="#37814a">
        <path d={CELERY_LEAF} transform="translate(12 9.8)" />
        <path d={CELERY_LEAF} transform="translate(7.4 9.6) rotate(-35)" />
        <path d={CELERY_LEAF} transform="translate(16.6 9.6) rotate(35)" />
      </g>
    </>
  ),
  prisma: (
    <>
      <path
        fill="#0c344b"
        d="M11.1 2.6a1 1 0 0 1 1.75.05l7.5 15.5a1.1 1.1 0 0 1-.68 1.53l-9.7 2.9a1.1 1.1 0 0 1-1.2-.42L3.6 15.9a1.1 1.1 0 0 1 .02-1.27Z"
      />
      <path fill="#fff" d="m12.3 6.4 5.9 12.1-7.6 2.3Z" />
    </>
  ),
  pipelines: (
    <>
      <path
        d="M6.5 12C9 12 9 6.5 12 6.5M6.5 12c2.5 0 2.5 5.5 5.5 5.5M12 6.5c3 0 3 5.5 5.5 5.5M12 17.5c3 0 3-5.5 5.5-5.5"
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="2" y="9.5" width="5" height="5" rx="1.4" fill="#4f46e5" />
      <circle cx="12" cy="6.5" r="2.3" fill="#fff" stroke="#4f46e5" strokeWidth="1.6" />
      <circle cx="12" cy="17.5" r="2.3" fill="#fff" stroke="#4f46e5" strokeWidth="1.6" />
      <rect x="17" y="9.5" width="5" height="5" rx="1.4" fill="#4f46e5" />
    </>
  ),

  /* ── Infrastructure ───────────────────────────────────────────────────── */
  docker: (
    <>
      <path
        fill="#2496ed"
        d="M2.2 11.6h16.1c.5-1.5 1.7-2.4 3.1-2.2.6.1.8.6.5 1.1-.5.8-1.4 1-2 1.3-1 4.6-4.6 7.8-9.4 7.8-4.4 0-7.6-2.9-8.3-7.4Z"
      />
      <g fill="#2496ed">
        <rect x="3.6" y="8.7" width="2.4" height="2.3" rx="0.35" />
        <rect x="6.4" y="8.7" width="2.4" height="2.3" rx="0.35" />
        <rect x="9.2" y="8.7" width="2.4" height="2.3" rx="0.35" />
        <rect x="12" y="8.7" width="2.4" height="2.3" rx="0.35" />
        <rect x="14.8" y="8.7" width="2.4" height="2.3" rx="0.35" />
        <rect x="6.4" y="6" width="2.4" height="2.3" rx="0.35" />
        <rect x="9.2" y="6" width="2.4" height="2.3" rx="0.35" />
        <rect x="12" y="6" width="2.4" height="2.3" rx="0.35" />
        <rect x="12" y="3.3" width="2.4" height="2.3" rx="0.35" />
      </g>
      <circle cx="6" cy="14.6" r="0.9" fill="#fff" />
    </>
  ),
  aws: (
    <g transform="translate(0 -1.2)">
      <g fill="none" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" style={inkStroke('#232f3e')}>
        <path d="M7.9 8.6v4.3M7.9 10.6c0-1.3-.9-2.1-2-2.1s-2 .9-2 2.2.9 2.2 2 2.2 2-.9 2-2.3" />
        <path d="m9.6 8.5 1.5 4.4 1.5-3.6 1.5 3.6 1.5-4.4" />
        <path d="M19.9 9.1c-.3-.4-.8-.7-1.5-.7-.9 0-1.5.5-1.5 1.1 0 1.5 3.2.9 3.2 2.4 0 .7-.7 1.2-1.7 1.2-.7 0-1.3-.3-1.7-.8" />
      </g>
      <g fill="none" stroke="#ff9900" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15.6c4.6 3.3 11.2 3.4 15.6.4" strokeWidth="1.8" />
        <path d="m17.3 15.3 2.6.5-.6 2.5" strokeWidth="1.6" />
      </g>
    </g>
  ),
  terraform: (
    <>
      <path d="M2.6 1.8 8.2 4.8v6.4L2.6 8.2Z" fill="#9b6dd8" />
      <path d="m9 5.3 5.6 3v6.4L9 11.7Z" fill="#7b42bc" />
      <path d="m9 12.7 5.6 3v6.4L9 19.1Z" fill="#7b42bc" />
      <path d="M15.4 8.3 21 5.3v6.4l-5.6 3Z" fill="#5c2d91" />
    </>
  ),
  cicd: (
    <>
      <g fill="none" strokeWidth="2.3" strokeLinecap="round">
        <path
          d="M12 12c-2-3-3.7-4.4-5.8-4.4C3.8 7.6 2.2 9.6 2.2 12s1.6 4.4 4 4.4c2.1 0 3.8-1.4 5.8-4.4"
          stroke="#3b82f6"
        />
        <path
          d="M12 12c2 3 3.7 4.4 5.8 4.4 2.4 0 4-2 4-4.4s-1.6-4.4-4-4.4c-2.1 0-3.8 1.4-5.8 4.4"
          stroke="#22c55e"
        />
      </g>
      {/* Arrowheads ride the figure-eight in its direction of travel. */}
      <path d="m16.1 7.6 2.9-2.1v4.2Z" fill="#22c55e" stroke="#22c55e" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="m7.9 16.4-2.9-2.1v4.2Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="0.8" strokeLinejoin="round" />
    </>
  ),
  linux: (
    <>
      <path
        fill="#1d1b26"
        d="M12 2.4c-2.6 0-4.2 2-4.2 4.6 0 1.2.3 2.1-.4 3.3-1.2 2-2.6 3.8-2.6 6.6 0 3.2 3 5 7.2 5s7.2-1.8 7.2-5c0-2.8-1.4-4.6-2.6-6.6-.7-1.2-.4-2.1-.4-3.3 0-2.6-1.6-4.6-4.2-4.6Z"
      />
      <ellipse cx="12" cy="15.6" rx="4.2" ry="5" fill="#fff" />
      <ellipse cx="10.4" cy="6.6" rx="1.2" ry="1.45" fill="#fff" />
      <ellipse cx="13.6" cy="6.6" rx="1.2" ry="1.45" fill="#fff" />
      <circle cx="10.7" cy="6.9" r="0.55" fill="#1d1b26" />
      <circle cx="13.3" cy="6.9" r="0.55" fill="#1d1b26" />
      <path d="M10.2 9.2c.6-.7 1.2-1 1.8-1s1.2.3 1.8 1c-.5.8-1.1 1.2-1.8 1.2s-1.3-.4-1.8-1.2Z" fill="#f5b301" />
      <path d="M5.4 20.2c.6-1.3 2.4-1.9 3.9-1.1.9.5 1 1.6.2 2.1-1.2.8-3.4.5-4.1-1Z" fill="#f5b301" />
      <path d="M18.6 20.2c-.6-1.3-2.4-1.9-3.9-1.1-.9.5-1 1.6-.2 2.1 1.2.8 3.4.5 4.1-1Z" fill="#f5b301" />
    </>
  ),
  monitoring: (
    <>
      <rect x="2.5" y="3.5" width="19" height="15" rx="3" fill="#fff4e8" stroke="#f9a65a" strokeWidth="1.3" />
      <path
        d="M5.2 12h2.9l1.8-4.2 2.9 7.6 2.2-5.4 1.4 2h2.4"
        fill="none"
        stroke="#f46800"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 21h7" stroke="#f9a65a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

/**
 * One technology glyph. Decorative by default (aria-hidden); pass `title` to
 * give it an accessible name. The default size is the width/height attributes
 * (1.5em), so a caller's `size-*` class overrides it without a fight.
 */
export function TechIcon({
  name,
  className,
  title,
}: {
  name: TechIconName;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}
