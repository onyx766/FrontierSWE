import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import a from './ProjectsArchive.module.css';

/**
 * Generic illustrations for the open-source PHP work: an ERP ledger and a
 * Kanban board. Deliberately unbranded, since the products are not Onyx's.
 * Decorative only; the text beside them carries the content.
 */

const LEDGER: { ref: string; party: string; amount: string; state: 'paid' | 'due' | 'draft' }[] = [
  { ref: 'INV-2041', party: 'Northwind Ltd', amount: '4,280.00', state: 'paid' },
  { ref: 'INV-2042', party: 'Acme Supply', amount: '1,960.50', state: 'due' },
  { ref: 'PRO-0318', party: 'Blue Harbor', amount: '7,400.00', state: 'draft' },
  { ref: 'INV-2043', party: 'Kestrel & Co', amount: '820.00', state: 'paid' },
  { ref: 'ORD-0977', party: 'Halcyon Labs', amount: '3,115.75', state: 'due' },
];

const MODULES = ['Third parties', 'Proposals', 'Orders', 'Invoices', 'Stock', 'Projects'];

export function LedgerArt() {
  return (
    <div className={a.mock} aria-hidden="true">
      <div className={a.mockBar}>
        <span className={a.mockDots}>
          <i />
          <i />
          <i />
        </span>
        <span className={a.mockTitle}>erp · invoices</span>
        <span className={a.mockPhp}>&lt;?php</span>
      </div>
      <div className={a.ledger}>
        <ul className={a.ledgerNav}>
          {MODULES.map((item) => (
            <li key={item} data-active={item === 'Invoices' ? '' : undefined}>
              {item}
            </li>
          ))}
        </ul>
        <div className={a.ledgerMain}>
          <div className={a.ledgerKpis}>
            <span>
              <b>12</b> due
            </span>
            <span>
              <b>38</b> paid
            </span>
            <span>
              <b>5</b> drafts
            </span>
          </div>
          <ul className={a.ledgerRows}>
            {LEDGER.map((row, i) => (
              <li key={row.ref} style={{ '--i': i } as CSSProperties}>
                <span className={a.ledgerRef}>{row.ref}</span>
                <span className={a.ledgerParty}>{row.party}</span>
                <span className={a.ledgerAmount}>{row.amount}</span>
                <span className={a.ledgerState} data-state={row.state}>
                  {row.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const COLUMNS: { name: string; cards: { title: string; tag: string }[] }[] = [
  {
    name: 'Backlog',
    cards: [
      { title: 'Webhook retries', tag: 'api' },
      { title: 'Export to CSV', tag: 'plugin' },
    ],
  },
  {
    name: 'In progress',
    cards: [
      { title: 'Swimlane filter', tag: 'ui' },
      { title: 'Auto-assign', tag: 'action' },
    ],
  },
  {
    name: 'Done',
    cards: [
      { title: 'JSON-RPC token', tag: 'api' },
      { title: 'Due-date alerts', tag: 'notify' },
    ],
  },
];

export function KanbanArt() {
  return (
    <div className={a.mock} aria-hidden="true">
      <div className={a.mockBar}>
        <span className={a.mockDots}>
          <i />
          <i />
          <i />
        </span>
        <span className={a.mockTitle}>board · sprint 14</span>
        <span className={a.mockPhp}>&lt;?php</span>
      </div>
      <div className={a.kanban}>
        {COLUMNS.map((column, c) => (
          <div key={column.name} className={a.kanbanCol}>
            <p className={a.kanbanHead}>
              {column.name}
              <span>{column.cards.length + (c === 2 ? 1 : 0)}</span>
            </p>
            {column.cards.map((card) => (
              <div key={card.title} className={a.kanbanCard}>
                <span className={a.kanbanTag}>{card.tag}</span>
                {card.title}
              </div>
            ))}
            {/* The landing slot for the travelling card. */}
            {c === 2 ? <div className={a.kanbanSlot} /> : null}
          </div>
        ))}
        {/* One card travels from In progress to Done, on repeat. */}
        <div className={cn(a.kanbanCard, a.kanbanMover)}>
          <span className={a.kanbanTag}>plugin</span>
          Permissions
        </div>
      </div>
    </div>
  );
}
