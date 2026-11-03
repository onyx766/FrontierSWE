import { BACK, MAIN, PanelHeader, PanelSvg, Pill, SIDE, ink, vars, type PanelArt } from './ProjectArtKit';
import styles from './Projects.module.css';

/**
 * Zypact: an approved protocol, one buyer question sampled against the AI
 * surface with the runs that mention you lighting up, the brands cited in
 * each answer, positions, and the Outcome Card with its preserved evidence.
 */

const DOCS: { name: string; size: string }[] = [
  { name: 'question.txt', size: 'locked' },
  { name: 'sampling.json', size: 'n = 30' },
  { name: 'decision.rule', size: 'v1' },
];

function Ingest() {
  const chunks = Array.from({ length: 24 }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6), i }));
  return (
    <PanelSvg size={BACK}>
      <defs>
        <linearGradient id="prj-rag-progress" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <PanelHeader width={BACK.w} title="protocol">
        <text x="146" y="14.5" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
          approved
        </text>
      </PanelHeader>

      {DOCS.map((doc, i) => {
        const y = 38 + i * 18;
        return (
          <g key={doc.name}>
            <g transform={`translate(9 ${y - 8})`} fill="none" stroke={ink.lilac} strokeWidth="0.7" strokeLinejoin="round">
              <path d="M0 0 H7.5 L10 2.5 V12 H0 Z" fill="rgba(255,255,255,0.1)" />
              <path d="M7.5 0 V2.5 H10" />
              <path d="M2 5.5 H7.5 M2 8 H6" strokeLinecap="round" />
            </g>
            <text x="24" y={y + 0.5} fontSize="6.2" fill={ink.text}>
              {doc.name}
            </text>
            <text x="146" y={y + 0.5} textAnchor="end" fontSize="5.4" fill={ink.muted} className={styles.mono}>
              {doc.size}
            </text>
          </g>
        );
      })}

      <path
        d="M78 88 V100 M74.5 96.5 L78 100 L81.5 96.5"
        fill="none"
        stroke={ink.lilac}
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="86" y="96" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        sample → record
      </text>

      {chunks.map(({ col, row, i }) => (
        <rect
          key={i}
          x={12 + col * 22.4}
          y={108 + row * 12.5}
          width="18"
          height="8.5"
          rx="2.5"
          fill={i % 7 === 3 ? ink.pink : i % 5 === 1 ? ink.sky : ink.violet}
          className={styles.chunk}
          style={vars({ '--i': i })}
        />
      ))}

      <text x="12" y="171" fontSize="6" fill={ink.soft}>
        runs captured
      </text>
      <text x="146" y="171" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
        82%
      </text>
      <rect x="12" y="176" width="134" height="3.5" rx="1.75" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="176" width="110" height="3.5" rx="1.75" fill="url(#prj-rag-progress)" />
      <text x="12" y="191" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        evidence · insert-only
      </text>
    </PanelSvg>
  );
}

/** Index grid geometry, and the query's nearest neighbours in it. */
const COLS = 12;
const ROWS = 6;
const dotX = (col: number) => 22 + col * 13.5;
const dotY = (row: number) => 80 + row * 15;
const NEIGHBOURS: [number, number][] = [
  [5, 2],
  [6, 1],
  [7, 2],
  [6, 3],
  [4, 3],
  [7, 4],
  [8, 1],
];
const QUERY = { x: 101, y: 113 };

/** When the scan beam (3.8s, linear, 200 units of travel) is over x. */
const hitDelay = (x: number) => `${((x + 3) * 0.019 - 0.23 - 3.8).toFixed(2)}s`;

const TERMS: { term: string; weight: number; hit: boolean }[] = [
  { term: 'you', weight: 0.63, hit: true },
  { term: 'brand A', weight: 0.81, hit: true },
  { term: 'brand B', weight: 0.57, hit: true },
  { term: 'brand C', weight: 0.3, hit: false },
  { term: 'brand D', weight: 0.22, hit: false },
];

const RANKED: { ref: string; score: number }[] = [
  { ref: 'brand A', score: 0.94 },
  { ref: 'you', score: 0.88 },
  { ref: 'brand B', score: 0.71 },
  { ref: 'brand C', score: 0.52 },
];

