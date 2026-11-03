import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './SummitArt.module.css';

/**
 * The summit beside the experience timeline: layered ranges under a pastel
 * sunrise, and a switchback trail from the valley to a flag, with one
 * milestone per role (the oldest lowest).
 *
 * SVG and CSS only, rendered on the server. The trail draws in when something
 * sets `data-drawn` on the root (ExperienceSection does, on scroll); without
 * JavaScript it is simply drawn. A milestone highlights while `--hi: 1` is set
 * on it, which Experience.module.css does from the hovered timeline entry, and
 * hovering a milestone highlights that entry in return.
 */

type Point = readonly [x: number, y: number];
type CssVars = CSSProperties & Record<`--${string}`, string | number>;

const VIEW_W = 800;
const VIEW_H = 560;
const VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;

/** Trail draw time. Milestone and flag timings are derived from it. */
const DRAW_MS = 2600;
const DRAW_LAG_MS = 150;

/** The trail, valley to summit, in viewBox units. Milestones sit on these points. */
const TRAIL: readonly Point[] = [
  [96, 556],
  [200, 526],
  [318, 498],
  [402, 466],
  [352, 430],
  [438, 398],
  [512, 360],
  [468, 318],
  [530, 280],
  [568, 236],
  [546, 196],
  [580, 160],
  [600, 124],
];

/** The lowest and highest waypoints that can carry a milestone. */
const FIRST_STOP = 3;
const LAST_STOP = 9;
const MAX_STOPS = LAST_STOP - FIRST_STOP + 1;

function point(points: readonly Point[], index: number): Point {
  return points[Math.min(points.length - 1, Math.max(0, index))] ?? [0, 0];
}

const round = (value: number) => Math.round(value * 10) / 10;

