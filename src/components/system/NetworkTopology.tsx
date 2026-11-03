'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { PacketLayer } from '@/components/system/PacketLayer';
import {
  NODE_GEOMETRY,
  getLayout,
  strokeForWeight,
  type LaidOutNode,
  type Projection,
  type TopologyLayout,
} from '@/components/system/topologyLayout';
import { useStage } from '@/components/system/useStage';
import type { BusState } from '@/components/system/useEventBus';
import { domains } from '@/data/domains';
import { domainHref } from '@/data/site';
import { cn } from '@/lib/utils';
import type { DomainId } from '@/lib/types';

interface NetworkTopologyProps {
  bus: BusState;
  className?: string;
}

/**
 * The hero element: an interactive map of the engineering network.
 *
 * It is a real navigation surface, not a decoration — every node is an anchor
 * with a genuine href, so it renders in the initial HTML, works without
 * JavaScript, and is reachable by keyboard. Animation, parallax and the live
 * event pulses are enhancements layered on top of that.
 *
 * Both projections are rendered and toggled with CSS breakpoints. That avoids
 * a JS media query (and the hydration mismatch and layout shift that come with
 * one), and a `display: none` subtree runs no animations, so the hidden one is
 * free.
 */
export function NetworkTopology({ bus, className }: NetworkTopologyProps) {
  return (
    <div className={className}>
      <div className="hidden md:block">
        <TopologyStage projection="radial" bus={bus} />
      </div>
      <div className="md:hidden">
        <TopologyStage projection="spine" bus={bus} />
      </div>
    </div>
  );
}

/* ──────────────────────────────── Stage ──────────────────────────────────── */

