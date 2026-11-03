import { BACK, MAIN, PanelHeader, PanelSvg, Pill, SIDE, ink, vars, type PanelArt } from './ProjectArtKit';
import styles from './Projects.module.css';

/**
 * RAG Knowledge Service: documents chunked and embedded, a query scanned
 * across the vector index with its nearest neighbours lighting up, keyword
 * matches beside it, a reranked shortlist, and the cited answer.
 */

const DOCS: { name: string; size: string }[] = [
  { name: 'handbook.pdf', size: '2.4 MB' },
  { name: 'api-docs.md', size: '380 KB' },
  { name: 'faq.html', size: '96 KB' },
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
      <PanelHeader width={BACK.w} title="ingest">
        <text x="146" y="14.5" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
          1,280 chunks
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
        chunk → embed
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
        embedding
      </text>
      <text x="146" y="171" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
        82%
      </text>
      <rect x="12" y="176" width="134" height="3.5" rx="1.75" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="176" width="110" height="3.5" rx="1.75" fill="url(#prj-rag-progress)" />
      <text x="12" y="191" fontSize="5.2" fill={ink.muted} className={styles.mono}>
        pgvector · 1536 dims
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
  { term: 'refund', weight: 0.92, hit: true },
  { term: 'annual', weight: 0.74, hit: true },
  { term: 'plan', weight: 0.61, hit: true },
  { term: 'invoice', weight: 0.3, hit: false },
  { term: 'policy', weight: 0.22, hit: false },
];

const RANKED: { ref: string; score: number }[] = [
  { ref: '§4.2', score: 0.94 },
  { ref: 'faq#3', score: 0.88 },
  { ref: '§1.1', score: 0.71 },
  { ref: 'api/v2', score: 0.52 },
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

      <PanelHeader width={MAIN.w} title="retrieval · hybrid">
        <Pill x={234} y={6.5} w={38} text="top-k 8" />
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
        How do refunds work on annual plans?
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
        vector · pgvector
      </text>
      <text x="172" y="68.5" textAnchor="end" fontSize="5.4" fill={ink.lilac} className={styles.mono}>
        cos ≥ 0.82
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
        keyword · bm25
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
        rerank
      </text>
      <text x="270" y="181" textAnchor="end" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        cross-encoder
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
  { n: 1, name: 'billing-policy.pdf', at: 'p.4' },
  { n: 2, name: 'help/refunds.md', at: '§3' },
];

const EVALS: { label: string; value: number }[] = [
  { label: 'recall@10', value: 0.94 },
  { label: 'faithfulness', value: 0.97 },
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
      <PanelHeader width={SIDE.w} title="answer">
        <Pill x={120} y={6.5} w={30} text="cited" tone="green" />
      </PanelHeader>

      <g fontSize="6.3" fill={ink.text}>
        <text x="10" y="40">
          Annual plans can be refunded
        </text>
        <text x="10" y="50">
          within 30 days of renewal <tspan fill={ink.lilac}>[1]</tspan>
        </text>
        <text x="10" y="60">
          Refunds go back to the original
        </text>
        <text x="10" y="70">
          payment method in 5–10 days <tspan fill={ink.lilac}>[2]</tspan>
        </text>
      </g>
      <rect x="10" y="75" width="1.2" height="7" fill={ink.lilac} className={styles.blink} />

      <text x="10" y="94" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        SOURCES
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
        EVAL
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
        640 ms · 3 sources
      </text>
    </PanelSvg>
  );
}

export function ragArt(): PanelArt {
  return { back: <Ingest />, main: <Retrieval />, side: <Answer /> };
}
