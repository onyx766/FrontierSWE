'use client';

import { useMemo } from 'react';
import type { LaidOutLink } from '@/components/system/topologyLayout';
import { createRng, fixed, hashSeed, rngBetween } from '@/lib/rng';
import type { DomainId } from '@/lib/types';

interface PacketLayerProps {
  links: LaidOutLink[];
  box: { width: number; height: number };
  /** Rendered pixel width of the stage divided by `box.width`. */
  scale: number;
  /** Hovered or focused node — packets on its links speed up. */
  activeNode: DomainId | null;
  seed?: string;
}

interface Packet {
  key: string;
  from: DomainId;
  to: DomainId;
  d: string;
  durationMs: number;
  delayMs: number;
  size: number;
}

const PACKETS_FOR_WEIGHT: Record<1 | 2 | 3, number> = { 1: 1, 2: 1, 3: 2 };

/**
 * Motion primitive 1 — packets.
 *
 * Packets are HTML elements animated with CSS `offset-path` / `offset-distance`,
 * which the compositor handles: no JavaScript runs per frame, and a dozen of
 * them cost essentially nothing. The overlay is a fixed-size stage in the same
 * coordinate space as the SVG viewBox, scaled by a single transform — so packet
 * paths never need recomputing on resize, only that one scale value.
 *
 * `prefers-reduced-motion` removes the whole layer via the `data-motion` rule
 * in globals.css.
 */
export function PacketLayer({ links, box, scale, activeNode, seed = 'packets' }: PacketLayerProps) {
  const packets = useMemo<Packet[]>(() => {
    const rng = createRng(hashSeed(seed));
    const result: Packet[] = [];

    for (const link of links) {
      const count = PACKETS_FOR_WEIGHT[link.weight];
      for (let index = 0; index < count; index += 1) {
        // Longer links take proportionally longer, so apparent speed is even.
        const durationMs = Math.round(
          Math.min(3600, Math.max(1500, (link.length / 260) * 1000 + rngBetween(rng, -180, 180))),
        );
        result.push({
          key: `${link.id}-${index}`,
          from: link.from,
          to: link.to,
          d: link.d,
          durationMs,
          delayMs: Math.round(rngBetween(rng, 0, durationMs)),
          size: link.weight === 3 ? 3.5 : 3,
        });
      }
    }

    return result;
  }, [links, seed]);

  return (
    <div
      aria-hidden
      data-motion="packet"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: box.width, height: box.height, transform: `scale(${fixed(scale, 4)})` }}
      >
        {packets.map((packet) => {
          const hot =
            activeNode !== null && (packet.from === activeNode || packet.to === activeNode);
          return (
            <span
              key={packet.key}
              className="absolute top-0 left-0 rounded-full"
              style={{
                width: packet.size,
                height: packet.size,
                offsetPath: `path("${packet.d}")`,
                animationName: 'packet-travel',
                animationDuration: `${
                  hot ? Math.round(packet.durationMs * 0.45) : packet.durationMs
                }ms`,
                animationDelay: `-${packet.delayMs}ms`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                background: hot ? 'var(--color-accent-bright)' : 'var(--color-accent)',
                boxShadow: hot
                  ? '0 0 10px 2px rgba(94,240,168,0.5)'
                  : '0 0 6px 1px rgba(61,214,140,0.3)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
