'use client';

// Framer Motion is used here and nowhere else in the global bundle: animating
// an SVG circle's cx/cy between arbitrary points is exactly the job it is good
// at, and this component only ships on project pages. Simple scroll reveals
// use CSS instead — see components/primitives/Reveal.tsx.
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { ActionButton } from '@/components/primitives/Button';
import {
  layoutArchitecture,
  stepDuration,
  type PlacedNode,
} from '@/components/system/architectureLayout';
import { useActiveWhenVisible } from '@/hooks/useActiveWhenVisible';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn, formatLatency } from '@/lib/utils';
import type { ArchitectureSpec } from '@/lib/types';

interface ArchitectureDiagramProps {
  spec: ArchitectureSpec;
  className?: string;
  /** Hides the trace controls — used for the compact previews on cards. */
  compact?: boolean;
  label?: string;
}

/**
 * Interactive architecture diagram.
 *
 * The diagram itself is static SVG laid out from data, so it is server-rendered
 * and readable with no JavaScript. On top of that, a request can be traced
 * through the system: a packet travels the real edge paths, each node lights as
 * it is reached, and a latency readout accumulates — which turns a static
 * boxes-and-arrows picture into an explanation of how a request actually flows.
 *
 * Under `prefers-reduced-motion` the trace resolves instantly to its final
 * state: every step highlighted, total latency shown, no movement.
 */
