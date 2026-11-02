import { MonoLabel } from '@/components/primitives/MonoLabel';
import { horizontalFlowPath } from '@/lib/geometry';
import type { Domain } from '@/lib/types';

interface DomainArchitectureProps {
  domain: Domain;
  className?: string;
}

const GRID = {
  width: 960,
  paddingX: 14,
  paddingY: 22,
  columnGap: 30,
  rowGap: 26,
  nodeHeight: 52,
  maxColumnWidth: 168,
} as const;

/**
 * Sub-architecture for a domain page: a left-to-right flow laid out from the
 * `column` / `row` coordinates in the domain data.
 *
 * Deliberately horizontal, where the project diagrams are vertical — a domain
 * describes a pipeline of capabilities, a project describes a request
 * descending through layers, and the two should not look like the same picture.
 *
 * Pure SVG in a server component: no client JavaScript, in the initial HTML,
 * and readable with a screen reader through the generated description.
 */
export function DomainArchitecture({ domain, className }: DomainArchitectureProps) {
  const { nodes, edges } = domain.subArchitecture;

  const columnCount = Math.max(...nodes.map((node) => node.column)) + 1;
  const rowCount = Math.max(...nodes.map((node) => node.row)) + 1;

  const usableWidth = GRID.width - GRID.paddingX * 2;
  const columnWidth = Math.min(
    GRID.maxColumnWidth,
    (usableWidth - GRID.columnGap * (columnCount - 1)) / columnCount,
  );
  const rowWidth = columnWidth * columnCount + GRID.columnGap * (columnCount - 1);
  const startX = GRID.paddingX + Math.max(0, (usableWidth - rowWidth) / 2);

  const height = GRID.paddingY * 2 + rowCount * GRID.nodeHeight + (rowCount - 1) * GRID.rowGap;

  const placed = nodes.map((node) => {
    const x = startX + node.column * (columnWidth + GRID.columnGap);
    const y = GRID.paddingY + node.row * (GRID.nodeHeight + GRID.rowGap);
    return {
      ...node,
      x,
      y,
      width: columnWidth,
      height: GRID.nodeHeight,
      center: { x: x + columnWidth / 2, y: y + GRID.nodeHeight / 2 },
    };
  });

  const byId = new Map(placed.map((node) => [node.id, node]));

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <MonoLabel>{domain.label} architecture</MonoLabel>
        <MonoLabel size="sm" tone="faint">
          {nodes.length} components
        </MonoLabel>
      </div>

      <div className="overflow-x-auto px-2 py-4 md:px-4">
        <svg
          viewBox={`0 0 ${GRID.width} ${height}`}
          className="h-auto w-full min-w-[36rem]"
          role="img"
          aria-label={`${domain.title} architecture: ${edges
            .map((edge) => {
              const from = byId.get(edge.from)?.label ?? edge.from;
              const to = byId.get(edge.to)?.label ?? edge.to;
              return `${from} to ${to}${edge.label ? ` (${edge.label})` : ''}`;
            })
            .join('; ')}.`}
        >
          <defs>
            <marker
              id={`domain-arrow-${domain.id}`}
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

          {edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;

            const rightward = to.center.x > from.center.x;
            const sameColumn = Math.abs(to.center.x - from.center.x) < 1;

            const start = sameColumn
              ? { x: from.center.x, y: to.center.y > from.center.y ? from.y + from.height : from.y }
              : { x: rightward ? from.x + from.width : from.x, y: from.center.y };
            const end = sameColumn
              ? { x: to.center.x, y: to.center.y > from.center.y ? to.y : to.y + to.height }
              : { x: rightward ? to.x : to.x + to.width, y: to.center.y };

            const d = sameColumn
              ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
              : horizontalFlowPath(start, end);

            return (
              <g key={`${edge.from}->${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="var(--color-line-strong)"
                  strokeWidth={0.9}
                  markerEnd={`url(#domain-arrow-${domain.id})`}
                />
                {edge.label ? (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 7}
                    textAnchor="middle"
                    className="fill-faint font-mono"
                    style={{ fontSize: 7.5, letterSpacing: '0.12em' }}
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {placed.map((node) => {
            const accent = node.tone === 'accent';
            const muted = node.tone === 'muted';
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={accent ? 'var(--color-accent-dim)' : 'var(--color-panel)'}
                  fillOpacity={accent ? 0.55 : 1}
                  stroke={
                    accent
                      ? 'var(--color-accent)'
                      : muted
                        ? 'var(--color-line)'
                        : 'var(--color-line-strong)'
                  }
                  strokeWidth={1}
                />
                <text
                  x={node.center.x}
                  y={node.center.y + 4}
                  textAnchor="middle"
                  className={accent ? 'fill-accent' : muted ? 'fill-muted' : 'fill-primary'}
                  style={{ fontSize: 11, fontWeight: 500, letterSpacing: '-0.005em' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
