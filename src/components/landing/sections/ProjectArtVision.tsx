import { BACK, MAIN, PanelHeader, PanelSvg, Pill, SIDE, ink, vars, type PanelArt } from './ProjectArtKit';
import styles from './Projects.module.css';

/**
 * BPS Pro-Score: one overhead camera over a pool table. Calibration finds the
 * felt, rails, pockets and diamonds; the live view tracks every ball with a
 * scan line, tracking boxes and the predicted shot line; the scoreboard turns
 * it into a score, fouls and shot metrics.
 */

/** The felt inside the main panel, and its six pockets. */
const TABLE = { x: 22, y: 38, w: 238, h: 126 };
const POCKETS: [number, number][] = [
  [TABLE.x, TABLE.y],
  [TABLE.x + TABLE.w / 2, TABLE.y - 1.5],
  [TABLE.x + TABLE.w, TABLE.y],
  [TABLE.x, TABLE.y + TABLE.h],
  [TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h + 1.5],
  [TABLE.x + TABLE.w, TABLE.y + TABLE.h],
];

/** Diamond markers along the long and short rails, as fractions. */
const LONG_DIAMONDS = [1 / 8, 2 / 8, 3 / 8, 5 / 8, 6 / 8, 7 / 8];
const SHORT_DIAMONDS = [1 / 4, 2 / 4, 3 / 4];

const BALLS: { n: number; x: number; y: number; color: string; stripe?: boolean }[] = [
  { n: 1, x: 196, y: 72, color: '#fcd34d' },
  { n: 3, x: 214, y: 118, color: '#f87171' },
  { n: 9, x: 160, y: 140, color: '#fcd34d', stripe: true },
  { n: 5, x: 92, y: 62, color: '#fb923c' },
  { n: 8, x: 128, y: 102, color: '#1b1840' },
  { n: 12, x: 64, y: 134, color: '#a78bfa', stripe: true },
];
const CUE = { x: 98, y: 120 };
/** The object ball the shot line aims at, and the pocket it goes to. */
const TARGET = BALLS[1]!;
const TARGET_POCKET = POCKETS[5]!;

function Ball({ x, y, color, stripe }: { x: number; y: number; color: string; stripe?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="4.6" fill={stripe ? '#f8f6ff' : color} />
      {stripe ? <rect x={x - 4.6} y={y - 2} width="9.2" height="4" fill={color} /> : null}
      <circle cx={x - 1.4} cy={y - 1.6} r="1.2" fill="#ffffff" opacity="0.55" />
    </g>
  );
}

