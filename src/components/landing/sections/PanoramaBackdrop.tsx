import type { CSSProperties } from 'react';
import { fixed } from '@/lib/rng';
import { cn } from '@/lib/utils';
import styles from './Panorama.module.css';
import {
  cloudBank,
  mountainRange,
  sparkleField,
  type Puff,
  type RangeGeometry,
} from './PanoramaGeometry';

/**
 * The final call-to-action's painted backdrop: a pastel sunset, three hazy
 * mountain ranges, a few far-off floating islands and a sea of cloud. All of
 * it is decoration (aria-hidden) and server-rendered SVG; the only motion is
 * CSS, plus the parallax variables written by FinalCtaStage.
 */

/**
 * Parallax depth for one layer, read by the `.parallax` rule: px of drift
 * across the band's scroll range (`lag`, distant layers lag the most) and
 * across the pointer's range (`sway`, near layers swing the most).
 */
export function parallaxDepth(lag: number, sway: number): CSSProperties {
  return { '--lag': lag, '--sway': sway } as CSSProperties;
}

const WIDTH = 2400;
const RANGE_HEIGHT = 600;
const CLOUD_HEIGHT = 420;

/* ─────────────────────────────── Mountains ──────────────────────────────── */

interface RangePalette {
  peak: string;
  body: string;
  haze: string;
  lit: string;
  litOpacity: number;
  snowShade: string;
  snowLight: string;
  rim: string;
  rimOpacity: number;
}

// The far range is barely more than haze; each nearer one gains contrast.
const FAR = mountainRange({
  seed: 11,
  width: WIDTH,
  height: RANGE_HEIGHT,
  base: 46,
  rough: 22,
  snowLine: 0.26,
  peaks: [
    { x: 200, h: 170, w: 300, lean: 0.2 },
    { x: 560, h: 240, w: 340, snow: true, lean: -0.3 },
    { x: 900, h: 160, w: 280 },
    { x: 1240, h: 250, w: 360, snow: true, lean: 0.25 },
    { x: 1600, h: 190, w: 300, lean: -0.2 },
    { x: 1980, h: 270, w: 360, snow: true, lean: 0.3 },
    { x: 2300, h: 180, w: 300 },
  ],
});

const MID = mountainRange({
  seed: 23,
  width: WIDTH,
  height: RANGE_HEIGHT,
  base: 24,
  rough: 30,
  snowLine: 0.3,
  peaks: [
    { x: 330, h: 290, w: 360, snow: true, lean: 0.3 },
    { x: 760, h: 200, w: 280, lean: -0.2 },
    { x: 1560, h: 300, w: 360, snow: true, k: 1.6, lean: -0.25 },
    { x: 1900, h: 220, w: 280, lean: 0.3 },
    { x: 2240, h: 330, w: 360, snow: true, lean: -0.2 },
  ],
});

const NEAR = mountainRange({
  seed: 37,
  width: WIDTH,
  height: RANGE_HEIGHT,
  base: 14,
  rough: 36,
  snowLine: 0.32,
  peaks: [
    { x: 60, h: 300, w: 380, snow: true, lean: 0.3 },
    { x: 1120, h: 380, w: 420, snow: true, k: 1.7, lean: -0.15 },
    { x: 2380, h: 330, w: 380, snow: true, lean: -0.3 },
  ],
});

const FAR_PALETTE: RangePalette = {
  peak: '#cbbfee',
  body: '#d9c3e8',
  haze: '#f6d8e2',
  lit: '#ffe6de',
  litOpacity: 0.6,
  snowShade: '#ebe5fa',
  snowLight: '#fff7f3',
  rim: '#fff3ec',
  rimOpacity: 0.4,
};

const MID_PALETTE: RangePalette = {
  peak: '#9a90d8',
  body: '#b2a3da',
  haze: '#efcde0',
  lit: '#ffd8cf',
  litOpacity: 0.66,
  snowShade: '#ddd6f7',
  snowLight: '#fff5f0',
  rim: '#ffebe2',
  rimOpacity: 0.55,
};

const NEAR_PALETTE: RangePalette = {
  peak: '#6e67b8',
  body: '#8e80ca',
  haze: '#e6c3db',
  lit: '#f9c6c6',
  litOpacity: 0.58,
  snowShade: '#d4ccf2',
  snowLight: '#fff2ed',
  rim: '#ffdcd4',
  rimOpacity: 0.6,
};