/** A smooth curve through every point: Catmull-Rom, written as cubic Béziers. */
function smoothPath(points: readonly Point[]): string {
  const [x0, y0] = point(points, 0);
  let d = `M${x0} ${y0}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = point(points, i - 1);
    const [bx, by] = point(points, i);
    const [cx, cy] = point(points, i + 1);
    const [dx, dy] = point(points, i + 2);
    d += ` C${round(bx + (cx - ax) / 6)} ${round(by + (cy - ay) / 6)} ${round(cx - (dx - bx) / 6)} ${round(cy - (dy - by) / 6)} ${cx} ${cy}`;
  }
  return d;
}

/** How far along the trail each waypoint is, 0 → 1. Chord length is close enough to time the pops. */
function trailProgress(points: readonly Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = point(points, i - 1);
    const [bx, by] = point(points, i);
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[lengths.length - 1] || 1;
  return lengths.map((length) => length / total);
}

/** Waypoint for each of `count` milestones, lowest first, spread evenly up the trail. */
function stopWaypoints(count: number): number[] {
  if (count <= 1) return [LAST_STOP];
  return Array.from({ length: count }, (_, k) =>
    Math.round(FIRST_STOP + (k * (LAST_STOP - FIRST_STOP)) / (count - 1)),
  );
}

const TRAIL_D = smoothPath(TRAIL);
const PROGRESS = trailProgress(TRAIL);

const pct = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`;

/** Document-unique gradient and mask ids, from one useId() per illustration. */
interface Refs {
  id: (name: string) => string;
  paint: (name: string) => string;
}

/* ── Shapes, in viewBox units ─────────────────────────────────────────────── */

const FAR_RANGE =
  'M0 292 30 282 58 262 82 272 120 236 148 254 176 246 214 272 256 250 296 218 322 232 350 224 392 256 430 240 470 204 498 216 520 210 560 240 600 228 640 196 668 208 700 202 742 228 774 212 800 220V560H0Z';
const FAR_SNOW = 'M120 236 134 246 126 248 114 244ZM296 218 310 226 300 230 288 226ZM470 204 484 212 474 216 462 212Z';
const PEAK_LEFT = 'M214 340 250 304 276 282 298 252 318 232 334 206 346 196 360 214 380 232 404 262 432 286 470 320Z';
const PEAK_LEFT_SNOW = 'M346 196 334 206 322 226 332 222 338 236 348 226 356 240 364 228 374 236 380 232 360 214Z';
const PEAK_LEFT_SHADE = 'M346 196 360 214 380 232 404 262 432 286 470 320H380L372 280 358 240Z';
const PEAK_RIGHT = 'M690 300 716 256 736 226 756 196 772 182 788 200 800 210V300Z';
const PEAK_RIGHT_SNOW = 'M772 182 756 196 748 210 758 206 764 218 774 208 782 218 790 206 800 214V210L788 200Z';
const MID_RANGE =
  'M0 352 36 336 70 344 112 314 140 326 172 318 214 298 246 312 280 302 318 284 344 296 380 290 420 314 460 304 520 330V560H0Z';

const MASSIF =
  'M0 505 40 492 90 470 140 452 190 430 232 410 268 392 300 372 330 352 352 338 372 318 392 304 410 296 428 280 446 262 462 248 480 240 496 226 512 206 526 196 540 180 552 166 566 156 580 140 592 126 600 118 608 124 618 134 630 140 642 154 652 170 664 178 676 194 690 206 704 226 718 236 734 252 752 262 772 276 800 288V560H0Z';
/** The lit face between the left spur and the front ridge; the trail climbs it. */
const FACE =
  'M600 118 597 150 607 182 602 214 616 252 612 292 630 344 626 400 646 470 660 560H250L300 520 352 470 398 420 432 372 462 330 488 290 506 252 524 222 548 190 572 156Z';
const SHADE =
  'M600 118 608 124 618 134 630 140 642 154 652 170 664 178 676 194 690 206 704 226 718 236 734 252 752 262 772 276 800 288V560H660L646 470 626 400 630 344 612 292 616 252 602 214 607 182 597 150Z';
/** Outer shade facet, warmed by the sunrise behind it. */
const RIM = 'M690 206 704 226 718 236 734 252 752 262 772 276 800 288V400L760 372 730 330 712 290 700 246Z';
const SNOW_LIT =
  'M600 118 592 126 580 140 566 156 552 166 540 180 526 196 512 206 517 219 527 213 533 231 545 221 553 243 565 233 574 257 587 245 597 268 606 255 616 252 602 214 607 182 597 150Z';
const SNOW_SHADE =
  'M600 118 608 124 618 134 630 140 642 154 652 170 664 178 676 194 690 206 688 222 676 214 670 236 658 224 650 250 638 238 628 262 616 252 602 214 607 182 597 150Z';
/** Snow lying in the gullies below the cap. */
const GULLIES: { d: string; fill: string; opacity: number }[] = [
  { d: 'M533 231 539 252 533 272 537 292 528 282 530 258Z', fill: '#ffffff', opacity: 0.75 },
  { d: 'M574 257 579 284 573 306 580 330 568 318 569 290Z', fill: '#ffffff', opacity: 0.65 },
  { d: 'M496 226 495 246 487 264 489 278 480 270 486 250Z', fill: '#ffffff', opacity: 0.5 },
  { d: 'M650 250 655 276 649 300 654 322 642 310 644 282Z', fill: '#e6e2f7', opacity: 0.6 },
  { d: 'M700 246 709 280 704 300 695 284Z', fill: '#e6e2f7', opacity: 0.5 },
];
const ROCK_LINES = 'M616 252 612 292 630 344 626 400 646 470M524 222 506 252 488 290 462 330 432 372M700 246 712 290 730 330';
const FOOTHILL = 'M430 560 474 534 520 520 566 500 610 484 652 474 700 450 742 456 800 434V560Z';
/** Must match the first frame of the `wave` keyframes in the CSS module. */
const CLOTH = 'M602 61 C615 55 628 68 646 61 L646 90 C628 97 615 84 602 90 Z';

/** Gull silhouettes for the sky, in the birds' own 120 × 64 box. */
const BIRDS: { d: string; lag: number }[] = [
  { d: 'M8 30q7-7 14 0 7-7 14 0', lag: 0 },
  { d: 'M50 14q5.5-5.5 11 0 5.5-5.5 11 0', lag: -0.45 },
  { d: 'M86 40q4.5-4.5 9 0 4.5-4.5 9 0', lag: -0.9 },
];

const SPARKS: { d: string; fill: string; lag: number }[] = [
  { d: 'M676 92c.6 5.6 4.4 9.4 10 10-5.6.6-9.4 4.4-10 10-.6-5.6-4.4-9.4-10-10 5.6-.6 9.4-4.4 10-10Z', fill: '#ffffff', lag: 0 },
  { d: 'M548 100c.4 3.6 2.8 6 6.4 6.4-3.6.4-6 2.8-6.4 6.4-.4-3.6-2.8-6-6.4-6.4 3.6-.4 6-2.8 6.4-6.4Z', fill: '#b7a6ff', lag: -1.4 },
  { d: 'M716 150c.3 2.6 2 4.3 4.6 4.6-2.6.3-4.3 2-4.6 4.6-.3-2.6-2-4.3-4.6-4.6 2.6-.3 4.3-2 4.6-4.6Z', fill: '#ffffff', lag: -2.6 },
];

interface Cloud {
  /** Top-left corner and size, in viewBox units. */
  x: number;
  y: number;
  w: number;
  h: number;
  variant: 'a' | 'b';
  opacity: number;
  /** Drift, as a percentage of the cloud's own width. */
  drift: number;
  seconds: number;
  /** Negative start offset, so the clouds never move in step. */
  lag: number;
}

const BACK_CLOUDS: Cloud[] = [
  { x: -64, y: 347, w: 352, h: 78, variant: 'a', opacity: 0.88, drift: 5, seconds: 34, lag: -6 },
  { x: 656, y: 263, w: 240, h: 62, variant: 'b', opacity: 0.85, drift: -6, seconds: 28, lag: -12 },
];

const FRONT_CLOUDS: Cloud[] = [
  { x: -80, y: 465, w: 384, h: 112, variant: 'a', opacity: 0.96, drift: 6, seconds: 30, lag: -4 },
  { x: 256, y: 493, w: 448, h: 90, variant: 'b', opacity: 0.92, drift: -4, seconds: 38, lag: -15 },
  { x: 608, y: 442, w: 288, h: 106, variant: 'a', opacity: 0.94, drift: 5, seconds: 26, lag: -9 },
];

/* ── Layers ───────────────────────────────────────────────────────────────── */

/** Sunrise glow, turning rays and gulls. They spill above the scene into the extra sky. */
function Sky() {
  return (
    <div className={styles.sky}>
      <span className={styles.glow} />
      <span className={styles.rays} />
      <svg className={styles.birds} viewBox="0 0 120 64" focusable="false">
        {BIRDS.map((bird) => (
          <path
            key={bird.d}
            className={styles.bird}
            d={bird.d}
            fill="none"
            stroke="#7d78a3"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ '--lag': `${bird.lag}s` } as CssVars}
          />
        ))}
      </svg>
    </div>
  );
}

