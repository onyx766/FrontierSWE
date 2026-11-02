import { verticalFlowPath, type Point } from '@/lib/geometry';
import type { ArchitectureEdge, ArchitectureLayer } from '@/lib/types';

/**
 * Deterministic layout for the layered architecture diagrams on project and
 * domain pages. Pure and measurement-free: positions come from the data, so
 * the diagram renders identically on the server and the client, is in the
 * initial HTML, and never needs a DOM read.
 */

export const ARCH = {
  width: 920,
  railWidth: 104,
  paddingX: 24,
  paddingTop: 26,
  layerGap: 132,
  nodeHeight: 58,
  nodeGap: 20,
  maxNodeWidth: 206,
  minNodeWidth: 120,
} as const;

export interface PlacedNode {
  id: string;
  label: string;
  detail?: string;
  tone: 'default' | 'accent' | 'muted';
  x: number;
  y: number;
  width: number;
  height: number;
  layerIndex: number;
  center: Point;
}

export interface PlacedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  d: string;
  /** Midpoint, for the optional edge label. */
  mid: Point;
  sameLayer: boolean;
}

export interface PlacedLayer {
  label: string;
  y: number;
  index: number;
}

export interface ArchitectureLayout {
  box: { width: number; height: number };
  nodes: PlacedNode[];
  layers: PlacedLayer[];
  edges: PlacedEdge[];
  nodeById: Map<string, PlacedNode>;
}

export function layoutArchitecture(
  layers: ArchitectureLayer[],
  edges: ArchitectureEdge[],
): ArchitectureLayout {
  const usableWidth = ARCH.width - ARCH.railWidth - ARCH.paddingX;
  const nodes: PlacedNode[] = [];
  const placedLayers: PlacedLayer[] = [];

  layers.forEach((layer, layerIndex) => {
    const y = ARCH.paddingTop + layerIndex * ARCH.layerGap;
    placedLayers.push({ label: layer.label, y, index: layerIndex });

    const count = Math.max(1, layer.nodes.length);
    const rawWidth = (usableWidth - ARCH.nodeGap * (count - 1)) / count;
    const width = Math.max(ARCH.minNodeWidth, Math.min(ARCH.maxNodeWidth, rawWidth));
    // Centre the row inside the usable area when nodes are narrower than it.
    const rowWidth = width * count + ARCH.nodeGap * (count - 1);
    const startX = ARCH.railWidth + Math.max(0, (usableWidth - rowWidth) / 2);

    layer.nodes.forEach((node, nodeIndex) => {
      const x = startX + nodeIndex * (width + ARCH.nodeGap);
      nodes.push({
        id: node.id,
        label: node.label,
        detail: node.detail,
        tone: node.tone ?? 'default',
        x,
        y,
        width,
        height: ARCH.nodeHeight,
        layerIndex,
        center: { x: x + width / 2, y: y + ARCH.nodeHeight / 2 },
      });
    });
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const placedEdges: PlacedEdge[] = [];
  for (const edge of edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;

    const sameLayer = from.layerIndex === to.layerIndex;
    let d: string;
    let mid: Point;

    if (sameLayer) {
      const leftToRight = from.center.x <= to.center.x;
      const start = {
        x: leftToRight ? from.x + from.width : from.x,
        y: from.center.y,
      };
      const end = { x: leftToRight ? to.x : to.x + to.width, y: to.center.y };
      d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      mid = { x: (start.x + end.x) / 2, y: start.y - 9 };
    } else {
      const downward = to.layerIndex > from.layerIndex;
      const start = { x: from.center.x, y: downward ? from.y + from.height : from.y };
      const end = { x: to.center.x, y: downward ? to.y : to.y + to.height };
      d = verticalFlowPath(start, end);
      mid = { x: (start.x + end.x) / 2 + 8, y: (start.y + end.y) / 2 };
    }

    placedEdges.push({
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      d,
      mid,
      sameLayer,
    });
  }

  const height =
    ARCH.paddingTop + Math.max(1, layers.length) * ARCH.layerGap - ARCH.layerGap + ARCH.nodeHeight + ARCH.paddingTop;

  return {
    box: { width: ARCH.width, height },
    nodes,
    layers: placedLayers,
    edges: placedEdges,
    nodeById,
  };
}

/** Visual duration for a traced step, loosely proportional to its latency. */
export function stepDuration(latencyMs: number): number {
  return Math.round(Math.min(900, Math.max(280, 240 + latencyMs * 0.45)));
}