function Retrieval() {
  const isNeighbour = (col: number, row: number) => NEIGHBOURS.some(([c, r]) => c === col && r === row);
  const grid = Array.from({ length: COLS * ROWS }, (_, i) => ({ col: i % COLS, row: Math.floor(i / COLS) }));
  return (
    <PanelSvg size={MAIN}>
      <defs>
        <linearGradient id="prj-rag-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="0.6" stopColor="#c4b5fd" stopOpacity="0.42" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="prj-rag-rank" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient id="prj-rag-send" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a58bff" />
          <stop offset="1" stopColor="#5b34f0" />
        </linearGradient>
        <clipPath id="prj-rag-clip">
          <rect x="12" y="57" width="168" height="108" rx="8" />
        </clipPath>
      </defs>

      <PanelHeader width={MAIN.w} title="perplexity · sonar">
        <Pill x={234} y={6.5} w={38} text="n = 30" />
      </PanelHeader>

      <rect
        x="12"
        y="31"
        width="258"
        height="19"
        rx="9.5"
        fill="rgba(255,255,255,0.07)"
        stroke="rgba(216,204,255,0.42)"
        strokeWidth="0.7"
      />
      <g fill="none" stroke={ink.lilac} strokeWidth="0.9" strokeLinecap="round">
        <circle cx="22.4" cy="39.9" r="2.6" />
        <path d="M24.4 41.9 L26.2 43.7" />
      </g>
      <text x="31" y="42.8" fontSize="6.6" fill={ink.text}>
        Best compliance tool for a startup?
      </text>
      <rect x="151" y="36.4" width="1.2" height="8" fill={ink.lilac} className={styles.blink} />
      <circle cx="262" cy="40.5" r="6" fill="url(#prj-rag-send)" />
      <path
        d="M259.4 40.5 H264.4 M262.4 38.5 L264.4 40.5 L262.4 42.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vector index */}
      <rect x="12" y="57" width="168" height="108" rx="8" fill={ink.well} stroke="rgba(255,255,255,0.09)" />
      <text x="20" y="68.5" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        sampled answers
      </text>
      <text x="172" y="68.5" textAnchor="end" fontSize="5.4" fill={ink.lilac} className={styles.mono}>
        7 mention you
      </text>
      <g clipPath="url(#prj-rag-clip)">
        <rect
          x="12"
          y="57"
          width="30"
          height="108"
          fill="url(#prj-rag-beam)"
          className={styles.sweep}
          data-motion="sweep"
        />
      </g>
      {NEIGHBOURS.map(([col, row]) => (
        <line
          key={`l-${col}-${row}`}
          x1={QUERY.x}
          y1={QUERY.y}
          x2={dotX(col)}
          y2={dotY(row)}
          stroke="rgba(240,171,252,0.5)"
          strokeWidth="0.6"
        />
      ))}
      {grid.map(({ col, row }) =>
        isNeighbour(col, row) ? (
          <g key={`d-${col}-${row}`} className={styles.hit} style={vars({ '--delay': hitDelay(dotX(col)) })}>
            <circle cx={dotX(col)} cy={dotY(row)} r="4.6" fill="rgba(196,181,253,0.22)" />
            <circle cx={dotX(col)} cy={dotY(row)} r="2.4" fill={ink.lilac} />
          </g>
        ) : (
          <circle key={`d-${col}-${row}`} cx={dotX(col)} cy={dotY(row)} r="1.4" fill="rgba(255,255,255,0.26)" />
        ),
      )}
      <circle cx={QUERY.x} cy={QUERY.y} r="6" fill="none" stroke={ink.pink} strokeWidth="0.8" className={styles.ping} />
      <path
        transform={`translate(${QUERY.x} ${QUERY.y})`}
        d="M0 -4.4 L1.1 -1.1 L4.4 0 L1.1 1.1 L0 4.4 L-1.1 1.1 L-4.4 0 L-1.1 -1.1 Z"
        fill={ink.pink}
      />

      {/* Keyword matches */}
      <rect x="188" y="57" width="82" height="108" rx="8" fill={ink.well} stroke="rgba(255,255,255,0.09)" />
      <text x="196" y="68.5" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        brands cited
      </text>
      {TERMS.map((term, i) => {
        const y = 80 + i * 16.5;
        return (
          <g key={term.term}>
            <rect
              x="196"
              y={y - 6.5}
              width="34"
              height="11"
              rx="5.5"
              fill={term.hit ? 'rgba(139,92,246,0.36)' : 'rgba(255,255,255,0.06)'}
              stroke={term.hit ? 'rgba(196,181,253,0.55)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="0.6"
            />
            <text
              x="213"
              y={y + 1.5}
              textAnchor="middle"
              fontSize="5.6"
              fill={term.hit ? ink.text : ink.muted}
              className={styles.mono}
            >
              {term.term}
            </text>
            <rect x="234" y={y - 2.5} width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
            <rect
              x="234"
              y={y - 2.5}
              width={28 * term.weight}
              height="3"
              rx="1.5"
              fill={term.hit ? ink.pink : 'rgba(255,255,255,0.22)'}
            />
          </g>
        );
      })}

      {/* Rerank */}
      <text x="12" y="181" fontSize="6.4" fontWeight="600" fill={ink.text}>
        position
      </text>
      <text x="270" y="181" textAnchor="end" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        prompt-scoped
      </text>
      {RANKED.map((item, i) => {
        const y = 188 + i * 10.5;
        const top = i < 2;
        return (
          <g key={item.ref}>
            <text x="12" y={y + 4.3} fontSize="5.4" fill={ink.muted} className={styles.mono}>
              {item.ref}
            </text>
            <rect x="46" y={y} width="192" height="5" rx="2.5" fill="rgba(255,255,255,0.07)" />
            <rect
              x="46"
              y={y}
              width={192 * item.score}
              height="5"
              rx="2.5"
              fill={top ? 'url(#prj-rag-rank)' : 'rgba(196,181,253,0.45)'}
              className={styles.barBreathe}
              style={vars({ '--i': i })}
            />
            <text
              x="270"
              y={y + 4.3}
              textAnchor="end"
              fontSize="5.4"
              fill={top ? ink.lilac : ink.muted}
              className={styles.mono}
            >
              {item.score.toFixed(2)}
            </text>
          </g>
        );
      })}
    </PanelSvg>
  );
}

const SOURCES: { n: number; name: string; at: string }[] = [
  { n: 1, name: 'run-0412.json', at: '#12' },
  { n: 2, name: 'cites/pricing.html', at: '#27' },
];

const EVALS: { label: string; value: number }[] = [
  { label: 'before', value: 0.41 },
  { label: 'after retest', value: 0.63 },
];

function Answer() {
  return (
    <PanelSvg size={SIDE}>
      <defs>
        <linearGradient id="prj-rag-eval" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <PanelHeader width={SIDE.w} title="outcome card">
        <Pill x={120} y={6.5} w={30} text="+ seen" tone="green" />
      </PanelHeader>

      <g fontSize="6.3" fill={ink.text}>
        <text x="10" y="40">
          Mention rate rose after the
        </text>
        <text x="10" y="50">
          pricing page change <tspan fill={ink.lilac}>[1]</tspan>
        </text>
        <text x="10" y="60">
          Same question, same surface,
        </text>
        <text x="10" y="70">
          re-asked in the window <tspan fill={ink.lilac}>[2]</tspan>
        </text>
      </g>
      <rect x="10" y="75" width="1.2" height="7" fill={ink.lilac} className={styles.blink} />

      <text x="10" y="94" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        EVIDENCE
      </text>
      {SOURCES.map((source, i) => {
        const y = 99 + i * 20;
        return (
          <g key={source.name}>
            <rect
              x="7"
              y={y}
              width="144"
              height="16"
              rx="5"
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="0.6"
            />
            <circle cx="16" cy={y + 8} r="4.6" fill="rgba(139,92,246,0.5)" />
            <text x="16" y={y + 10} textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#ffffff">
              {source.n}
            </text>
            <text x="25" y={y + 10.2} fontSize="6" fill={ink.text}>
              {source.name}
            </text>
            <text x="146" y={y + 10.2} textAnchor="end" fontSize="5.4" fill={ink.muted} className={styles.mono}>
              {source.at}
            </text>
          </g>
        );
      })}

      <text x="10" y="150" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        MENTION RATE
      </text>
      {EVALS.map((metric, i) => {
        const y = 161 + i * 18;
        return (
          <g key={metric.label}>
            <text x="10" y={y} fontSize="6" fill={ink.soft}>
              {metric.label}
            </text>
            <text x="148" y={y} textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
              {metric.value.toFixed(2)}
            </text>
            <rect x="10" y={y + 3.5} width="138" height="3" rx="1.5" fill="rgba(255,255,255,0.09)" />
            <rect
              x="10"
              y={y + 3.5}
              width={138 * metric.value}
              height="3"
              rx="1.5"
              fill="url(#prj-rag-eval)"
              className={styles.barBreathe}
              style={vars({ '--i': i + 2 })}
            />
          </g>
        );
      })}
      <text x="10" y="200" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        increase observed
      </text>
    </PanelSvg>
  );
}

export function ragArt(): PanelArt {
  return { back: <Ingest />, main: <Retrieval />, side: <Answer /> };
}
