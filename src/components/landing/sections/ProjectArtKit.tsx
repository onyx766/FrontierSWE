import type { CSSProperties, ReactNode } from 'react';
import styles from './Projects.module.css';

/**
 * Shared pieces for the project illustrations: panel sizes, the lilac-on-
 * violet palette, the panel header and a couple of geometry helpers. The art
 * is decorative (the whole stage is aria-hidden), so its text is set small,
 * like an interface seen from across the room.
 */

export interface PanelArt {
  back: ReactNode;
  main: ReactNode;
  side: ReactNode;
}

export interface PanelSize {
  w: number;
  h: number;
}

/** viewBox sizes. Each matches its panel's box on the 500 x 360 stage
 * (`.posBack`, `.posMain`, `.posSide`), so the art is never distorted. */
export const BACK: PanelSize = { w: 156, h: 198 };
export const MAIN: PanelSize = { w: 282, h: 236 };
export const SIDE: PanelSize = { w: 158, h: 206 };

export const ink = {
  text: '#ece8ff',
  soft: '#cfc4fa',
  muted: '#9a92c9',
  line: 'rgba(255,255,255,0.1)',
  well: 'rgba(10,8,40,0.34)',
  violet: '#a78bfa',
  lilac: '#c4b5fd',
  deep: '#7c5cff',
  pink: '#f0abfc',
  sky: '#93c5fd',
  green: '#4ade80',
  mint: '#bbf7d0',
  amber: '#fcd34d',
  night: '#1b1840',
} as const;

/** Custom properties for `style`, which React's CSSProperties doesn't type. */
export function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

export function PanelSvg({ size, children }: { size: PanelSize; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${size.w} ${size.h}`}
      className={styles.panelSvg}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Window chrome: three dots, a title, optional content on the right, a rule. */
export function PanelHeader({
  width,
  title,
  children,
}: {
  width: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <circle cx="10" cy="12" r="2.1" fill={ink.pink} opacity="0.8" />
      <circle cx="17.5" cy="12" r="2.1" fill={ink.lilac} opacity="0.65" />
      <circle cx="25" cy="12" r="2.1" fill="#ffffff" opacity="0.35" />
      <text x="33" y="14.5" fontSize="7" fontWeight="600" fill={ink.text}>
        {title}
      </text>
      {children}
      <line x1="0" x2={width} y1="23.5" y2="23.5" stroke={ink.line} strokeWidth="1" />
    </g>
  );
}

type PillTone = 'violet' | 'green' | 'muted';

const PILL_TONES: Record<PillTone, { fill: string; stroke: string; text: string }> = {
  violet: { fill: 'rgba(139,92,246,0.32)', stroke: 'rgba(196,181,253,0.55)', text: ink.text },
  green: { fill: 'rgba(74,222,128,0.12)', stroke: 'rgba(74,222,128,0.45)', text: ink.mint },
  muted: { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.14)', text: ink.soft },
};

/** A rounded label; `x`/`y` are its top-left corner, text is centred. */
export function Pill({
  x,
  y,
  w,
  text,
  tone = 'violet',
  h = 11,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  tone?: PillTone;
  h?: number;
}) {
  const colors = PILL_TONES[tone];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="0.6"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 2}
        textAnchor="middle"
        fontSize="5.6"
        fill={colors.text}
        className={styles.mono}
      >
        {text}
      </text>
    </g>
  );
}

const fmt = (value: number) => String(Number(value.toFixed(2)));

/** A smooth curve through the points (Catmull-Rom, as cubic Béziers). */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  const first = points[0];
  if (!first) return '';
  const parts = [`M${fmt(first[0])} ${fmt(first[1])}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(
      `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`,
    );
  }
  return parts.join(' ');
}

/** The four-point spark used for the glints around the panels. */
export function SparkleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path
        d="M12 0c.7 6.4 5.6 11.3 12 12-6.4.7-11.3 5.6-12 12-.7-6.4-5.6-11.3-12-12C6.4 11.3 11.3 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
