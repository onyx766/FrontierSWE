import { topologyLinks, topologyNodes } from '@/data/domains';
import { curveLength, curvePath, polarToPoint, trimSegment, type Point } from '@/lib/geometry';
import type { DomainId, LinkKind, TopologyNode } from '@/lib/types';

/**
 * Pure topology layout. No React, no DOM, fully deterministic — so the same
 * geometry is produced on the server and the client, and the diagram renders
 * in the initial HTML (it works with JavaScript disabled; only the packet
 * animation and pointer parallax need JS).
 *
 * Two projections exist:
 *   `radial` — the desktop network, 1000 x 620
 *   `spine`  — a deliberate mobile layout, 360 x 940, vertical trunk
 *
 * Both are rendered and toggled with CSS breakpoints rather than a JS media
 * query, which avoids a hydration mismatch and any layout shift on load.
 * A `display: none` subtree does not run animations, so the hidden projection
 * costs nothing at runtime.
 */

export const RADIAL_BOX = { width: 1000, height: 620 } as const;
export const SPINE_BOX = { width: 360, height: 940 } as const;

/** Visual geometry of the nodes, in user units. */
export const NODE_GEOMETRY = {
  coreWidth: 176,
  coreHeight: 84,
  /** Radius used when trimming links so they stop at the core box edge. */
  coreGap: 104,
  domainDot: 5.5,
  domainRing: 15,
  domainGap: 24,
} as const;

export type TextAnchor = 'start' | 'middle' | 'end';

export interface LaidOutNode {
  node: TopologyNode;
  point: Point;
  /** Label placement derived from the node's position around the core. */
  label: {
    x: number;
    y: number;
    anchor: TextAnchor;
    /** Where the sublabel (node id) goes relative to the label. */
    subY: number;
  };
}

export interface LaidOutLink {
  id: string;
  from: DomainId;
  to: DomainId;
  kind: LinkKind;
  weight: 1 | 2 | 3;
  /** SVG path data. */
  d: string;
  /** Approximate length, for stroke-dash tracing and packet duration. */
  length: number;
}

export interface TopologyLayout {
  box: { width: number; height: number };
  nodes: LaidOutNode[];
  links: LaidOutLink[];
  /** Fast lookup for node → point. */
  pointOf: (id: DomainId) => Point;
  /** Which link a feed event should animate in this projection. */
  linkForEvent: (linkId: string, targetNode: DomainId) => string;
}

function gapFor(node: TopologyNode): number {
  return node.kind === 'core' ? NODE_GEOMETRY.coreGap : NODE_GEOMETRY.domainGap;
}

function nodeById(id: DomainId): TopologyNode {
  const found = topologyNodes.find((node) => node.id === id);
  if (!found) throw new Error(`topologyLayout: unknown node "${id}"`);
  return found;
}

/* ────────────────────────────── Radial (desktop) ─────────────────────────── */

function radialLabel(node: TopologyNode, point: Point): LaidOutNode['label'] {
  if (node.kind === 'core') {
    return { x: point.x, y: point.y - 6, anchor: 'middle', subY: 18 };
  }

  const dx = point.x - RADIAL_BOX.width / 2;
  const dy = point.y - RADIAL_BOX.height / 2;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.1;

  if (horizontal) {
    const onRight = dx > 0;
    return {
      x: point.x + (onRight ? 30 : -30),
      y: point.y + 5,
      anchor: onRight ? 'start' : 'end',
      subY: 17,
    };
  }

  const below = dy > 0;
  return {
    x: point.x,
    y: point.y + (below ? 40 : -30),
    anchor: 'middle',
    subY: below ? 17 : -17,
  };
}

