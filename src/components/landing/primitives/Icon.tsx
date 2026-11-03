import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The landing page's interface icons: 24px, 1.75 stroke, round joins. Brand
 * marks for GitHub and LinkedIn are filled glyphs. Technology logos live in
 * TechIcon, not here.
 */

interface IconDef {
  body: ReactNode;
  viewBox?: string;
  /** Filled glyph instead of a stroked outline. */
  fill?: boolean;
}

const ICONS = {
  'arrow-right': { body: <path d="M5 12h14M12 5l7 7-7 7" /> },
  'arrow-left': { body: <path d="M19 12H5M12 19l-7-7 7-7" /> },
  'arrow-up-right': { body: <path d="M7 17 17 7M7 7h10v10" /> },
  'arrow-up': { body: <path d="M12 19V5M5 12l7-7 7 7" /> },
  'chevron-down': { body: <path d="m6 9 6 6 6-6" /> },
  'chevron-left': { body: <path d="m15 18-6-6 6-6" /> },
  'chevron-right': { body: <path d="m9 18 6-6-6-6" /> },
  plus: { body: <path d="M12 5v14M5 12h14" /> },
  minus: { body: <path d="M5 12h14" /> },
  check: { body: <path d="M20 6 9 17l-5-5" /> },
  x: { body: <path d="M18 6 6 18M6 6l12 12" /> },
  menu: { body: <path d="M4 7h16M4 12h16M4 17h16" /> },
  github: {
    viewBox: '0 0 16 16',
    fill: true,
    body: (
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    ),
  },
  linkedin: {
    fill: true,
    body: (
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    ),
  },
  mail: {
    body: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <path d="m3 7 8.06 5.37a1.7 1.7 0 0 0 1.88 0L21 7" />
      </>
    ),
  },
  calendar: {
    body: (
      <>
        <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
        <path d="M16 2.5v4M8 2.5v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
      </>
    ),
  },
  layers: {
    body: (
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83ZM22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    ),
  },
  sparkles: {
    body: (
      <path d="M11 3.5c.45 4.1 2.4 6.05 6.5 6.5-4.1.45-6.05 2.4-6.5 6.5-.45-4.1-2.4-6.05-6.5-6.5 4.1-.45 6.05-2.4 6.5-6.5ZM18.5 14.5c.2 1.75 1.05 2.6 2.8 2.8-1.75.2-2.6 1.05-2.8 2.8-.2-1.75-1.05-2.6-2.8-2.8 1.75-.2 2.6-1.05 2.8-2.8Z" />
    ),
  },
  /** The small filled spark used as an eyebrow marker. */
  spark: {
    fill: true,
    body: <path d="M12 2c.6 5.6 4.4 9.4 10 10-5.6.6-9.4 4.4-10 10-.6-5.6-4.4-9.4-10-10 5.6-.6 9.4-4.4 10-10Z" />,
  },
  wand: {
    body: (
      <path d="m3 21 10.5-10.5M15 4V2M15 12v-2M19 8h2M9 8h2M17.8 5.2 19.2 3.8M12.2 5.2 10.8 3.8M17.8 10.8l1.4 1.4M13.5 10.5l1.5-1.5" />
    ),
  },
  cpu: {
    body: (
      <>
        <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 2v2.5M15 2v2.5M9 19.5V22M15 19.5V22M2 9h2.5M2 15h2.5M19.5 9H22M19.5 15H22" />
      </>
    ),
  },
  monitor: {
    body: (
      <>
        <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
        <path d="M8 21h8M12 16.5V21" />
      </>
    ),
  },
  database: {
    body: (
      <>
        <ellipse cx="12" cy="5.5" rx="8.5" ry="3" />
        <path d="M3.5 5.5v13c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3v-13M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3" />
      </>
    ),
  },
  box: {
    body: (
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7 12 12l8.7-5M12 22V12" />
    ),
  },
  server: {
    body: (
      <>
        <rect x="2.5" y="3" width="19" height="7.5" rx="2" />
        <rect x="2.5" y="13.5" width="19" height="7.5" rx="2" />
        <path d="M6.5 6.75h.01M6.5 17.25h.01M10.5 6.75h3M10.5 17.25h3" />
      </>
    ),
  },
  user: {
    body: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
  bolt: { body: <path d="M13 2 4 14h8l-1 8 9-12h-8l1-8Z" /> },
  robot: {
    body: (
      <>
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4.5M2 14h2M20 14h2M9 13v2M15 13v2" />
        <circle cx="12" cy="3.5" r="1" />
      </>
    ),
  },
  compass: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="m15.9 8.1-1.75 5.25a1.3 1.3 0 0 1-.8.8L8.1 15.9l1.75-5.25a1.3 1.3 0 0 1 .8-.8Z" />
      </>
    ),
  },
  code: { body: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /> },
  rocket: {
    body: (
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09ZM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2ZM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    ),
  },
  gauge: { body: <path d="m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0" /> },
  plug: { body: <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /> },
  'pen-tool': {
    body: (
      <>
        <path d="m12 19 7-7 3 3-7 7-3-3ZM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5ZM2 2l7.59 7.59" />
        <circle cx="11" cy="11" r="2" />
      </>
    ),
  },
  bug: {
    body: (
      <path d="M8 6.5a4 4 0 0 1 8 0M12 20a5 5 0 0 1-5-5v-3a5 5 0 0 1 10 0v3a5 5 0 0 1-5 5ZM12 20v-8M7 13H3M21 13h-4M7.5 9 4.5 7M16.5 9l3-2M7.5 17l-3 2M16.5 17l3 2" />
    ),
  },
  shield: {
    body: (
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
    ),
  },
  clock: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 6.5V12l3.5 2" />
      </>
    ),
  },
  'map-pin': {
    body: (
      <>
        <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  target: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="5.5" />
        <circle cx="12" cy="12" r="1.5" />
      </>
    ),
  },
  flag: { body: <path d="M4.5 22V4s1.5-1.5 4.5-1.5S13.5 5 16.5 5s3-1 3-1v10s-1 1-3 1-4.5-2.5-7.5-2.5-4.5 1.5-4.5 1.5" /> },
  message: { body: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /> },
  play: { body: <path d="M7 4.5v15l12.5-7.5Z" /> },
  pause: { body: <path d="M8 5v14M16 5v14" /> },
  rotate: { body: <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" /> },
  globe: {
    body: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5a14.5 14.5 0 0 0 0 19 14.5 14.5 0 0 0 0-19M2.5 12h19" />
      </>
    ),
  },
  terminal: { body: <path d="m4 17 6-6-6-6M12 19h8" /> },
  'git-branch': {
    body: (
      <>
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M6 3v12.5M18 8.5a9 9 0 0 1-9 9" />
      </>
    ),
  },
  copy: {
    body: (
      <>
        <rect x="8.5" y="8.5" width="13" height="13" rx="2.5" />
        <path d="M15.5 8.5V5a2.5 2.5 0 0 0-2.5-2.5H5A2.5 2.5 0 0 0 2.5 5v8A2.5 2.5 0 0 0 5 15.5h3.5" />
      </>
    ),
  },
  search: {
    body: (
      <>
        <circle cx="11" cy="11" r="7.5" />
        <path d="m21 21-4.35-4.35" />
      </>
    ),
  },
  'trending-up': { body: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" /> },
  workflow: {
    body: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <path d="M6.5 10v2.5a4 4 0 0 0 4 4H14" />
      </>
    ),
  },
  infinity: {
    body: (
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    ),
  },
  mouse: {
    body: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="6" />
        <path d="M12 6.5v3.5" />
      </>
    ),
  },
  star: {
    body: (
      <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 5.11 5.52.44a.56.56 0 0 1 .32.98l-4.2 3.6 1.28 5.38a.56.56 0 0 1-.84.61L12 16.73l-4.73 2.89a.56.56 0 0 1-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 0 1 .32-.98l5.52-.44Z" />
    ),
  },
  quote: {
    body: (
      <path d="M8 6.5A4.5 4.5 0 0 0 3.5 11v6.5H10V11H6.5A2.5 2.5 0 0 1 9 8.5ZM18.5 6.5A4.5 4.5 0 0 0 14 11v6.5h6.5V11H17a2.5 2.5 0 0 1 2.5-2.5Z" />
    ),
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  /** Give an accessible name. Without one the icon is decorative (aria-hidden). */
  title?: string;
}

export function Icon({ name, className, strokeWidth = 1.75, title }: IconProps) {
  const def: IconDef = ICONS[name];
  // Default size is the width/height attributes (1em), which any CSS size
  // class overrides. A default `size-*` class would instead fight the caller's
  // by stylesheet order.
  return (
    <svg
      viewBox={def.viewBox ?? '0 0 24 24'}
      width="1em"
      height="1em"
      fill={def.fill ? 'currentColor' : 'none'}
      stroke={def.fill ? 'none' : 'currentColor'}
      strokeWidth={def.fill ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      {def.body}
    </svg>
  );
}