function TopologyStage({ projection, bus }: { projection: Projection; bus: BusState }) {
  const layout = getLayout(projection);
  const router = useRouter();
  const { ref, scale, onPointerMove, onPointerLeave } = useStage<HTMLDivElement>(layout.box.width);
  const [activeNode, setActiveNode] = useState<DomainId | null>(null);

  const navigate = useCallback(
    (event: React.MouseEvent, id: DomainId) => {
      // Let modified clicks and middle clicks behave like normal links.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      router.push(domainHref(id));
    },
    [router],
  );

  const activeLinkIds = new Set(
    activeNode
      ? layout.links
          .filter((link) => link.from === activeNode || link.to === activeNode)
          .map((link) => link.id)
      : [],
  );

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        onPointerLeave();
        setActiveNode(null);
      }}
      className="relative w-full"
      style={{ aspectRatio: `${layout.box.width} / ${layout.box.height}` }}
    >
      <svg
        viewBox={`0 0 ${layout.box.width} ${layout.box.height}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="group"
        aria-label="Engineering network map. Each node links to an engineering area."
      >
        <defs>
          <radialGradient id={`core-glow-${projection}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <LinkLayer layout={layout} bus={bus} activeLinkIds={activeLinkIds} />

        {layout.nodes.map((laidOut) =>
          laidOut.node.kind === 'core' ? (
            <CoreNode
              key={laidOut.node.id}
              laidOut={laidOut}
              projection={projection}
              pulse={bus.pulses[laidOut.node.id] ?? 0}
              active={activeNode === laidOut.node.id}
              dimmed={activeNode !== null && activeNode !== laidOut.node.id}
              onActivate={setActiveNode}
              onNavigate={navigate}
            />
          ) : (
            <DomainNode
              key={laidOut.node.id}
              laidOut={laidOut}
              projection={projection}
              pulse={bus.pulses[laidOut.node.id] ?? 0}
              active={activeNode === laidOut.node.id}
              dimmed={activeNode !== null && activeNode !== laidOut.node.id}
              onActivate={setActiveNode}
              onNavigate={navigate}
            />
          ),
        )}
      </svg>

      {scale > 0 ? (
        <PacketLayer
          links={layout.links}
          box={layout.box}
          scale={scale}
          activeNode={activeNode}
          seed={`packets-${projection}`}
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────── Links ──────────────────────────────────── */

function LinkLayer({
  layout,
  bus,
  activeLinkIds,
}: {
  layout: TopologyLayout;
  bus: BusState;
  activeLinkIds: Set<string>;
}) {
  return (
    <g>
      {layout.links.map((link) => {
        const hot = activeLinkIds.has(link.id);
        const burst = bus.linkBursts[layout.linkForEvent(link.id, link.to)] ?? 0;
        return (
          <g key={link.id}>
            <path
              d={link.d}
              fill="none"
              stroke={hot ? 'var(--color-accent)' : 'var(--color-line-strong)'}
              strokeWidth={strokeForWeight(link.weight)}
              strokeDasharray={link.kind === 'event' ? '3 5' : undefined}
              className="transition-[stroke,opacity] duration-300"
              opacity={hot ? 0.95 : activeLinkIds.size > 0 ? 0.32 : 0.62}
            />
            {/* Traffic burst: a short brightening of the link when an event
                travels it. Keyed by the event counter so each one retriggers. */}
            {burst > 0 ? (
              <path
                key={burst}
                d={link.d}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={strokeForWeight(link.weight) + 0.5}
                strokeDasharray={link.length}
                strokeLinecap="round"
                data-motion="trace"
                style={{
                  ['--trace-length' as string]: String(link.length),
                  animation: 'link-trace 900ms cubic-bezier(0.16,1,0.3,1) forwards',
                  opacity: 0.5,
                }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/* ──────────────────────────────── Nodes ──────────────────────────────────── */

interface NodeProps {
  laidOut: LaidOutNode;
  projection: Projection;
  pulse: number;
  active: boolean;
  dimmed: boolean;
  onActivate: (id: DomainId | null) => void;
  onNavigate: (event: React.MouseEvent, id: DomainId) => void;
}

/** Parallax transform. One style write per frame drives every node. */
function parallax(depth: number): React.CSSProperties {
  return {
    transform: `translate(calc(var(--px, 0) * ${(depth * 12).toFixed(1)}px), calc(var(--py, 0) * ${(
      depth * 8
    ).toFixed(1)}px))`,
    transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
  };
}

/**
 * Motion primitive 2 — pulse. Rendered as a sibling of the node's `<a>`, never
 * inside it: an animated child inflates the anchor's bounding box, which moves
 * the link's hit target and focus ring while the pulse plays.
 *
 * `transform-box: fill-box` is required. SVG elements default to
 * `transform-box: view-box`, where `transform-origin: center` means the centre
 * of the whole viewBox — so the ring would scale from the middle of the diagram
 * instead of from the node.
 */
function PulseRing({ pulse, radius, cx, cy }: { pulse: number; radius: number; cx: number; cy: number }) {
  if (pulse === 0) return null;
  return (
    <circle
      key={pulse}
      cx={cx}
      cy={cy}
      r={radius}
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={1}
      pointerEvents="none"
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'center',
        animation: 'node-pulse 1100ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    />
  );
}

function CoreNode({
  laidOut,
  projection,
  pulse,
  active,
  dimmed,
  onActivate,
  onNavigate,
}: NodeProps) {
  const { node, point, label } = laidOut;
  const domain = domains[node.id];
  const width = NODE_GEOMETRY.coreWidth;
  const height = NODE_GEOMETRY.coreHeight;
  const x = projection === 'spine' ? point.x - 20 : point.x - width / 2;
  const y = point.y - height / 2;

  return (
    <g style={parallax(node.depth)} opacity={dimmed ? 0.45 : 1} className="transition-opacity duration-300">
      {/* Decoration first, outside the anchor — see PulseRing. The explicit
          px transform-origin is correct here because SVG resolves transforms
          against the viewBox by default. */}
      <ellipse
        cx={point.x}
        cy={point.y}
        rx={width * 0.95}
        ry={height * 1.15}
        fill={`url(#core-glow-${projection})`}
        className="animate-core-breathe"
        pointerEvents="none"
        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
      />
      <PulseRing
        pulse={pulse}
        radius={NODE_GEOMETRY.coreGap * 0.6}
        cx={point.x}
        cy={point.y}
      />
      <a
        href={domainHref(node.id)}
        onClick={(event) => onNavigate(event, node.id)}
        onMouseEnter={() => onActivate(node.id)}
        onFocus={() => onActivate(node.id)}
        onBlur={() => onActivate(null)}
        className="cursor-pointer outline-none"
        aria-label={`${domain.title}: ${domain.tagline}`}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="var(--color-panel)"
          stroke={active ? 'var(--color-accent)' : 'var(--color-line-strong)'}
          strokeWidth={1}
          className="transition-[stroke] duration-300"
        />
        {/* Corner brackets, matching the Panel primitive. */}
        {[
          [x, y, 1, 1],
          [x + width, y, -1, 1],
          [x, y + height, 1, -1],
          [x + width, y + height, -1, -1],
        ].map(([cx, cy, sx, sy], index) => (
          <path
            key={index}
            d={`M ${cx! + sx! * 9} ${cy} L ${cx} ${cy} L ${cx} ${cy! + sy! * 9}`}
            fill="none"
            stroke={active ? 'var(--color-accent)' : 'var(--color-muted)'}
            strokeWidth={1}
            className="transition-[stroke] duration-300"
          />
        ))}
        <text
          x={projection === 'spine' ? x + 18 : label.x}
          y={label.y}
          textAnchor={projection === 'spine' ? 'start' : 'middle'}
          className="fill-primary font-sans"
          style={{ fontSize: 17, letterSpacing: '-0.02em', fontWeight: 500 }}
        >
          {domain.title}
        </text>
        <text
          x={projection === 'spine' ? x + 18 : label.x}
          y={label.y + label.subY}
          textAnchor={projection === 'spine' ? 'start' : 'middle'}
          className="fill-muted font-mono"
          style={{ fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          CORE
        </text>
      </a>
    </g>
  );
}

function DomainNode({
  laidOut,
  projection,
  pulse,
  active,
  dimmed,
  onActivate,
  onNavigate,
}: NodeProps) {
  const { node, point, label } = laidOut;
  const domain = domains[node.id];
  const isSpine = projection === 'spine';

  return (
    <g
      style={parallax(node.depth)}
      opacity={dimmed ? 0.42 : 1}
      className="transition-opacity duration-300"
    >
      <PulseRing
        pulse={pulse}
        radius={NODE_GEOMETRY.domainRing}
        cx={point.x}
        cy={point.y}
      />
      <a
        href={domainHref(node.id)}
        onClick={(event) => onNavigate(event, node.id)}
        onMouseEnter={() => onActivate(node.id)}
        onFocus={() => onActivate(node.id)}
        onBlur={() => onActivate(null)}
        className="cursor-pointer outline-none"
        aria-label={`${domain.title}: ${domain.tagline}`}
      >
        {/* Generous transparent hit area. On the spine projection it covers the
            label too, so the whole row is a 44px+ touch target. */}
        {isSpine ? (
          <rect
            x={point.x - 30}
            y={point.y - 26}
            width={300}
            height={60}
            fill="transparent"
            pointerEvents="all"
          />
        ) : (
          <circle cx={point.x} cy={point.y} r={46} fill="transparent" pointerEvents="all" />
        )}

        <g transform={`translate(${point.x} ${point.y})`}>
          <circle
            r={NODE_GEOMETRY.domainRing}
            fill="var(--color-void)"
            stroke={active ? 'var(--color-accent)' : 'var(--color-line-strong)'}
            strokeWidth={1}
            className="transition-[stroke] duration-300"
          />
          <circle
            r={active ? NODE_GEOMETRY.domainDot + 1.5 : NODE_GEOMETRY.domainDot}
            fill={active ? 'var(--color-accent-bright)' : 'var(--color-accent)'}
            className="transition-all duration-300"
          />
        </g>

        <text
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          className={cn('font-sans transition-colors duration-300', active ? 'fill-accent' : 'fill-primary')}
          style={{
            fontSize: isSpine ? 15 : 13.5,
            letterSpacing: '-0.01em',
            fontWeight: 500,
          }}
        >
          {domain.title}
        </text>
        <text
          x={label.x}
          y={label.y + label.subY}
          textAnchor={label.anchor}
          className="fill-muted font-mono"
          style={{ fontSize: isSpine ? 9 : 8, letterSpacing: '0.2em' }}
        >
          {node.id.toUpperCase()}
        </text>
      </a>
    </g>
  );
}
