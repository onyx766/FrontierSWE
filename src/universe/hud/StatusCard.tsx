import Link from 'next/link';
import { hudCopy, statusRows } from '@/data/universe';

/** The opening status panel. Decorative status, as `statusRows` says, not a measurement. */
export function StatusCard() {
  return (
    <section className="uh-status uh-glass uh-opening" aria-labelledby="uh-status-title">
      <header className="uh-status-head">
        <h2 id="uh-status-title" className="uh-status-title">
          {hudCopy.status.title}
        </h2>
        <Link href="/#architecture" className="uh-status-link" aria-label={hudCopy.status.link}>
          <svg viewBox="0 0 12 10" aria-hidden>
            <path d="M0.6 5h1.4M3.4 5h4.2" stroke="currentColor" strokeLinecap="round" />
            <path
              d="m6.6 1.4 3.6 3.6-3.6 3.6"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </header>
      <ul className="uh-status-rows">
        {statusRows.map((row) => (
          <li key={row.label} className="uh-status-row">
            <span className="uh-status-dot" aria-hidden />
            <span className="uh-status-label">{row.label}</span>
            <span className="uh-status-leader" aria-hidden />
            <span className="uh-status-value">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
