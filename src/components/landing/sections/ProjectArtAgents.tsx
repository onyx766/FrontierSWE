import { cn } from '@/lib/utils';
import { BACK, MAIN, PanelHeader, PanelSvg, Pill, SIDE, ink, vars, type PanelArt } from './ProjectArtKit';
import styles from './Projects.module.css';

/**
 * Agent Orchestration Platform: the planner node fanning out to its tools
 * with requests and results travelling along the edges, the run's steps,
 * and the execution trace streaming in.
 */

type Glyph = 'spark' | 'search' | 'db' | 'globe' | 'code';

const CORE = { x: 104, y: 110, w: 74, h: 32 };

const TOOLS: { label: string; cx: number; cy: number; w: number; glyph: Glyph }[] = [
  { label: 'llm · claude', cx: 141, cy: 56, w: 76, glyph: 'spark' },
  { label: 'search_docs', cx: 51, cy: 100, w: 68, glyph: 'search' },
  { label: 'run_sql', cx: 232, cy: 100, w: 56, glyph: 'db' },
  { label: 'http.fetch', cx: 60, cy: 192, w: 62, glyph: 'globe' },
  { label: 'code.exec', cx: 222, cy: 192, w: 60, glyph: 'code' },
];

/** Planner to tool. `back` packets travel the other way: results returning. */
const EDGES: { d: string; dur: number; delay: number; back: boolean }[] = [
  { d: 'M141 110 L141 67', dur: 2.1, delay: -0.3, back: false },
  { d: 'M104 126 C 94 126, 96 100, 85 100', dur: 2.5, delay: -1.1, back: true },
  { d: 'M178 126 C 190 126, 192 100, 204 100', dur: 2.3, delay: -1.7, back: false },
  { d: 'M121 142 C 121 166, 60 158, 60 181', dur: 2.9, delay: -0.6, back: false },
  { d: 'M161 142 C 161 166, 222 158, 222 181', dur: 2.7, delay: -2.2, back: true },
];

function ToolGlyph({ glyph, x, y }: { glyph: Glyph; x: number; y: number }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={ink.text}
      strokeWidth="0.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph === 'spark' ? (
        <path
          d="M0 -3.4 L0.9 -0.9 L3.4 0 L0.9 0.9 L0 3.4 L-0.9 0.9 L-3.4 0 L-0.9 -0.9 Z"
          fill={ink.text}
          stroke="none"
        />
      ) : null}
      {glyph === 'search' ? (
        <>
          <circle cx="-0.6" cy="-0.6" r="2.2" />
          <path d="M1 1 L2.9 2.9" />
        </>
      ) : null}
      {glyph === 'db' ? (
        <>
          <ellipse cx="0" cy="-2" rx="2.8" ry="1.1" />
          <path d="M-2.8 -2 V2 A2.8 1.1 0 0 0 2.8 2 V-2" />
        </>
      ) : null}
      {glyph === 'globe' ? (
        <>
          <circle r="3" />
          <ellipse rx="1.25" ry="3" />
          <path d="M-3 0 H3" />
        </>
      ) : null}
      {glyph === 'code' ? <path d="M-1.1 -2.6 L-3.2 0 L-1.1 2.6 M1.1 -2.6 L3.2 0 L1.1 2.6" /> : null}
    </g>
  );
}

