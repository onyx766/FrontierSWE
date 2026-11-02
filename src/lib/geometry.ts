import { fixed } from '@/lib/rng';

/**
 * Pure geometry for the network topology and architecture diagrams.
 * No React, no DOM — so it is trivially testable and safe on the server.
 */

export interface Point {
  x: number;
  y: number;
}

/** The desktop topology viewBox. Fixed, so the SVG scales without reflow. */
export const TOPOLOGY_VIEWBOX = { width: 1000, height: 620 } as const;

/** The mobile vertical-spine viewBox. Taller, narrower. */
export const SPINE_VIEWBOX = { width: 360, height: 900 } as const;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Project a polar node position into the radial layout box.
 * `radius` is normalised 0–1 and scaled against the smaller axis so the
 * network never clips on wide or tall viewports.
 */
export function polarToPoint(
  angleDeg: number,
  radius: number,
  box: { width: number; height: number },
  inset = 120,
): Point {
  const cx = box.width / 2;
  const cy = box.height / 2;
  const rx = cx - inset;
  const ry = cy - inset * 0.55;
  const rad = angleDeg * DEG_TO_RAD;
  return {
    x: fixed(cx + Math.cos(rad) * rx * radius, 2),
    y: fixed(cy + Math.sin(rad) * ry * radius, 2),
  };
}

/**
 * Quadratic bezier between two points, with the control point offset
 * perpendicular to the midpoint. A little curvature stops the graph reading
 * as a flat hub-and-spoke wheel.
 */
export function curvePath(a: Point, b: Point, curve: number): string {
  if (curve === 0) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal to the segment.
  const nx = -dy / length;
  const ny = dx / length;
  const cxp = fixed(mx + nx * curve, 2);
  const cyp = fixed(my + ny * curve, 2);
  return `M ${a.x} ${a.y} Q ${cxp} ${cyp} ${b.x} ${b.y}`;
}

/** Approximate length of a quadratic bezier, for stroke-dash tracing. */
export function curveLength(a: Point, b: Point, curve: number): number {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (curve === 0) return fixed(chord, 1);
  // Cheap approximation: chord plus a share of the control-point deflection.
  return fixed(chord + (Math.abs(curve) * 4) / 3, 1);
}

/**
 * Shorten a segment at both ends so links stop at the node rings instead of
 * disappearing underneath them.
 */
export function trimSegment(a: Point, b: Point, startGap: number, endGap: number): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return [
    { x: fixed(a.x + ux * startGap, 2), y: fixed(a.y + uy * startGap, 2) },
    { x: fixed(b.x - ux * endGap, 2), y: fixed(b.y - uy * endGap, 2) },
  ];
}

/** Elbow path used by the mobile spine and the layered architecture diagrams. */
export function elbowPath(a: Point, b: Point, radius = 10): string {
  if (Math.abs(a.x - b.x) < 1) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const midY = fixed((a.y + b.y) / 2, 2);
  const dir = b.x > a.x ? 1 : -1;
  const r = Math.min(radius, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2);
  return [
    `M ${a.x} ${a.y}`,
    `L ${a.x} ${fixed(midY - r, 2)}`,
    `Q ${a.x} ${midY} ${fixed(a.x + r * dir, 2)} ${midY}`,
    `L ${fixed(b.x - r * dir, 2)} ${midY}`,
    `Q ${b.x} ${midY} ${b.x} ${fixed(midY + r, 2)}`,
    `L ${b.x} ${b.y}`,
  ].join(' ');
}

/** Vertical connector with a soft S-curve, for architecture layer edges. */
export function verticalFlowPath(a: Point, b: Point): string {
  const dy = b.y - a.y;
  const c1 = fixed(a.y + dy * 0.45, 2);
  const c2 = fixed(b.y - dy * 0.45, 2);
  return `M ${a.x} ${a.y} C ${a.x} ${c1} ${b.x} ${c2} ${b.x} ${b.y}`;
}

/** Horizontal connector with a soft S-curve, for left-to-right flow diagrams. */
export function horizontalFlowPath(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const c1 = fixed(a.x + dx * 0.45, 2);
  const c2 = fixed(b.x - dx * 0.45, 2);
  return `M ${a.x} ${a.y} C ${c1} ${a.y} ${c2} ${b.y} ${b.x} ${b.y}`;
}
