'use client';

import { useRef } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { staticFeedRows } from '@/data/feed';
import { cn, formatClock, formatLatency } from '@/lib/utils';
import type { FeedEvent } from '@/lib/types';

interface SystemFeedProps {
  events: FeedEvent[];
  className?: string;
  /** Rows shown on small screens. The full feed is dense for a phone. */
  mobileRows?: number;
}

/**
 * The live system feed — a readout of the same event stream that drives the
 * topology, so a row here corresponds to a link that just flashed.
 *
 * Deliberately restrained: realistic, repetitive event vocabulary, muted
 * colours, one tick per row, a slow cadence. It should read as a log panel in
 * an observability tool, not as a hacking screen. It is labelled as a
 * simulated stream so it makes no claim to be real traffic.
 *
 * Before the first client event arrives — and under reduced motion — it
 * renders a static list, so the panel is never empty and the server HTML and
 * the first client render agree.
 */
export function SystemFeed({ events, className, mobileRows = 4 }: SystemFeedProps) {
  // Timestamps are captured once per event, client-side only (events are empty
  // during SSR), so nothing time-dependent is ever server-rendered.
  const clockRef = useRef(new Map<string, string>());

  const rows =
    events.length > 0
      ? events.map((event) => {
          let stamp = clockRef.current.get(event.id);
          if (!stamp) {
            stamp = formatClock(new Date());
            clockRef.current.set(event.id, stamp);
          }
          return { key: event.id, stamp, ...event };
        })
      : staticFeedRows.map((row, index) => ({
          key: `static-${index}`,
          stamp: '--:--:--',
          kind: row.kind,
          detail: row.detail,
          latencyMs: row.latencyMs,
          status: 'ok' as const,
        }));

  return (
    <div className={cn('relative border border-line bg-panel/80 backdrop-blur-[2px]', className)}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <MonoLabel>Live system feed</MonoLabel>
        <span className="flex items-center gap-2">
          <StatusDot state="ok" />
          <MonoLabel size="sm" tone="accent">
            Streaming
          </MonoLabel>
        </span>
      </div>

      <ul className="divide-y divide-line-faint font-mono text-[0.6875rem]">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 md:grid-cols-[4.5rem_7.5rem_1fr_4rem_auto] md:gap-4',
              index >= mobileRows && 'hidden md:grid',
            )}
          >
            <span className="hidden text-faint md:inline tabular-nums">{row.stamp}</span>
            <span className="text-body uppercase tracking-[0.12em] whitespace-nowrap">
              {row.kind}
            </span>
            <span className="truncate text-muted">{row.detail}</span>
            <span
              className={cn(
                'text-right tabular-nums',
                row.status === 'warn' ? 'text-warn' : 'text-muted',
              )}
            >
              {formatLatency(row.latencyMs)}
            </span>
            <span
              aria-hidden
              className={row.status === 'warn' ? 'text-warn' : 'text-accent'}
            >
              ✓
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-4 py-2.5">
        <MonoLabel size="sm" tone="faint">
          Simulated stream · illustrates the architecture above
        </MonoLabel>
      </div>
    </div>
  );
}