function Graph() {
  return (
    <PanelSvg size={MAIN}>
      <defs>
        <linearGradient id="prj-agents-core" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a58bff" />
          <stop offset="1" stopColor="#5b34f0" />
        </linearGradient>
      </defs>

      <PanelHeader width={MAIN.w} title="orchestrator">
        <rect
          x="216"
          y="6.5"
          width="56"
          height="11"
          rx="5.5"
          fill="rgba(74,222,128,0.12)"
          stroke="rgba(74,222,128,0.45)"
          strokeWidth="0.6"
        />
        <circle cx="223.5" cy="12" r="1.9" fill={ink.green} className={styles.blink} />
        <text x="228.5" y="14.2" fontSize="5.8" fill={ink.mint} className={styles.mono}>
          streaming
        </text>
      </PanelHeader>

      {EDGES.map((edge) => {
        const packet = cn(styles.packet, edge.back && styles.packetReverse);
        const timing = vars({ '--dur': `${edge.dur}s`, '--delay': `${edge.delay}s` });
        return (
          <g key={edge.d}>
            <path d={edge.d} fill="none" stroke="rgba(139,92,246,0.24)" strokeWidth="3.4" strokeLinecap="round" />
            <path d={edge.d} fill="none" stroke="rgba(216,204,255,0.55)" strokeWidth="0.9" />
            <path
              d={edge.d}
              pathLength={100}
              fill="none"
              stroke="rgba(196,181,253,0.5)"
              strokeWidth="5"
              strokeLinecap="round"
              className={packet}
              style={timing}
              data-motion="packet"
            />
            <path
              d={edge.d}
              pathLength={100}
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.9"
              strokeLinecap="round"
              className={packet}
              style={timing}
              data-motion="packet"
            />
          </g>
        );
      })}

      {TOOLS.map((tool) => {
        const left = tool.cx - tool.w / 2;
        return (
          <g key={tool.label}>
            <rect
              x={left}
              y={tool.cy - 11}
              width={tool.w}
              height="22"
              rx="6"
              fill="rgba(236,230,255,0.1)"
              stroke="rgba(216,204,255,0.55)"
              strokeWidth="0.7"
            />
            <rect x={left + 5} y={tool.cy - 5.5} width="11" height="11" rx="3" fill="rgba(167,139,250,0.34)" />
            <ToolGlyph glyph={tool.glyph} x={left + 10.5} y={tool.cy} />
            <text x={left + 19} y={tool.cy + 2.3} fontSize="6.4" fill={ink.text} className={styles.mono}>
              {tool.label}
            </text>
          </g>
        );
      })}

      <rect
        x={CORE.x}
        y={CORE.y}
        width={CORE.w}
        height={CORE.h}
        rx="9"
        fill="none"
        stroke={ink.lilac}
        strokeWidth="1"
        className={styles.ping}
      />
      <rect
        x={CORE.x}
        y={CORE.y}
        width={CORE.w}
        height={CORE.h}
        rx="9"
        fill="url(#prj-agents-core)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="0.8"
      />
      <text x="141" y="125" textAnchor="middle" fontSize="8.4" fontWeight="700" fill="#ffffff">
        planner
      </text>
      <text
        x="141"
        y="134.5"
        textAnchor="middle"
        fontSize="5"
        fill="rgba(255,255,255,0.78)"
        letterSpacing="0.1em"
      >
        ORCHESTRATOR
      </text>

      <text x="14" y="227" fontSize="5.6" fill={ink.muted} className={styles.mono}>
        5 tools · step 7/12
      </text>
      <text x="268" y="227" textAnchor="end" fontSize="5.6" fill={ink.muted} className={styles.mono}>
        p95 1.8s
      </text>
    </PanelSvg>
  );
}

const STEPS: { label: string; time: string; state: 'done' | 'running' | 'pending' }[] = [
  { label: 'plan', time: '0.4s', state: 'done' },
  { label: 'retrieve', time: '1.1s', state: 'done' },
  { label: 'call tools', time: '2.3s', state: 'running' },
  { label: 'verify', time: '—', state: 'pending' },
  { label: 'respond', time: '—', state: 'pending' },
];