function Range({ id, geometry, palette }: { id: string; geometry: RangeGeometry; palette: RangePalette }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${RANGE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      focusable="false"
      className={styles.art}
    >
      <defs>
        <linearGradient id={`${id}-body`} gradientUnits="userSpaceOnUse" x1="0" y1={geometry.top} x2="0" y2={RANGE_HEIGHT}>
          <stop offset="0" stopColor={palette.peak} />
          <stop offset="0.55" stopColor={palette.body} />
          <stop offset="1" stopColor={palette.haze} />
        </linearGradient>
        <linearGradient id={`${id}-lit`} gradientUnits="userSpaceOnUse" x1="0" y1={geometry.top} x2="0" y2={RANGE_HEIGHT}>
          <stop offset="0" stopColor={palette.lit} stopOpacity={palette.litOpacity} />
          <stop offset="0.7" stopColor={palette.lit} stopOpacity={fixed(palette.litOpacity * 0.45)} />
          <stop offset="1" stopColor={palette.lit} stopOpacity="0" />
        </linearGradient>
        {/* Shaded on the left of each cap, sunlit on the right. */}
        <linearGradient id={`${id}-snow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={palette.snowShade} />
          <stop offset="0.42" stopColor={palette.snowShade} />
          <stop offset="0.58" stopColor={palette.snowLight} />
          <stop offset="1" stopColor={palette.snowLight} />
        </linearGradient>
        {/* Reuses the drawn silhouette rather than repeating its long path. */}
        <clipPath id={`${id}-clip`}>
          <use href={`#${id}-shape`} />
        </clipPath>
      </defs>
      <path id={`${id}-shape`} d={geometry.silhouette} fill={`url(#${id}-body)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {geometry.lit.map((d, index) => (
          <path key={`lit-${index}`} d={d} fill={`url(#${id}-lit)`} />
        ))}
        {geometry.snow.map((d, index) => (
          <path key={`snow-${index}`} d={d} fill={`url(#${id}-snow)`} />
        ))}
      </g>
      <g
        fill="none"
        stroke={palette.rim}
        strokeOpacity={palette.rimOpacity}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {geometry.rims.map((d, index) => (
          <path key={`rim-${index}`} d={d} />
        ))}
      </g>
    </svg>
  );
}

/* ──────────────────────────────── Clouds ────────────────────────────────── */

const SEA = cloudBank({
  seed: 5,
  width: WIDTH,
  rows: [
    { y: 150, r: [40, 80], gap: [60, 110], jitter: 30 },
    { y: 210, r: [60, 110], gap: [70, 130], jitter: 30 },
    { y: 290, r: [80, 140], gap: [90, 150], jitter: 24 },
  ],
  profile: [
    [0, 30],
    [800, 10],
    [1400, -10],
    [2400, 10],
  ],
});

// Low under the copy on the left, piled up on the right where it has to swallow
// the island's base.
const BANK = cloudBank({
  seed: 9,
  width: WIDTH,
  rows: [
    { y: 240, r: [40, 110], gap: [80, 150], jitter: 36 },
    { y: 320, r: [70, 150], gap: [100, 170], jitter: 30 },
    { y: 400, r: [100, 170], gap: [120, 180], jitter: 20 },
  ],
  profile: [
    [0, 120],
    [700, 110],
    [1100, 50],
    [1300, 0],
    [1700, -50],
    [2100, -40],
    [2400, 0],
  ],
});

interface CloudLook {
  /** [shade, light] per row, back to front. */
  tones: readonly (readonly [string, string])[];
  /** Fill below the puffs, top to bottom. */
  base: readonly [string, string];
  baseFrom: number;
  blur: number;
}

const SEA_LOOK: CloudLook = {
  tones: [
    ['#efd9ec', '#fbf0f5'],
    ['#f1dced', '#fdf3f7'],
    ['#f3dfee', '#fff6f9'],
  ],
  base: ['#f3d9e9', '#eddcf3'],
  baseFrom: 200,
  blur: 4.5,
};

const BANK_LOOK: CloudLook = {
  tones: [
    ['#f2dcec', '#fff8fb'],
    ['#f4dfee', '#fffbfd'],
    ['#f6e2ef', '#ffffff'],
  ],
  base: ['#f8e1ee', '#f1e2f6'],
  baseFrom: 300,
  blur: 1.6,
};

/**
 * Illustrated cumulus: every puff is drawn twice, a shaded body and a sunlit
 * top nudged up toward the light. The top is a soft radial fill rather than a
 * hard disc, so the shading reads as volume instead of outlined scales, and
 * each puff's nudge differs a little. A light blur keeps it from looking cut out.
 */