function Clouds({ clouds, className }: { clouds: Cloud[]; className?: string }) {
  return (
    <div className={cn(styles.layer, className)}>
      {clouds.map((cloud) => {
        const style: CssVars = {
          left: pct(cloud.x, VIEW_W),
          top: pct(cloud.y, VIEW_H),
          width: pct(cloud.w, VIEW_W),
          height: pct(cloud.h, VIEW_H),
          '--o': cloud.opacity,
          '--dx': `${cloud.drift}%`,
          '--dur': `${cloud.seconds}s`,
          '--lag': `${cloud.lag}s`,
        };
        return (
          <span
            key={`${cloud.x}-${cloud.y}`}
            className={cn(styles.cloud, cloud.variant === 'a' ? styles.cloudA : styles.cloudB)}
            style={style}
          />
        );
      })}
    </div>
  );
}

/** The sun and the ranges behind the main peak. */
function BackRanges({ id, paint }: Refs) {
  return (
    <svg className={cn(styles.layer, styles.back)} viewBox={VIEW_BOX} focusable="false">
      <defs>
        <linearGradient id={id('far')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4dff7" />
          <stop offset="0.5" stopColor="#efecfa" />
          <stop offset="1" stopColor="#f6f4fc" />
        </linearGradient>
        <linearGradient id={id('peak')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3cfee" />
          <stop offset="0.6" stopColor="#e6e3f6" />
          <stop offset="1" stopColor="#f3f1fb" />
        </linearGradient>
        <linearGradient id={id('mid')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c7c2ea" />
          <stop offset="0.55" stopColor="#e0dcf4" />
          <stop offset="1" stopColor="#f1eefb" />
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf6" />
          <stop offset="0.55" stopColor="#ffeff0" />
          <stop offset="1" stopColor="#ffe2ec" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="650" cy="160" r="70" fill={paint('sun')} />
      <circle cx="650" cy="160" r="36" fill="#fff9f5" />
      <path fill={paint('far')} d={FAR_RANGE} />
      <path fill="#ffffff" opacity={0.7} d={FAR_SNOW} />
      <path fill={paint('peak')} d={PEAK_LEFT} />
      <path fill="#f9f8ff" d={PEAK_LEFT_SNOW} />
      <path fill="#c6c1e8" opacity={0.55} d={PEAK_LEFT_SHADE} />
      <path fill={paint('peak')} d={PEAK_RIGHT} />
      <path fill="#f9f8ff" d={PEAK_RIGHT_SNOW} />
      <path fill={paint('mid')} d={MID_RANGE} />
    </svg>
  );
}

/** The main peak: faces, snow, the trail, the flag and a few sparks. */
function Massif({ id, paint }: Refs) {
  return (
    <svg className={styles.layer} viewBox={VIEW_BOX} focusable="false">
      <defs>
        <linearGradient id={id('flank')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aeacd8" />
          <stop offset="0.5" stopColor="#c9c6e8" />
          <stop offset="1" stopColor="#eae7f8" />
        </linearGradient>
        <linearGradient id={id('face')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfccec" />
          <stop offset="0.55" stopColor="#dedbf3" />
          <stop offset="1" stopColor="#f0eefa" />
        </linearGradient>
        <linearGradient id={id('shade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8285ba" />
          <stop offset="0.5" stopColor="#a3a3d1" />
          <stop offset="1" stopColor="#d9d6f0" />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a3a3d1" />
          <stop offset="1" stopColor="#efc6dc" />
        </linearGradient>
        <linearGradient id={id('snow-shade')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ebe7f9" />
          <stop offset="1" stopColor="#cdc8eb" />
        </linearGradient>
        <linearGradient id={id('foot')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b4b2db" />
          <stop offset="0.5" stopColor="#d8d5ef" />
          <stop offset="1" stopColor="#f1eefb" />
        </linearGradient>
        <linearGradient id={id('cloth')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8466ff" />
          <stop offset="0.11" stopColor="#6d4aff" />
          <stop offset="0.15" stopColor="#17142f" />
          <stop offset="1" stopColor="#17142f" />
        </linearGradient>
        <mask id={id('trail')} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW_W} height={VIEW_H}>
          <path className={styles.trailReveal} d={TRAIL_D} pathLength={1} fill="none" stroke="#fff" strokeWidth={18} />
        </mask>
      </defs>

      <path fill={paint('flank')} d={MASSIF} />
      <path fill={paint('face')} d={FACE} />
      <path fill={paint('shade')} d={SHADE} />
      <path fill={paint('rim')} opacity={0.6} d={RIM} />
      <path fill="#ffffff" d={SNOW_LIT} />
      <path fill={paint('snow-shade')} d={SNOW_SHADE} />
      {GULLIES.map((gully) => (
        <path key={gully.d} fill={gully.fill} opacity={gully.opacity} d={gully.d} />
      ))}
      <path
        fill="none"
        stroke="#8d8ec2"
        strokeOpacity={0.3}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        d={ROCK_LINES}
      />
      <path fill={paint('foot')} d={FOOTHILL} />

      <g mask={paint('trail')}>
        <path
          d={TRAIL_D}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.85}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={TRAIL_D} fill="none" stroke="#6d4aff" strokeWidth={3.4} strokeLinecap="round" strokeDasharray="0 9.5" />
      </g>

      <path fill="#3a3658" d="M589 125 595 118H606L613 126Z" />
      <g className={styles.pole}>
        <rect x="599" y="58" width="2.8" height="64" rx="1.4" fill="#2a2742" />
        <circle cx="600.4" cy="57" r="2.6" fill="#2a2742" />
      </g>
      <g className={styles.cloth}>
        <g className={styles.sway}>
          <path className={styles.clothShape} fill={paint('cloth')} d={CLOTH} />
        </g>
      </g>

      <g className={styles.sparks}>
        {SPARKS.map((spark) => (
          <path
            key={spark.d}
            className={styles.spark}
            fill={spark.fill}
            d={spark.d}
            style={{ '--lag': `${spark.lag}s` } as CssVars}
          />
        ))}
      </g>
    </svg>
  );
}

export interface SummitMilestone {
  label: string;
  current?: boolean;
}

/** One pin per role, newest first in; the oldest sits lowest on the mountain. */
function Pins({ milestones }: { milestones: SummitMilestone[] }) {
  const shown = milestones.slice(0, MAX_STOPS);
  const waypoints = stopWaypoints(shown.length);
  return (
    <div className={styles.pins}>
      {shown.map((milestone, index) => {
        const waypoint = waypoints[shown.length - 1 - index] ?? LAST_STOP;
        const [x, y] = point(TRAIL, waypoint);
        const style: CssVars = {
          left: pct(x, VIEW_W),
          top: pct(y, VIEW_H),
          // Pops as the drawing trail reaches it.
          '--delay': `${Math.round(DRAW_LAG_MS + (PROGRESS[waypoint] ?? 1) * DRAW_MS)}ms`,
          '--pulse-lag': `${(-index * 0.9).toFixed(1)}s`,
        };
        return (
          <span
            key={`${milestone.label}-${index}`}
            className={styles.milestone}
            data-milestone={index}
            data-current={milestone.current ? '' : undefined}
            style={style}
          >
            <span className={styles.halo} />
            <span className={styles.dot} />
            <span className={styles.tag}>{milestone.label}</span>
          </span>
        );
      })}
    </div>
  );
}

interface SummitArtProps {
  /** One per timeline entry, newest first (the timeline's order). */
  milestones: SummitMilestone[];
  className?: string;
}

export function SummitArt({ milestones, className }: SummitArtProps) {
  const uid = useId();
  const refs: Refs = {
    id: (name) => `${uid}-${name}`,
    paint: (name) => `url(#${uid}-${name})`,
  };
  const timing: CssVars = {
    '--draw': `${DRAW_MS}ms`,
    '--draw-lag': `${DRAW_LAG_MS}ms`,
    '--flag-at': `${DRAW_LAG_MS + DRAW_MS}ms`,
  };

  return (
    <div className={cn(styles.root, className)} data-summit="" aria-hidden="true" style={timing}>
      <div className={styles.frame}>
        <div className={styles.scene} data-summit-scene="">
          <Sky />
          <BackRanges {...refs} />
          <Clouds clouds={BACK_CLOUDS} className={styles.cloudsBack} />
          <Massif {...refs} />
          <Clouds clouds={FRONT_CLOUDS} className={styles.cloudsFront} />
        </div>
      </div>
      <Pins milestones={milestones} />
    </div>
  );
}