function Steps() {
  return (
    <PanelSvg size={BACK}>
      <defs>
        <linearGradient id="prj-agents-bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#d6c9ff" />
        </linearGradient>
      </defs>
      <PanelHeader width={BACK.w} title="run steps">
        <text x="146" y="14.5" textAnchor="end" fontSize="6" fill={ink.lilac} className={styles.mono}>
          3/5
        </text>
      </PanelHeader>

      {STEPS.map((step, i) => {
        const y = 41 + i * 29;
        const pending = step.state === 'pending';
        return (
          <g key={step.label}>
            <g transform={`translate(14 ${y})`}>
              {step.state === 'done' ? (
                <>
                  <circle r="4.4" fill="rgba(74,222,128,0.16)" stroke={ink.green} strokeWidth="0.8" />
                  <path
                    d="M-1.9 0.1 L-0.5 1.5 L2 -1.3"
                    fill="none"
                    stroke={ink.green}
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
              {step.state === 'running' ? (
                <>
                  <circle r="4.4" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.9" />
                  <circle
                    r="4.4"
                    fill="none"
                    stroke={ink.lilac}
                    strokeWidth="1.1"
                    strokeDasharray="7 21"
                    strokeLinecap="round"
                    className={styles.spinner}
                  />
                </>
              ) : null}
              {pending ? (
                <circle
                  r="4.4"
                  fill="none"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="0.8"
                  strokeDasharray="1.6 1.8"
                />
              ) : null}
            </g>
            <text
              x="25"
              y={y + 2.3}
              fontSize="6.6"
              fontWeight={step.state === 'running' ? 600 : 400}
              fill={pending ? 'rgba(255,255,255,0.45)' : ink.text}
            >
              {step.label}
            </text>
            <text
              x="146"
              y={y + 2.3}
              textAnchor="end"
              fontSize="5.6"
              fill={step.state === 'running' ? ink.lilac : pending ? 'rgba(255,255,255,0.3)' : ink.muted}
              className={styles.mono}
            >
              {step.time}
            </text>
            <rect x="25" y={y + 7} width="121" height="3" rx="1.5" fill="rgba(255,255,255,0.09)" />
            {pending ? null : (
              <rect
                x="25"
                y={y + 7}
                width="121"
                height="3"
                rx="1.5"
                fill="url(#prj-agents-bar)"
                className={step.state === 'running' ? styles.fillLoop : undefined}
              />
            )}
          </g>
        );
      })}

      <text x="11" y="188" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        budget 12 steps · $0.012
      </text>
    </PanelSvg>
  );
}

const TRACE: { t: string; event: string; value: string }[] = [
  { t: '00.00', event: 'run.start', value: '' },
  { t: '00.08', event: 'model.call', value: '412ms' },
  { t: '00.49', event: 'tool.search', value: '182ms' },
  { t: '00.67', event: 'tool.sql', value: '96ms' },
  { t: '00.76', event: 'model.call', value: '388ms' },
  { t: '01.15', event: 'tool.exec', value: '240ms' },
  { t: '01.39', event: 'stream', value: '128 tok' },
  { t: '01.52', event: 'run.done', value: 'ok' },
];

/** The waterfall under the log: [x, row, width, colour]. */
const SPANS: [number, number, number, string][] = [
  [12, 0, 38, ink.violet],
  [50, 0, 18, ink.pink],
  [68, 1, 11, ink.sky],
  [79, 0, 36, ink.violet],
  [115, 1, 22, ink.pink],
  [137, 0, 11, ink.green],
];

function Trace() {
  return (
    <PanelSvg size={SIDE}>
      <PanelHeader width={SIDE.w} title="trace">
        <text x="149" y="14.5" textAnchor="end" fontSize="5.6" fill={ink.muted} className={styles.mono}>
          run_2419
        </text>
      </PanelHeader>

      {TRACE.map((line, i) => {
        const y = 40 + i * 16.5;
        const last = i === TRACE.length - 1;
        return (
          <g key={`${line.t}-${line.event}`} className={styles.logLine} style={vars({ '--i': i })}>
            {i === 2 ? (
              <rect
                x="5"
                y={y - 9.5}
                width="148"
                height="13"
                rx="3"
                fill="rgba(139,92,246,0.24)"
                stroke="rgba(196,181,253,0.4)"
                strokeWidth="0.5"
              />
            ) : null}
            <text x="9" y={y} fontSize="5.4" fill={ink.muted} className={styles.mono}>
              {line.t}
            </text>
            <text x="34" y={y} fontSize="6" fill="#ddd4ff" className={styles.mono}>
              {line.event}
            </text>
            <text
              x="149"
              y={y}
              textAnchor="end"
              fontSize="5.4"
              fill={last ? ink.green : ink.lilac}
              className={styles.mono}
            >
              {line.value}
            </text>
            {last ? (
              <rect x="66" y={y - 5.6} width="3" height="6.6" fill={ink.lilac} className={styles.blink} />
            ) : null}
          </g>
        );
      })}

      <text x="9" y="176" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        SPANS
      </text>
      <rect x="9" y="180" width="139" height="3" rx="1.5" fill="rgba(167,139,250,0.3)" />
      {SPANS.map(([x, row, w, color]) => (
        <rect key={x} x={x} y={185.5 + row * 5} width={w} height="3" rx="1.5" fill={color} opacity="0.9" />
      ))}
      <Pill x={110} y={166} w={39} text="1.52s" tone="muted" h={10} />
    </PanelSvg>
  );
}

export function agentsArt(): PanelArt {
  return { back: <Steps />, main: <Graph />, side: <Trace /> };
}