function LiveView() {
  return (
    <PanelSvg size={MAIN}>
      <defs>
        <linearGradient id="prj-vision-felt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b2f9a" />
          <stop offset="1" stopColor="#1f1a5c" />
        </linearGradient>
        <linearGradient id="prj-vision-scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0abfc" stopOpacity="0" />
          <stop offset="0.7" stopColor="#c4b5fd" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
        <clipPath id="prj-vision-clip">
          <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx="4" />
        </clipPath>
      </defs>

      <PanelHeader width={MAIN.w} title="bps · table cam">
        <rect
          x="222"
          y="6.5"
          width="50"
          height="11"
          rx="5.5"
          fill="rgba(74,222,128,0.12)"
          stroke="rgba(74,222,128,0.45)"
          strokeWidth="0.6"
        />
        <circle cx="229" cy="12" r="1.9" fill={ink.green} className={styles.blink} />
        <text x="234" y="14.2" fontSize="5.8" fill={ink.mint} className={styles.mono}>
          edge · live
        </text>
      </PanelHeader>

      {/* Rails and felt */}
      <rect
        x={TABLE.x - 8}
        y={TABLE.y - 8}
        width={TABLE.w + 16}
        height={TABLE.h + 16}
        rx="9"
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(216,204,255,0.4)"
        strokeWidth="0.7"
      />
      <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx="4" fill="url(#prj-vision-felt)" />
      {LONG_DIAMONDS.map((f) => (
        <g key={`ld-${f}`} fill={ink.lilac} opacity="0.75">
          <circle cx={TABLE.x + TABLE.w * f} cy={TABLE.y - 4} r="0.9" />
          <circle cx={TABLE.x + TABLE.w * f} cy={TABLE.y + TABLE.h + 4} r="0.9" />
        </g>
      ))}
      {SHORT_DIAMONDS.map((f) => (
        <g key={`sd-${f}`} fill={ink.lilac} opacity="0.75">
          <circle cx={TABLE.x - 4} cy={TABLE.y + TABLE.h * f} r="0.9" />
          <circle cx={TABLE.x + TABLE.w + 4} cy={TABLE.y + TABLE.h * f} r="0.9" />
        </g>
      ))}
      {POCKETS.map(([x, y]) => (
        <circle key={`p-${x}-${y}`} cx={x} cy={y} r="5.2" fill="#0b0920" stroke="rgba(196,181,253,0.35)" strokeWidth="0.6" />
      ))}
      {/* Head string and foot spot, as the calibration sees them. */}
      <line
        x1={TABLE.x + TABLE.w / 4}
        x2={TABLE.x + TABLE.w / 4}
        y1={TABLE.y}
        y2={TABLE.y + TABLE.h}
        stroke="rgba(255,255,255,0.12)"
        strokeDasharray="2 3"
      />

      {/* Predicted shot: cue ball to the 3, the 3 to the corner. */}
      <path
        d={`M${CUE.x} ${CUE.y} L${TARGET.x - 8.6} ${TARGET.y - 0.8}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.9"
        className={styles.trajectory}
      />
      <path
        d={`M${TARGET.x} ${TARGET.y} L${TARGET_POCKET[0] - 3} ${TARGET_POCKET[1] - 3}`}
        fill="none"
        stroke={ink.pink}
        strokeWidth="0.9"
        className={styles.trajectory}
      />
      <circle cx={TARGET.x - 9.2} cy={TARGET.y - 0.8} r="4.6" fill="none" stroke="rgba(255,255,255,0.5)" strokeDasharray="1.4 1.4" strokeWidth="0.6" />

      {BALLS.map((ball) => (
        <Ball key={ball.n} {...ball} />
      ))}
      <Ball x={CUE.x} y={CUE.y} color="#ffffff" />

      {/* Tracking boxes */}
      {[...BALLS, { n: 0, ...CUE }].map((ball, i) => (
        <g key={`t-${ball.n}`}>
          <rect
            x={ball.x - 7.5}
            y={ball.y - 7.5}
            width="15"
            height="15"
            rx="2"
            fill="none"
            stroke={ball.n === 0 ? ink.green : ink.lilac}
            strokeWidth="0.7"
            className={styles.lock}
            style={vars({ '--i': i })}
          />
          <text
            x={ball.x + 8.5}
            y={ball.y - 5}
            fontSize="4.6"
            fill={ball.n === 0 ? ink.mint : ink.soft}
            className={styles.mono}
          >
            {ball.n === 0 ? 'cue' : ball.n}
          </text>
        </g>
      ))}

      <g clipPath="url(#prj-vision-clip)">
        <rect
          x={TABLE.x}
          y={TABLE.y - 14}
          width={TABLE.w}
          height="14"
          fill="url(#prj-vision-scan)"
          className={styles.scanDown}
          data-motion="sweep"
        />
      </g>

      {/* Shot readout */}
      <Pill x={14} y={182} w={52} text="8-ball · APA" />
      <Pill x={70} y={182} w={46} text="3 → corner" tone="muted" />
      <Pill x={120} y={182} w={40} text="SDR 6.4" tone="muted" />
      <Pill x={164} y={182} w={44} text="no foul" tone="green" />
      <text x="14" y="214" fontSize="5.6" fill={ink.muted} className={styles.mono}>
        7 balls tracked · 60 fps
      </text>
      <text x="268" y="214" textAnchor="end" fontSize="5.6" fill={ink.muted} className={styles.mono}>
        on-device
      </text>
    </PanelSvg>
  );
}

const CHECKS: { label: string; value: string }[] = [
  { label: 'felt surface', value: 'found' },
  { label: 'rails', value: '4 / 4' },
  { label: 'pockets', value: '6 / 6' },
  { label: 'diamonds', value: '18' },
];

function Calibration() {
  return (
    <PanelSvg size={BACK}>
      <defs>
        <linearGradient id="prj-vision-progress" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <PanelHeader width={BACK.w} title="calibrate">
        <text x="146" y="14.5" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
          auto
        </text>
      </PanelHeader>

      {/* A small table outline with its corners being found. */}
      <rect x="22" y="34" width="112" height="58" rx="4" fill={ink.well} stroke="rgba(216,204,255,0.4)" strokeWidth="0.7" />
      {[
        [22, 34],
        [78, 34],
        [134, 34],
        [22, 92],
        [78, 92],
        [134, 92],
      ].map(([x, y], i) => (
        <g key={`c-${x}-${y}`}>
          <circle cx={x} cy={y} r="3.4" fill="rgba(240,171,252,0.25)" className={styles.lock} style={vars({ '--i': i })} />
          <circle cx={x} cy={y} r="1.5" fill={ink.pink} />
        </g>
      ))}
      <path d="M22 34 L134 92 M134 34 L22 92" stroke="rgba(196,181,253,0.25)" strokeWidth="0.5" strokeDasharray="2 2" />

      {CHECKS.map((check, i) => {
        const y = 112 + i * 14;
        return (
          <g key={check.label} className={styles.logLine} style={vars({ '--i': i })}>
            <circle cx="15" cy={y - 2} r="3.6" fill="rgba(74,222,128,0.16)" stroke={ink.green} strokeWidth="0.7" />
            <path
              d={`M13.4 ${y - 1.9} L14.6 ${y - 0.7} L16.7 ${y - 3.1}`}
              fill="none"
              stroke={ink.green}
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="24" y={y} fontSize="6.2" fill={ink.text}>
              {check.label}
            </text>
            <text x="146" y={y} textAnchor="end" fontSize="5.4" fill={ink.lilac} className={styles.mono}>
              {check.value}
            </text>
          </g>
        );
      })}

      <rect x="12" y="176" width="134" height="3.5" rx="1.75" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="176" width="134" height="3.5" rx="1.75" fill="url(#prj-vision-progress)" />
      <text x="12" y="191" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        one camera · ~10 min setup
      </text>
    </PanelSvg>
  );
}

const METRICS: { label: string; value: number; shown: string }[] = [
  { label: 'SDR · difficulty', value: 0.64, shown: '6.4' },
  { label: 'BSR · speed', value: 0.52, shown: '5.2' },
  { label: 'CBL · leave', value: 0.81, shown: '8.1' },
];

function Scoreboard() {
  return (
    <PanelSvg size={SIDE}>
      <defs>
        <linearGradient id="prj-vision-metric" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <PanelHeader width={SIDE.w} title="score">
        <Pill x={116} y={6.5} w={34} text="rack 4" tone="muted" />
      </PanelHeader>

      {[
        { name: 'Player A', score: 5, on: true },
        { name: 'Player B', score: 3, on: false },
      ].map((player, i) => {
        const y = 32 + i * 24;
        return (
          <g key={player.name}>
            <rect
              x="7"
              y={y}
              width="144"
              height="20"
              rx="6"
              fill={player.on ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}
              stroke={player.on ? 'rgba(196,181,253,0.55)' : 'rgba(255,255,255,0.09)'}
              strokeWidth="0.6"
            />
            {player.on ? <circle cx="16" cy={y + 10} r="2" fill={ink.green} className={styles.blink} /> : null}
            <text x="24" y={y + 12.6} fontSize="6.6" fontWeight={player.on ? 600 : 400} fill={ink.text}>
              {player.name}
            </text>
            <text x="143" y={y + 13.4} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#ffffff">
              {player.score}
            </text>
          </g>
        );
      })}

      <text x="10" y="96" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        LAST SHOT
      </text>
      {METRICS.map((metric, i) => {
        const y = 110 + i * 18;
        return (
          <g key={metric.label}>
            <text x="10" y={y} fontSize="6" fill={ink.soft}>
              {metric.label}
            </text>
            <text x="148" y={y} textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
              {metric.shown}
            </text>
            <rect x="10" y={y + 3.5} width="138" height="3" rx="1.5" fill="rgba(255,255,255,0.09)" />
            <rect
              x="10"
              y={y + 3.5}
              width={138 * metric.value}
              height="3"
              rx="1.5"
              fill="url(#prj-vision-metric)"
              className={styles.barBreathe}
              style={vars({ '--i': i })}
            />
          </g>
        );
      })}

      <Pill x={10} y={168} w={60} text="▶ instant replay" />
      <Pill x={74} y={168} w={44} text="coach tip" tone="muted" />
      <text x="10" y="198" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        foul check · scratch, rail
      </text>
    </PanelSvg>
  );
}

export function visionArt(): PanelArt {
  return { back: <Calibration />, main: <LiveView />, side: <Scoreboard /> };
}
