import type { ArchitectureSpec } from '@/lib/types';

interface MiniArchitectureProps {
  spec: ArchitectureSpec;
  className?: string;
}

const BOX = { width: 320, rowHeight: 30, gap: 16, padding: 10 } as const;

/**
 * Compact, static architecture preview for project cards.
 *
 * Pure SVG with no client JavaScript: a card grid renders a dozen of these with
 * zero runtime cost, and they communicate the shape of each system at a glance
 * — which is what makes the index read as engineering proof rather than a list
 * of titles.
 */
export function MiniArchitecture({ spec, className }: MiniArchitectureProps) {
  const layers = spec.layers.slice(0, 4);
  const height = BOX.padding * 2 + layers.length * BOX.rowHeight + (layers.length - 1) * BOX.gap;
  const usable = BOX.width - BOX.padding * 2;

  return (
    <svg
      viewBox={`0 0 ${BOX.width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {layers.map((layer, layerIndex) => {
        const y = BOX.padding + layerIndex * (BOX.rowHeight + BOX.gap);
        const count = Math.max(1, Math.min(4, layer.nodes.length));
        const width = (usable - 8 * (count - 1)) / count;

        return (
          <g key={layer.label}>
            {layerIndex > 0 ? (
              <line
                x1={BOX.width / 2}
                y1={y - BOX.gap}
                x2={BOX.width / 2}
                y2={y}
                stroke="var(--color-line-strong)"
                strokeWidth={0.8}
              />
            ) : null}

            {layer.nodes.slice(0, 4).map((node, nodeIndex) => {
              const x = BOX.padding + nodeIndex * (width + 8);
              const accent = node.tone === 'accent';
              return (
                <g key={node.id}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={BOX.rowHeight}
                    fill={accent ? 'var(--color-accent-dim)' : 'var(--color-elevated)'}
                    stroke={accent ? 'var(--color-accent)' : 'var(--color-line)'}
                    strokeWidth={0.8}
                    opacity={accent ? 0.95 : 0.8}
                  />
                  <text
                    x={x + width / 2}
                    y={y + BOX.rowHeight / 2 + 3}
                    textAnchor="middle"
                    className={accent ? 'fill-accent' : 'fill-muted'}
                    style={{ fontSize: 7.5, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}
                  >
                    {node.label.toUpperCase().slice(0, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
