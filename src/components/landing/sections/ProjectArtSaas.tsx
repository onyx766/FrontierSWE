import { BACK, MAIN, PanelHeader, PanelSvg, Pill, SIDE, ink, smoothPath, vars, type PanelArt } from './ProjectArtKit';
import styles from './Projects.module.css';

/**
 * SaaS Platform Core: the admin dashboard (KPIs and a revenue chart whose
 * line draws in), the tenant list with usage, and roles, permissions and a
 * billing event.
 */

const NAV = ['Overview', 'Tenants', 'Billing', 'Usage', 'Roles', 'Settings'];

const KPIS: { label: string; value: string; delta: string; spark: number[] }[] = [
  { label: 'MRR', value: '$48.2k', delta: '▲ 12.4%', spark: [0.3, 0.42, 0.38, 0.56, 0.62, 0.8, 0.94] },
  { label: 'Tenants', value: '312', delta: '▲ 8.1%', spark: [0.5, 0.46, 0.58, 0.55, 0.7, 0.72, 0.86] },
  { label: 'API calls', value: '1.24M', delta: '▲ 21%', spark: [0.2, 0.35, 0.3, 0.52, 0.48, 0.74, 0.9] },
];

/** Revenue over the year, 0..1 of the plot height. */
const REVENUE = [0.18, 0.24, 0.21, 0.33, 0.38, 0.35, 0.47, 0.55, 0.52, 0.66, 0.74, 0.9];
const PLOT = { left: 74, right: 266, top: 108, bottom: 204 };

function Dashboard() {
  const step = (PLOT.right - PLOT.left) / (REVENUE.length - 1);
  const points = REVENUE.map((v, i) => [PLOT.left + i * step, PLOT.bottom - v * 94] as const);
  const line = smoothPath(points);
  const area = `${line} L${PLOT.right} ${PLOT.bottom} L${PLOT.left} ${PLOT.bottom} Z`;
  const lastY = PLOT.bottom - (REVENUE[REVENUE.length - 1] ?? 0) * 94;

  return (
    <PanelSvg size={MAIN}>
      <defs>
        <linearGradient id="prj-saas-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.5" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="prj-saas-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>

      <PanelHeader width={MAIN.w} title="acme · admin">
        <Pill x={208} y={6.5} w={48} text="last 30 days" tone="muted" />
        <circle cx="267" cy="12" r="5" fill={ink.pink} opacity="0.9" />
        <text x="267" y="14.1" textAnchor="middle" fontSize="5.4" fontWeight="700" fill={ink.night}>
          A
        </text>
      </PanelHeader>

      {/* Sidebar */}
      <rect x="0" y="24" width="58" height="212" fill="rgba(8,6,32,0.3)" />
      <line x1="58.5" x2="58.5" y1="24" y2="236" stroke={ink.line} />
      <rect
        x="4.5"
        y="31.5"
        width="49"
        height="14"
        rx="4.5"
        fill="rgba(139,92,246,0.42)"
        stroke="rgba(196,181,253,0.4)"
        strokeWidth="0.5"
      />
      {NAV.map((item, i) => {
        const y = 40 + i * 16;
        const active = i === 0;
        return (
          <g key={item}>
            <rect
              x="9"
              y={y - 4.5}
              width="6"
              height="6"
              rx="1.6"
              fill={active ? '#ffffff' : 'none'}
              stroke={active ? 'none' : ink.soft}
              strokeWidth="0.7"
            />
            <text
              x="19"
              y={y + 1.2}
              fontSize="6"
              fontWeight={active ? 600 : 400}
              fill={active ? '#ffffff' : ink.muted}
            >
              {item}
            </text>
          </g>
        );
      })}
      <rect
        x="6"
        y="192"
        width="46"
        height="34"
        rx="5"
        fill="rgba(167,139,250,0.14)"
        stroke="rgba(196,181,253,0.25)"
        strokeWidth="0.6"
      />
      <text x="11" y="203" fontSize="5.6" fontWeight="600" fill={ink.text}>
        Scale plan
      </text>
      <text x="11" y="211" fontSize="4.8" fill={ink.muted}>
        68% of seats
      </text>
      <rect x="11" y="216" width="36" height="2.6" rx="1.3" fill="rgba(255,255,255,0.12)" />
      <rect x="11" y="216" width="24.5" height="2.6" rx="1.3" fill={ink.lilac} />

      {/* KPI tiles */}
      {KPIS.map((kpi, i) => {
        const x = 66 + i * 72;
        const y = 31;
        const spark = kpi.spark
          .map((v, j) => `${(x + 42 + j * (16 / (kpi.spark.length - 1))).toFixed(1)},${(y + 37 - v * 9).toFixed(1)}`)
          .join(' ');
        return (
          <g key={kpi.label}>
            <rect
              x={x}
              y={y}
              width="64"
              height="42"
              rx="6"
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.7"
            />
            <text x={x + 7} y={y + 11} fontSize="5.6" fill={ink.muted}>
              {kpi.label}
            </text>
            <text x={x + 7} y={y + 25} fontSize="10" fontWeight="700" fill="#ffffff">
              {kpi.value}
            </text>
            <text x={x + 7} y={y + 35.5} fontSize="5.2" fill={ink.green} className={styles.mono}>
              {kpi.delta}
            </text>
            <polyline
              points={spark}
              fill="none"
              stroke={ink.lilac}
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Revenue chart */}
      <rect x="66" y="81" width="208" height="147" rx="7" fill={ink.well} stroke="rgba(255,255,255,0.08)" />
      <text x="74" y="95" fontSize="6.8" fontWeight="600" fill={ink.text}>
        Revenue
      </text>
      <circle cx="252" cy="93" r="2" fill={ink.lilac} />
      <text x="266" y="95" textAnchor="end" fontSize="5.4" fill={ink.muted} className={styles.mono}>
        MRR
      </text>
      {[108, 132, 156, 180, 204].map((y) => (
        <line
          key={y}
          x1={PLOT.left}
          x2={PLOT.right}
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray="2 3"
        />
      ))}
      <path d={area} fill="url(#prj-saas-area)" className={styles.areaIn} />
      <path
        d={line}
        pathLength={100}
        fill="none"
        stroke="url(#prj-saas-line)"
        strokeWidth="1.7"
        strokeLinecap="round"
        className={styles.draw}
        data-motion="trace"
      />
      <line
        x1={PLOT.right}
        x2={PLOT.right}
        y1={lastY + 6}
        y2={PLOT.bottom}
        stroke="rgba(196,181,253,0.4)"
        strokeDasharray="2 2"
      />
      <circle cx={PLOT.right} cy={lastY} r="5.5" fill="none" stroke={ink.lilac} strokeWidth="0.8" className={styles.ping} />
      <circle cx={PLOT.right} cy={lastY} r="2.8" fill="#ffffff" stroke={ink.deep} strokeWidth="1.2" />
      <rect x="222" y={lastY - 21} width="36" height="13" rx="4" fill="rgba(255,255,255,0.94)" />
      <text x="240" y={lastY - 12.3} textAnchor="middle" fontSize="6" fontWeight="700" fill={ink.night}>
        $48.2k
      </text>
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
        <text key={q} x={92 + i * 48} y="218" fontSize="5.2" fill={ink.muted} className={styles.mono}>
          {q}
        </text>
      ))}
    </PanelSvg>
  );
}