export function ArchitectureDiagram({
  spec,
  className,
  compact = false,
  label = 'System architecture',
}: ArchitectureDiagramProps) {
  const layout = useMemo(
    () => layoutArchitecture(spec.layers, spec.edges),
    [spec.layers, spec.edges],
  );

  const paths = spec.paths;
  const [pathIndex, setPathIndex] = useState(0);
  const activePath = paths[pathIndex];

  const { ref, active } = useActiveWhenVisible<HTMLDivElement>();
  const reduced = useReducedMotion();

  // -1 = not started. Otherwise the index of the step currently reached.
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, []);

  const play = useCallback(() => {
    if (!activePath) return;
    stop();

    if (reduced) {
      setStep(activePath.steps.length - 1);
      return;
    }

    setStep(0);
    setRunning(true);

    let index = 0;
    const advance = () => {
      index += 1;
      if (!activePath.steps[index]) {
        setRunning(false);
        return;
      }
      setStep(index);
      timerRef.current = setTimeout(advance, stepDuration(activePath.latencies[index] ?? 120));
    };

    timerRef.current = setTimeout(advance, stepDuration(activePath.latencies[0] ?? 120));
  }, [activePath, reduced, stop]);

  // Autoplay once, when the diagram first comes into view.
  useEffect(() => {
    if (!active || playedRef.current || !activePath) return;
    playedRef.current = true;
    play();
  }, [active, activePath, play]);

  // Stop the timer if the diagram leaves the screen or the tab is hidden.
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => stop, [stop]);

  const reachedIds = useMemo(() => {
    if (!activePath || step < 0) return new Set<string>();
    return new Set(activePath.steps.slice(0, step + 1));
  }, [activePath, step]);

  const currentNode: PlacedNode | undefined = activePath?.steps[step]
    ? layout.nodeById.get(activePath.steps[step]!)
    : undefined;

  const cumulativeLatency = useMemo(() => {
    if (!activePath || step < 0) return 0;
    return activePath.latencies.slice(0, step + 1).reduce((total, value) => total + value, 0);
  }, [activePath, step]);

  const traceEdgeIds = useMemo(() => {
    if (!activePath) return new Set<string>();
    const ids = new Set<string>();
    for (let index = 0; index < Math.max(0, step); index += 1) {
      ids.add(`${activePath.steps[index]}->${activePath.steps[index + 1]}`);
      ids.add(`${activePath.steps[index + 1]}->${activePath.steps[index]}`);
    }
    return ids;
  }, [activePath, step]);

  return (
    <div ref={ref} className={cn('border border-line bg-panel/50', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <MonoLabel>{label}</MonoLabel>

        {!compact && activePath ? (
          <div className="flex flex-wrap items-center gap-2">
            {paths.length > 1 ? (
              <div className="flex items-center gap-1">
                {paths.map((path, index) => (
                  <button
                    key={path.label}
                    type="button"
                    onClick={() => {
                      stop();
                      setPathIndex(index);
                      setStep(-1);
                    }}
                    className={cn(
                      'border px-2.5 py-1.5 font-mono text-[0.5625rem] tracking-[0.14em] uppercase transition-colors',
                      index === pathIndex
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-line text-muted hover:border-line-strong hover:text-body',
                    )}
                  >
                    {path.label}
                  </button>
                ))}
              </div>
            ) : null}

            <span className="flex items-center gap-2 border border-line px-2.5 py-1.5">
              <MonoLabel size="sm" tone="faint">
                Latency
              </MonoLabel>
              <span className="font-mono text-[0.625rem] text-accent tabular-nums">
                {formatLatency(step < 0 ? 0 : cumulativeLatency)}
              </span>
            </span>

            <ActionButton size="sm" onClick={play} brackets={false} disabled={running}>
              {running ? 'Tracing…' : 'Replay request'}
            </ActionButton>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto px-2 py-3 md:px-4">
        <svg
          viewBox={`0 0 ${layout.box.width} ${layout.box.height}`}
          className="h-auto w-full min-w-[34rem]"
          role="img"
          aria-label={`${label}. Layers: ${spec.layers
            .map((layer) => `${layer.label} — ${layer.nodes.map((node) => node.label).join(', ')}`)
            .join('. ')}.`}
        >
          {/* Layer rails */}
          {layout.layers.map((layer) => (
            <g key={layer.label}>
              <line
                x1={0}
                y1={layer.y - 18}
                x2={layout.box.width}
                y2={layer.y - 18}
                stroke="var(--color-line-faint)"
                strokeWidth={1}
              />
              <text
                x={0}
                y={layer.y + 4}
                className="fill-faint font-mono"
                style={{ fontSize: 8.5, letterSpacing: '0.2em' }}
              >
                {layer.label.toUpperCase()}
              </text>
            </g>
          ))}

          {/* Edges */}
          {layout.edges.map((edge) => {
            const hot = traceEdgeIds.has(edge.id);
            return (
              <g key={edge.id}>
                <path
                  d={edge.d}
                  fill="none"
                  stroke={hot ? 'var(--color-accent)' : 'var(--color-line-strong)'}
                  strokeWidth={hot ? 1.3 : 0.9}
                  className="transition-[stroke,stroke-width] duration-300"
                  markerEnd="url(#arch-arrow)"
                />
                {edge.label ? (
                  <text
                    x={edge.mid.x}
                    y={edge.mid.y}
                    className="fill-faint font-mono"
                    style={{ fontSize: 7.5, letterSpacing: '0.12em' }}
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--color-line-strong)" />
            </marker>
          </defs>

          {/* Nodes */}
          {layout.nodes.map((node) => {
            const reached = reachedIds.has(node.id);
            const isCurrent = currentNode?.id === node.id;
            const accent = node.tone === 'accent';

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={reached ? 'var(--color-elevated)' : 'var(--color-panel)'}
                  stroke={
                    isCurrent
                      ? 'var(--color-accent-bright)'
                      : reached || accent
                        ? 'var(--color-accent)'
                        : 'var(--color-line-strong)'
                  }
                  strokeWidth={isCurrent ? 1.4 : 1}
                  className="transition-[fill,stroke] duration-300"
                />
                <text
                  x={node.x + 12}
                  y={node.y + (node.detail ? 24 : 33)}
                  className={cn(
                    'font-sans transition-colors duration-300',
                    reached || accent ? 'fill-primary' : 'fill-body',
                  )}
                  style={{ fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em' }}
                >
                  {node.label}
                </text>
                {node.detail ? (
                  <text
                    x={node.x + 12}
                    y={node.y + 40}
                    className="fill-muted font-mono"
                    style={{ fontSize: 8, letterSpacing: '0.12em' }}
                  >
                    {node.detail.toUpperCase()}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* The traced request */}
          {currentNode && !reduced ? (
            <motion.circle
              r={4}
              fill="var(--color-accent-bright)"
              initial={false}
              animate={{ cx: currentNode.center.x, cy: currentNode.center.y }}
              transition={{
                duration: stepDuration(activePath?.latencies[step] ?? 120) / 1000,
                ease: [0.4, 0, 0.2, 1],
              }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(94,240,168,0.7))' }}
            />
          ) : null}
        </svg>
      </div>

      {!compact && activePath ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-4 py-2.5">
          <MonoLabel size="sm" tone="faint">
            Path
          </MonoLabel>
          {activePath.steps.map((stepId, index) => {
            const node = layout.nodeById.get(stepId);
            return (
              <span key={`${stepId}-${index}`} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-faint">
                    →
                  </span>
                ) : null}
                <span
                  className={cn(
                    'font-mono text-[0.5625rem] tracking-[0.14em] uppercase transition-colors',
                    index <= step ? 'text-accent' : 'text-muted',
                  )}
                >
                  {node?.label ?? stepId}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
