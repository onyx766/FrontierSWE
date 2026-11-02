'use client';

import { useEffect, useRef, useState } from 'react';
import { feedPool } from '@/data/feed';
import { createRng, hashSeed, rngBetween, rngInt } from '@/lib/rng';
import type { DomainId, FeedEvent } from '@/lib/types';

const MAX_EVENTS = 7;
const MIN_INTERVAL_MS = 900;
const MAX_INTERVAL_MS = 2200;

export interface BusState {
  /** Newest first. Empty until the first event fires after mount. */
  events: FeedEvent[];
  /** Monotonic counter per node, used as a React key to retrigger pulses. */
  pulses: Partial<Record<DomainId, number>>;
  /** Monotonic counter per link id, used to flash a link on traffic. */
  linkBursts: Record<string, number>;
}

const EMPTY: BusState = { events: [], pulses: {}, linkBursts: {} };

/**
 * The single source of truth for "the system is alive".
 *
 * One timer drives both the diagram and the live feed, so a row appearing in
 * the feed corresponds to the link that just flashed and the node that just
 * pulsed. That coherence is what makes it read as a system rather than as two
 * unrelated decorations.
 *
 * Runs only while `active` is true — the caller passes the combined
 * on-screen + tab-visible signal, so nothing ticks in a background tab.
 * Intervals are seeded, so cadence is irregular but reproducible.
 */
export function useEventBus(active: boolean, seed = 'engineering-network'): BusState {
  const [state, setState] = useState<BusState>(EMPTY);
  const rngRef = useRef<(() => number) | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    if (!rngRef.current) {
      rngRef.current = createRng(hashSeed(seed));
    }
    const rng = rngRef.current;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const emit = () => {
      if (cancelled) return;

      const template = feedPool[rngInt(rng, 0, feedPool.length - 1)];
      if (template) {
        counterRef.current += 1;
        const index = counterRef.current;

        const latencyMs =
          template.latency === null
            ? null
            : Math.round(rngBetween(rng, template.latency[0], template.latency[1]));

        // Occasional warn rows keep the feed honest-looking. Never errors:
        // a portfolio feed showing failures reads as theatre, not telemetry.
        const slow = latencyMs !== null && latencyMs > 1000;
        const event: FeedEvent = {
          id: `evt-${index}`,
          kind: template.kind,
          detail: template.detail,
          latencyMs,
          status: slow ? 'warn' : 'ok',
          linkId: template.linkId,
          targetNode: template.targetNode,
        };

        setState((previous) => ({
          events: [event, ...previous.events].slice(0, MAX_EVENTS),
          pulses: {
            ...previous.pulses,
            [event.targetNode]: (previous.pulses[event.targetNode] ?? 0) + 1,
          },
          linkBursts: {
            ...previous.linkBursts,
            [event.linkId]: (previous.linkBursts[event.linkId] ?? 0) + 1,
          },
        }));
      }

      timer = setTimeout(emit, rngBetween(rng, MIN_INTERVAL_MS, MAX_INTERVAL_MS));
    };

    // Small initial delay so the first event lands after the reveal animation.
    timer = setTimeout(emit, 700);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, seed]);

  return state;
}