function buildRadial(): TopologyLayout {
  const points = new Map<DomainId, Point>();
  for (const node of topologyNodes) {
    points.set(node.id, polarToPoint(node.angle, node.radius, RADIAL_BOX, 150));
  }

  const pointOf = (id: DomainId): Point => {
    const point = points.get(id);
    if (!point) throw new Error(`topologyLayout: no point for "${id}"`);
    return point;
  };

  const nodes: LaidOutNode[] = topologyNodes.map((node) => {
    const point = pointOf(node.id);
    return { node, point, label: radialLabel(node, point) };
  });

  const links: LaidOutLink[] = topologyLinks.map((link) => {
    const fromNode = nodeById(link.from);
    const toNode = nodeById(link.to);
    const [start, end] = trimSegment(
      pointOf(link.from),
      pointOf(link.to),
      gapFor(fromNode),
      gapFor(toNode),
    );
    return {
      id: link.id,
      from: link.from,
      to: link.to,
      kind: link.kind,
      weight: link.weight,
      d: curvePath(start, end, link.curve),
      length: curveLength(start, end, link.curve),
    };
  });

  return {
    box: RADIAL_BOX,
    nodes,
    links,
    pointOf,
    // In the radial projection every topology link exists, so events map 1:1.
    linkForEvent: (linkId) => linkId,
  };
}

/* ─────────────────────────────── Spine (mobile) ──────────────────────────── */

const SPINE = {
  trunkX: 44,
  coreTop: 26,
  firstNodeY: 196,
  rowGap: 146,
} as const;

/**
 * The mobile projection is a different diagram, not a shrunken one: a vertical
 * trunk descending from the core with a short elbow out to each domain node,
 * and labels as left-aligned text at a comfortable reading size. Cross-links
 * between leaf domains are intentionally dropped — on a 390px screen they add
 * crossing lines and no information.
 */
function buildSpine(): TopologyLayout {
  const core = nodeById('core-engine');
  const ordered = [...topologyNodes]
    .filter((node) => node.kind !== 'core')
    .sort((a, b) => a.spineOrder - b.spineOrder);

  const points = new Map<DomainId, Point>();
  points.set(core.id, {
    x: SPINE.trunkX,
    y: SPINE.coreTop + NODE_GEOMETRY.coreHeight / 2,
  });

  ordered.forEach((node, index) => {
    points.set(node.id, { x: SPINE.trunkX, y: SPINE.firstNodeY + index * SPINE.rowGap });
  });

  const pointOf = (id: DomainId): Point => {
    const point = points.get(id);
    if (!point) throw new Error(`topologyLayout: no spine point for "${id}"`);
    return point;
  };

  const nodes: LaidOutNode[] = [core, ...ordered].map((node) => {
    const point = pointOf(node.id);
    return {
      node,
      point,
      label: {
        x: node.kind === 'core' ? SPINE.trunkX : point.x + 30,
        y: node.kind === 'core' ? point.y - 4 : point.y - 2,
        anchor: 'start',
        subY: 18,
      },
    };
  });

  const corePoint = pointOf(core.id);
  const trunkStart = corePoint.y + NODE_GEOMETRY.coreHeight / 2;

  const links: LaidOutLink[] = ordered.map((node, index) => {
    const point = pointOf(node.id);
    const segmentStart = index === 0 ? trunkStart : pointOf(ordered[index - 1]!.id).y + 16;
    const segmentEnd = point.y - NODE_GEOMETRY.domainRing;
    return {
      id: `spine-${node.id}`,
      from: index === 0 ? core.id : ordered[index - 1]!.id,
      to: node.id,
      kind: 'request',
      weight: 2,
      d: `M ${SPINE.trunkX} ${segmentStart} L ${SPINE.trunkX} ${segmentEnd}`,
      length: Math.max(1, segmentEnd - segmentStart),
    };
  });

  return {
    box: SPINE_BOX,
    nodes,
    links,
    pointOf,
    // Feed events reference radial link ids; on the spine we animate the
    // segment that leads into the event's target node.
    linkForEvent: (_linkId, targetNode) =>
      targetNode === core.id ? `spine-${ordered[0]!.id}` : `spine-${targetNode}`,
  };
}

/* ─────────────────────────────────── API ─────────────────────────────────── */

export const radialLayout: TopologyLayout = buildRadial();
export const spineLayout: TopologyLayout = buildSpine();

export type Projection = 'radial' | 'spine';

export function getLayout(projection: Projection): TopologyLayout {
  return projection === 'radial' ? radialLayout : spineLayout;
}

/** Stroke width per traffic weight. */
export function strokeForWeight(weight: 1 | 2 | 3): number {
  return weight === 3 ? 1.1 : weight === 2 ? 0.9 : 0.7;
}