function Clouds({ id, rows, look }: { id: string; rows: Puff[][]; look: CloudLook }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${CLOUD_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      focusable="false"
      className={styles.art}
    >
      <defs>
        <filter id={`${id}-soft`} x="-2%" y="-20%" width="104%" height="140%">
          <feGaussianBlur stdDeviation={look.blur} />
        </filter>
        <linearGradient
          id={`${id}-base`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={look.baseFrom}
          x2="0"
          y2={CLOUD_HEIGHT}
        >
          <stop offset="0" stopColor={look.base[0]} stopOpacity="0" />
          <stop offset="0.25" stopColor={look.base[0]} />
          <stop offset="1" stopColor={look.base[1]} />
        </linearGradient>
        {look.tones.map(([, light], row) => (
          <radialGradient key={row} id={`${id}-top-${row}`} cx="0.5" cy="0.5" r="0.5" fx="0.58" fy="0.36">
            <stop offset="0" stopColor={light} />
            <stop offset="0.62" stopColor={light} />
            <stop offset="0.86" stopColor={light} stopOpacity="0.55" />
            <stop offset="1" stopColor={light} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <g filter={`url(#${id}-soft)`}>
        {/* Runs on below the frame so a lifted layer never shows its edge. */}
        <rect x="0" y={look.baseFrom} width={WIDTH} height={CLOUD_HEIGHT * 2} fill={`url(#${id}-base)`} />
        {rows.map((puffs, row) => {
          const tone = Math.min(row, look.tones.length - 1);
          const shade = look.tones[tone]?.[0] ?? '#f4dfee';
          return (
            <g key={row}>
              <g fill={shade}>
                {puffs.map((puff, index) => (
                  <circle key={index} cx={puff.cx} cy={puff.cy} r={puff.r} />
                ))}
              </g>
              <g fill={`url(#${id}-top-${tone})`}>
                {puffs.map((puff, index) => (
                  <circle
                    key={index}
                    cx={fixed(puff.cx + puff.r * (0.04 + puff.lift * 0.08), 1)}
                    cy={fixed(puff.cy - puff.r * (0.06 + puff.lift * 0.1), 1)}
                    r={fixed(puff.r * (0.98 - puff.lift * 0.06), 1)}
                  />
                ))}
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ───────────────────────────────── Sky ──────────────────────────────────── */

// Broken bands of high cloud: short overlapping streaks rather than single long
// ones, warm near the sun and cooler toward the dusk side.
const WISPS: { cx: number; cy: number; rx: number; ry: number; tone: 'peach' | 'rose' | 'lilac'; opacity: number }[] = [
  { cx: 1690, cy: 118, rx: 150, ry: 20, tone: 'peach', opacity: 0.55 },
  { cx: 1850, cy: 100, rx: 190, ry: 26, tone: 'peach', opacity: 0.62 },
  { cx: 2040, cy: 124, rx: 160, ry: 20, tone: 'peach', opacity: 0.5 },
  { cx: 2210, cy: 98, rx: 120, ry: 15, tone: 'rose', opacity: 0.42 },
  { cx: 1960, cy: 160, rx: 110, ry: 12, tone: 'rose', opacity: 0.36 },
  { cx: 1480, cy: 214, rx: 120, ry: 13, tone: 'rose', opacity: 0.42 },
  { cx: 1620, cy: 232, rx: 100, ry: 11, tone: 'rose', opacity: 0.36 },
  { cx: 2160, cy: 246, rx: 140, ry: 13, tone: 'peach', opacity: 0.4 },
  { cx: 560, cy: 92, rx: 170, ry: 15, tone: 'lilac', opacity: 0.32 },
  { cx: 760, cy: 112, rx: 130, ry: 12, tone: 'lilac', opacity: 0.28 },
  { cx: 1080, cy: 72, rx: 150, ry: 13, tone: 'lilac', opacity: 0.28 },
];

const WISP_TONES = { peach: '#ffe3d2', rose: '#ffd3df', lilac: '#eadcfc' } as const;

function Wisps() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${RANGE_HEIGHT}`} preserveAspectRatio="xMidYMin slice" focusable="false" className={styles.art}>
      <defs>
        {Object.entries(WISP_TONES).map(([tone, color]) => (
          <radialGradient key={tone} id={`fc-wisp-${tone}`}>
            <stop offset="0" stopColor={color} />
            <stop offset="0.55" stopColor={color} stopOpacity="0.55" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {WISPS.map((wisp) => (
        <ellipse
          key={`${wisp.cx}-${wisp.cy}`}
          cx={wisp.cx}
          cy={wisp.cy}
          rx={wisp.rx}
          ry={wisp.ry}
          fill={`url(#fc-wisp-${wisp.tone})`}
          opacity={wisp.opacity}
        />
      ))}
    </svg>
  );
}

/* ──────────────────────────── Far-off islands ───────────────────────────── */

type IsleKind = 'tower' | 'grove' | 'dome';

interface Isle {
  kind: IsleKind;
  /** Desktop position (% of the band) and width. */
  wide: { x: number; y: number; w: string };
  /** Narrow screens; omitted islands are hidden there. */
  narrow?: { x: number; y: number; w: string };
  /** Bob period and phase, seconds. */
  period: number;
  phase: number;
  opacity: number;
}

const ISLES: Isle[] = [
  { kind: 'tower', wide: { x: 56, y: 15, w: '4rem' }, narrow: { x: 11, y: 71, w: '2.8rem' }, period: 9, phase: -2, opacity: 0.92 },
  { kind: 'grove', wide: { x: 93, y: 11, w: '2.4rem' }, period: 11, phase: -6, opacity: 0.8 },
  { kind: 'dome', wide: { x: 51, y: 64, w: '2.3rem' }, narrow: { x: 90, y: 66, w: '2.1rem' }, period: 10, phase: -4, opacity: 0.85 },
  { kind: 'grove', wide: { x: 34, y: 9, w: '2rem' }, period: 12, phase: -1, opacity: 0.7 },
];

/** A tiny island in the distance: grass cap, rock underside, one landmark. */
function SkyIsle({ kind }: { kind: IsleKind }) {
  return (
    <svg viewBox="0 0 120 110" focusable="false" className={styles.isleArt}>
      {/* rock underside, shaded left and sunlit right */}
      <path d="M8 46 C 14 58 24 66 34 72 L 41 82 L 50 90 L 57 108 L 63 93 L 73 84 L 85 72 C 97 64 106 56 112 46 Z" fill="#a49bd3" />
      <path d="M61 48 L 112 46 C 106 56 97 64 85 72 L 73 84 L 63 93 L 59 70 Z" fill="#e9c6d6" opacity="0.8" />
      <path d="M30 56 L 44 74 L 41 82 Z M 52 62 L 58 84 L 54 88 Z" fill="#8f86c4" opacity="0.7" />
      {/* cliff edge and grass */}
      <ellipse cx="60" cy="47.5" rx="52" ry="10" fill="#8f87c6" />
      <ellipse cx="60" cy="45" rx="53" ry="10" fill="#a6ccb6" />
      <ellipse cx="64" cy="43.5" rx="44" ry="7" fill="#c4e3d0" />
      {kind === 'tower' ? (
        <g>
          <rect x="68" y="30" width="12" height="15" rx="1.5" fill="#e3dcf8" />
          <rect x="53" y="12" width="11" height="33" rx="1.5" fill="#f3effe" />
          <path d="M53 12 L 58.5 1 L 64 12 Z" fill="#8f7cf0" />
          <rect x="56" y="17" width="5" height="2.4" rx="1" fill="#8b6cff" />
          <rect x="56" y="23" width="5" height="2.4" rx="1" fill="#8b6cff" opacity="0.8" />
          <rect x="56" y="29" width="5" height="2.4" rx="1" fill="#8b6cff" opacity="0.65" />
          <rect x="71" y="34" width="6" height="2.2" rx="1" fill="#a58cff" opacity="0.8" />
          <circle cx="40" cy="41" r="5.5" fill="#8fbea2" />
          <circle cx="86" cy="42" r="4.5" fill="#9cc8ad" />
        </g>
      ) : kind === 'dome' ? (
        <g>
          <path d="M46 44 A 14 13 0 0 1 74 44 Z" fill="#f1ecfe" />
          <path d="M62 33 A 12 11 0 0 1 72 42" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" />
          <ellipse cx="60" cy="43" rx="24" ry="5" fill="none" stroke="#b7a6ff" strokeWidth="1.6" opacity="0.85" />
          <circle cx="60" cy="30" r="2" fill="#a58cff" />
        </g>
      ) : (
        <g>
          <circle cx="38" cy="39" r="7" fill="#8fbea2" />
          <circle cx="50" cy="35" r="9" fill="#9ccbae" />
          <circle cx="64" cy="37" r="7.5" fill="#8fbea2" />
          <circle cx="78" cy="38" r="8" fill="#a7d2b8" />
          <circle cx="52" cy="32" r="4" fill="#c4e3d0" />
          <circle cx="80" cy="35" r="3.4" fill="#c4e3d0" />
        </g>
      )}
      {/* a thread of waterfall off the sunlit side */}
      <path d="M90 52 L 90.6 78" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/* ─────────────────────────────── Sparkles ───────────────────────────────── */

// Two fields from different seeds: one placement for the wide layout (the sky
// beside and above the island), one for the stacked layout (around the island).
const SPARKLES_WIDE = sparkleField(77, 12, { x: [44, 98], y: [6, 62] });
const SPARKLES_NARROW = sparkleField(78, 12, { x: [6, 94], y: [62, 92] });

const SPARK_PATH = 'M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z';

/* ────────────────────────────────── Layers ──────────────────────────────── */

/** Everything behind the island: sky light, ranges, islands, the cloud sea. */
export function PanoramaBackdrop() {
  return (
    <div aria-hidden className={styles.backdrop}>
      <div className={cn(styles.layer, styles.parallax, styles.sunLayer)} style={parallaxDepth(56, 4)}>
        <div className={styles.rays} data-pano="rays" />
        <div className={cn(styles.rays, styles.raysCounter)} data-pano="rays" />
        <div className={styles.sunHalo} data-pano="halo">
          <div className={styles.sunGlow} />
        </div>
        <div className={styles.sun} />
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.wisps)} style={parallaxDepth(50, 6)}>
        <div className={styles.drift}>
          <Wisps />
        </div>
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.range, styles.far)} style={parallaxDepth(44, 6)}>
        <Range id="fc-far" geometry={FAR} palette={FAR_PALETTE} />
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.isles)} style={parallaxDepth(34, 9)}>
        {ISLES.map((isle, index) => (
          <div
            key={index}
            className={cn(styles.isle, !isle.narrow && styles.isleWideOnly)}
            style={
              {
                '--lx': `${isle.wide.x}%`,
                '--ly': `${isle.wide.y}%`,
                '--lw': isle.wide.w,
                '--x': `${isle.narrow?.x ?? isle.wide.x}%`,
                '--y': `${isle.narrow?.y ?? isle.wide.y}%`,
                '--w': isle.narrow?.w ?? isle.wide.w,
                '--period': `${isle.period}s`,
                '--phase': `${isle.phase}s`,
                opacity: isle.opacity,
              } as CSSProperties
            }
          >
            <div className={styles.isleBob}>
              <SkyIsle kind={isle.kind} />
            </div>
          </div>
        ))}
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.range, styles.mid)} style={parallaxDepth(30, 10)}>
        <Range id="fc-mid" geometry={MID} palette={MID_PALETTE} />
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.range, styles.near)} style={parallaxDepth(20, 14)}>
        <Range id="fc-near" geometry={NEAR} palette={NEAR_PALETTE} />
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.sea)} style={parallaxDepth(12, 16)}>
        <div className={cn(styles.drift, styles.driftSlow)}>
          <Clouds id="fc-sea" rows={SEA} look={SEA_LOOK} />
        </div>
      </div>
    </div>
  );
}

/** Everything in front of the island: the near cloud bank and the sparkles. */
export function PanoramaFront() {
  return (
    <div aria-hidden className={styles.front}>
      <div className={cn(styles.layer, styles.parallax, styles.bank)} style={parallaxDepth(-10, 24)}>
        <div className={cn(styles.drift, styles.driftNear)}>
          <Clouds id="fc-bank" rows={BANK} look={BANK_LOOK} />
        </div>
      </div>

      <div className={cn(styles.layer, styles.parallax, styles.sparkles)} style={parallaxDepth(-4, 20)}>
        {SPARKLES_WIDE.map((wide, index) => {
          const narrow = SPARKLES_NARROW[index] ?? wide;
          return (
            <span
              key={index}
              className={styles.sparkle}
              style={
                {
                  '--lx': `${wide.x}%`,
                  '--ly': `${wide.y}%`,
                  '--x': `${narrow.x}%`,
                  '--y': `${narrow.y}%`,
                  '--s': `${wide.size}px`,
                  '--dur': `${wide.duration}s`,
                  '--delay': `${wide.delay}s`,
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 24 24" focusable="false">
                <path d={SPARK_PATH} fill="currentColor" />
              </svg>
            </span>
          );
        })}
      </div>
    </div>
  );
}