const TENANTS: { name: string; plan: string; usage: number; color: string; warn?: boolean }[] = [
  { name: 'Northwind', plan: 'Enterprise', usage: 0.82, color: '#c4b5fd' },
  { name: 'Globex', plan: 'Scale', usage: 0.64, color: '#f0abfc' },
  { name: 'Initech', plan: 'Team', usage: 0.45, color: '#93c5fd' },
  { name: 'Vandelay', plan: 'Scale', usage: 0.71, color: '#fcd34d', warn: true },
  { name: 'Hooli', plan: 'Starter', usage: 0.28, color: '#86efac' },
];

function Tenants() {
  return (
    <PanelSvg size={SIDE}>
      <defs>
        <linearGradient id="prj-saas-usage" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <PanelHeader width={SIDE.w} title="tenants">
        <text x="149" y="14.5" textAnchor="end" fontSize="5.4" fill={ink.lilac} className={styles.mono}>
          312 active
        </text>
      </PanelHeader>

      <g fontSize="4.8" fill={ink.muted} letterSpacing="0.1em" className={styles.mono}>
        <text x="10" y="36">
          TENANT
        </text>
        <text x="88" y="36">
          USAGE
        </text>
      </g>

      {TENANTS.map((tenant, i) => {
        const y = 52 + i * 25.5;
        return (
          <g key={tenant.name}>
            <circle cx="17" cy={y} r="7" fill={tenant.color} opacity="0.92" />
            <text x="17" y={y + 2.2} textAnchor="middle" fontSize="6.4" fontWeight="700" fill={ink.night}>
              {tenant.name.charAt(0)}
            </text>
            <text x="29" y={y - 0.8} fontSize="6.4" fontWeight="600" fill={ink.text}>
              {tenant.name}
            </text>
            <text x="29" y={y + 6.8} fontSize="5.2" fill={ink.muted}>
              {tenant.plan}
            </text>
            <rect x="88" y={y - 2} width="46" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
            <rect
              x="88"
              y={y - 2}
              width={46 * tenant.usage}
              height="4"
              rx="2"
              fill="url(#prj-saas-usage)"
              className={styles.barBreathe}
              style={vars({ '--i': i })}
            />
            {tenant.warn ? (
              <circle cx="146" cy={y} r="4.5" fill="none" stroke={ink.amber} strokeWidth="0.7" className={styles.ping} />
            ) : null}
            <circle cx="146" cy={y} r="2.4" fill={tenant.warn ? ink.amber : ink.green} />
            {i < TENANTS.length - 1 ? (
              <line x1="8" x2="150" y1={y + 12.75} y2={y + 12.75} stroke="rgba(255,255,255,0.06)" />
            ) : null}
          </g>
        );
      })}

      <rect
        x="8"
        y="180"
        width="142"
        height="17"
        rx="6"
        fill="rgba(139,92,246,0.12)"
        stroke="rgba(196,181,253,0.45)"
        strokeWidth="0.6"
        strokeDasharray="2.5 2"
      />
      <text x="79" y="190.6" textAnchor="middle" fontSize="6" fill={ink.lilac}>
        + invite tenant
      </text>
    </PanelSvg>
  );
}

