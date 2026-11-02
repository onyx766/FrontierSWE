'use client';

import Link from 'next/link';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { NetworkTopology } from '@/components/system/NetworkTopology';
import { SystemFeed } from '@/components/system/SystemFeed';
import { useEventBus } from '@/components/system/useEventBus';
import { domainList } from '@/data/domains';
import { domainHref } from '@/data/site';
import { topologyLinks, topologyNodes } from '@/data/domains';
import { useActiveWhenVisible } from '@/hooks/useActiveWhenVisible';

/**
 * Wires the three live pieces together: one event bus feeding both the
 * topology and the feed, gated on a single on-screen + tab-visible signal so
 * nothing animates or ticks when it is not being looked at.
 */
export function SystemSection() {
  const { ref, active } = useActiveWhenVisible<HTMLDivElement>();
  const bus = useEventBus(active);

  return (
    <div ref={ref} id="topology" className="scroll-mt-24">
      <div className="hairline-top relative flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 pt-6">
        <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-accent" />
        <MonoLabel>Network topology</MonoLabel>
        <MonoLabel tone="faint" size="sm">
          {topologyNodes.length} nodes / {topologyLinks.length} links · click a node to enter
        </MonoLabel>
      </div>

      <NetworkTopology bus={bus} className="mt-6 md:mt-2" />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
        <SystemFeed events={bus.events} />

        <nav aria-label="Engineering areas" className="border border-line bg-panel/60">
          <div className="border-b border-line px-4 py-3">
            <MonoLabel>Node index</MonoLabel>
          </div>
          <ul className="divide-y divide-line-faint">
            {domainList.map((domain) => (
              <li key={domain.id}>
                <Link
                  href={domainHref(domain.id)}
                  className="group flex items-baseline justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-elevated"
                >
                  <span className="text-sm text-primary transition-colors group-hover:text-accent">
                    {domain.title}
                  </span>
                  <span className="label-mono-sm shrink-0 text-faint transition-colors group-hover:text-muted">
                    {domain.id}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