const MEMBERS: { role: string; color: string; name: number; mail: number; tone: 'owner' | 'admin' | 'plain' }[] = [
  { role: 'owner', color: '#c4b5fd', name: 48, mail: 34, tone: 'owner' },
  { role: 'admin', color: '#f0abfc', name: 40, mail: 30, tone: 'admin' },
  { role: 'member', color: '#93c5fd', name: 54, mail: 38, tone: 'plain' },
  { role: 'viewer', color: '#86efac', name: 36, mail: 26, tone: 'plain' },
];

const CHIP = {
  owner: { fill: 'rgba(139,92,246,0.4)', stroke: 'rgba(196,181,253,0.5)', text: ink.text },
  admin: { fill: 'rgba(240,171,252,0.2)', stroke: 'rgba(240,171,252,0.45)', text: ink.text },
  plain: { fill: 'rgba(255,255,255,0.07)', stroke: 'rgba(255,255,255,0.12)', text: ink.soft },
};

function Roles() {
  return (
    <PanelSvg size={BACK}>
      <defs>
        <linearGradient id="prj-saas-toggle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#b79dff" />
        </linearGradient>
      </defs>
      <PanelHeader width={BACK.w} title="roles">
        <text x="146" y="14.5" textAnchor="end" fontSize="5.6" fill={ink.lilac} className={styles.mono}>
          RBAC
        </text>
      </PanelHeader>

      {MEMBERS.map((member, i) => {
        const y = 41 + i * 21;
        const chip = CHIP[member.tone];
        return (
          <g key={member.role}>
            <circle cx="16" cy={y} r="6" fill={member.color} opacity="0.85" />
            <rect x="27" y={y - 4.2} width={member.name} height="3.4" rx="1.7" fill="rgba(255,255,255,0.4)" />
            <rect x="27" y={y + 1.6} width={member.mail} height="2.6" rx="1.3" fill="rgba(255,255,255,0.16)" />
            <rect
              x="106"
              y={y - 5.5}
              width="40"
              height="11"
              rx="5.5"
              fill={chip.fill}
              stroke={chip.stroke}
              strokeWidth="0.6"
            />
            <text x="126" y={y + 2} textAnchor="middle" fontSize="5.4" fill={chip.text} className={styles.mono}>
              {member.role}
            </text>
          </g>
        );
      })}

      <text x="10" y="130" fontSize="4.8" fill={ink.muted} letterSpacing="0.12em" className={styles.mono}>
        PERMISSIONS
      </text>
      <text x="10" y="143" fontSize="5.8" fill={ink.text} className={styles.mono}>
        billing:write
      </text>
      <rect x="124" y="135.5" width="18" height="9" rx="4.5" fill="url(#prj-saas-toggle)" />
      <circle cx="137.5" cy="140" r="3.3" fill="#ffffff" />

      <text x="10" y="159" fontSize="5.8" fill={ink.text} className={styles.mono}>
        tenants:delete
      </text>
      <rect x="124" y="151.5" width="18" height="9" rx="4.5" fill="rgba(255,255,255,0.14)" />
      <rect x="124" y="151.5" width="18" height="9" rx="4.5" fill="url(#prj-saas-toggle)" className={styles.toggleOn} />
      <circle cx="137.5" cy="156" r="3.3" fill="#ffffff" className={styles.toggleKnob} />

      <rect
        x="8"
        y="172"
        width="140"
        height="16"
        rx="8"
        fill="rgba(74,222,128,0.1)"
        stroke="rgba(74,222,128,0.4)"
        strokeWidth="0.6"
      />
      <circle cx="17" cy="180" r="4" fill="rgba(74,222,128,0.25)" />
      <path
        d="M15.2 180.1 L16.5 181.4 L18.9 178.8"
        fill="none"
        stroke={ink.green}
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="25" y="182.2" fontSize="5.6" fill={ink.mint} className={styles.mono}>
        invoice.paid
      </text>
      <text x="142" y="182.2" textAnchor="end" fontSize="5.6" fill={ink.text} className={styles.mono}>
        $1,240
      </text>
    </PanelSvg>
  );
}

export function saasArt(): PanelArt {
  return { back: <Roles />, main: <Dashboard />, side: <Tenants /> };
}
