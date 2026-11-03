import { stepDuration } from '@/components/system/architectureLayout';
import type { ArchitectureLayerNode, ArchitectureSpec, RequestPath } from '@/lib/types';
import { clamp, distance, type Vec3 } from '../../world/vec';

/**
 * The hologram's 3D architecture diagram, as data.
 *
 * Pure and free of three.js, so the layout can be tested in Node and so that the
 * same project always produces the same model. Each architecture layer is a row.
 * Rows step towards the viewer as they descend, like tiers of seating, which
 * stops them hiding one another and gives the wires real depth to travel through.
 *
 * Model space: origin at the centre, +X right, +Y up, +Z towards the viewer.
 */

export const MODEL = {
  width: 6.3,
  height: 2.5,
  /** Left margin holding the row labels. */
  railWidth: 0.96,
  nodeHeight: 0.46,
  nodeDepth: 0.2,
  nodeGap: 0.14,
  maxNodeWidth: 1.62,
  /** How far each row sits in front of the one above it. */
  rowStep: 0.22,
  /** How much of a face its wires spread across. */
  slotSpread: 0.72,
  /** How high a wire arcs when it hops along its own row. */
  hopHeight: 0.3,
  /** Clearance of a wire passing in front of a row it does not stop at. */
  wireClearance: 0.08,
  wireSamples: 20,
} as const;

const PACKET_SPEED = 2.6;
const MIN_LEG_SECONDS = 0.34;
const FIRST_HOLD_SECONDS = 0.4;
const LAST_HOLD_SECONDS = 0.9;
/** Node dwell is the site's step duration, cut down: legs add their own time here. */
const DWELL_SCALE = 0.55;

export type NodeTone = NonNullable<ArchitectureLayerNode['tone']>;

export interface ModelNode {
  id: string;
  label: string;
  detail?: string;
  tone: NodeTone;
  row: number;
  /** Position within its row. */
  column: number;
  /** Centre of the box. */
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export interface ModelRow {
  label: string;
  y: number;
  z: number;
}

export interface ModelWire {
  id: string;
  from: string;
  to: string;
  label?: string;
  points: Vec3[];
}

/** One timed stretch of the packet's loop: a hold at a stop, or a leg to the next one. */
export interface RouteSegment {
  startTime: number;
  endTime: number;
  fromLength: number;
  toLength: number;
  /** The stop most recently reached. */
  stop: number;
}

export interface ModelRoute {
  label: string;
  /** Node ids in visiting order. */
  stops: string[];
  /** The label of the wire each stop is reached by, where it has one. */
  arrivals: (string | null)[];
  /** Whole path as one polyline, from the first stop to the last. */
  points: Vec3[];
  /** Cumulative length at each point. */
  lengths: number[];
  length: number;
  segments: RouteSegment[];
  /** Seconds for one loop. */
  duration: number;
}

export interface ArchitectureModel {
  rows: ModelRow[];
  nodes: ModelNode[];
  wires: ModelWire[];
  route: ModelRoute | null;
}

export interface RouteSample {
  /** Distance along the route. */
  length: number;
  /** Index of the stop most recently reached. */
  stop: number;
  /** 0 to 1 through the current segment. */
  progress: number;
}

type Face = 'top' | 'bottom' | 'left' | 'right';

/* ──────────────────────────────── Nodes and rows ─────────────────────────── */

function placeNodes(spec: ArchitectureSpec): { rows: ModelRow[]; nodes: ModelNode[] } {
  const count = spec.layers.length;
  const span = MODEL.height - MODEL.nodeHeight;
  const rowGap = count > 1 ? span / (count - 1) : 0;
  /* A model whose rows have no names has no use for a rail to write them on. */
  const rail = spec.layers.some((layer) => layer.label) ? MODEL.railWidth : 0;
  const left = -MODEL.width / 2 + rail;
  const usable = MODEL.width - rail;

  const rows: ModelRow[] = [];
  const nodes: ModelNode[] = [];

  spec.layers.forEach((layer, row) => {
    const y = count > 1 ? span / 2 - row * rowGap : 0;
    const z = (row - (count - 1) / 2) * MODEL.rowStep;
    rows.push({ label: layer.label, y, z });

    const columns = Math.max(1, layer.nodes.length);
    const fitted = (usable - MODEL.nodeGap * (columns - 1)) / columns;
    const width = Math.min(MODEL.maxNodeWidth, fitted);
    const rowWidth = width * columns + MODEL.nodeGap * (columns - 1);
    const start = left + (usable - rowWidth) / 2;

    layer.nodes.forEach((node, column) => {
      nodes.push({
        id: node.id,
        label: node.label,
        ...(node.detail ? { detail: node.detail } : {}),
        tone: node.tone ?? 'default',
        row,
        column,
        x: start + column * (width + MODEL.nodeGap) + width / 2,
        y,
        z,
        width,
        height: MODEL.nodeHeight,
        depth: MODEL.nodeDepth,
      });
    });
  });

  return { rows, nodes };
}

/* ───────────────────────────────── Wires ─────────────────────────────────── */

function facesBetween(from: ModelNode, to: ModelNode): [Face, Face] {
  if (from.row !== to.row) return to.row > from.row ? ['bottom', 'top'] : ['top', 'bottom'];
  if (Math.abs(from.column - to.column) > 1) return ['top', 'top'];
  return to.column > from.column ? ['right', 'left'] : ['left', 'right'];
}

function faceLength(node: ModelNode, face: Face): number {
  return face === 'top' || face === 'bottom' ? node.width : node.height;
}

function facePoint(node: ModelNode, face: Face, offset: number): Vec3 {
  switch (face) {
    case 'top':
      return { x: node.x + offset, y: node.y + node.height / 2, z: node.z };
    case 'bottom':
      return { x: node.x + offset, y: node.y - node.height / 2, z: node.z };
    case 'left':
      return { x: node.x - node.width / 2, y: node.y + offset, z: node.z };
    case 'right':
      return { x: node.x + node.width / 2, y: node.y + offset, z: node.z };
  }
}

function cubic(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): Vec3[] {
  const points: Vec3[] = [];
  for (let step = 0; step <= MODEL.wireSamples; step += 1) {
    const t = step / MODEL.wireSamples;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    points.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
      z: a * p0.z + b * p1.z + c * p2.z + d * p3.z,
    });
  }
  return points;
}

/** The z a wire must reach at its middle so that it clears the rows between its ends. */
function clearanceZ(from: ModelNode, to: ModelNode, rows: ModelRow[]): number | null {
  const first = Math.min(from.row, to.row) + 1;
  const last = Math.max(from.row, to.row) - 1;
  if (last < first) return null;
  let front = -Infinity;
  for (let row = first; row <= last; row += 1) {
    front = Math.max(front, (rows[row] as ModelRow).z);
  }
  return front + MODEL.nodeDepth / 2 + MODEL.wireClearance;
}

function wirePoints(
  from: ModelNode,
  to: ModelNode,
  fromFace: Face,
  toFace: Face,
  fromOffset: number,
  toOffset: number,
  rows: ModelRow[],
): Vec3[] {
  const start = facePoint(from, fromFace, fromOffset);
  const end = facePoint(to, toFace, toOffset);

  if (fromFace === 'top' && toFace === 'top') {
    return cubic(
      start,
      { ...start, y: start.y + MODEL.hopHeight },
      { ...end, y: end.y + MODEL.hopHeight },
      end,
    );
  }

  if (from.row === to.row) {
    const reach = (end.x - start.x) / 2;
    return cubic(start, { ...start, x: start.x + reach }, { ...end, x: end.x - reach }, end);
  }

  const bend = (end.y - start.y) / 2;
  const middle = clearanceZ(from, to, rows);
  /* A cubic's midpoint is (p0 + 3p1 + 3p2 + p3) / 8; solve for equal inner handles. */
  const handleZ = middle === null ? null : (8 * middle - start.z - end.z) / 6;
  return cubic(
    start,
    { x: start.x, y: start.y + bend, z: handleZ ?? start.z },
    { x: end.x, y: end.y - bend, z: handleZ ?? end.z },
    end,
  );
}

interface WirePlan {
  id: string;
  from: ModelNode;
  to: ModelNode;
  faces: [Face, Face];
  label?: string;
}

/** Spreads the wires meeting each face along it, ordered to keep them from crossing. */
function assignSlots(plans: WirePlan[]): Map<string, [number, number]> {
  const faces = new Map<string, { plan: WirePlan; end: 0 | 1; along: number }[]>();

  const claim = (node: ModelNode, face: Face, plan: WirePlan, end: 0 | 1, other: ModelNode) => {
    const key = `${node.id}:${face}`;
    const along = face === 'top' || face === 'bottom' ? other.x : other.y;
    faces.set(key, [...(faces.get(key) ?? []), { plan, end, along }]);
  };

  for (const plan of plans) {
    claim(plan.from, plan.faces[0], plan, 0, plan.to);
    claim(plan.to, plan.faces[1], plan, 1, plan.from);
  }

  const slots = new Map<string, [number, number]>(
    plans.map((plan) => [plan.id, [0, 0] as [number, number]]),
  );

  for (const wires of faces.values()) {
    const ordered = [...wires].sort((a, b) => a.along - b.along);
    ordered.forEach((wire, index) => {
      const node = wire.end === 0 ? wire.plan.from : wire.plan.to;
      const face = wire.plan.faces[wire.end];
      const length = faceLength(node, face) * MODEL.slotSpread;
      const offset = ((index + 0.5) / ordered.length - 0.5) * length;
      (slots.get(wire.plan.id) as [number, number])[wire.end] = offset;
    });
  }

  return slots;
}

/* ───────────────────────────────── Route ─────────────────────────────────── */

function cumulativeLengths(points: Vec3[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const step = distance(points[i - 1] as Vec3, points[i] as Vec3);
    lengths.push((lengths[i - 1] as number) + step);
  }
  return lengths;
}

function buildRoute(
  path: RequestPath,
  byId: Map<string, ModelNode>,
  wires: ModelWire[],
  rows: ModelRow[],
): ModelRoute | null {
  const stops = path.steps
    .map((id, index) => ({ node: byId.get(id), latency: path.latencies[index] ?? 0 }))
    .filter((stop): stop is { node: ModelNode; latency: number } => stop.node !== undefined);
  if (stops.length < 2) return null;

  const points: Vec3[] = [];
  const segments: RouteSegment[] = [];
  const arrivals: (string | null)[] = [null];
  let time = 0;
  let travelled = 0;

  const hold = (stop: number, seconds: number) => {
    segments.push({
      startTime: time,
      endTime: time + seconds,
      fromLength: travelled,
      toLength: travelled,
      stop,
    });
    time += seconds;
  };

  hold(0, FIRST_HOLD_SECONDS);

  for (let leg = 0; leg + 1 < stops.length; leg += 1) {
    const from = (stops[leg] as (typeof stops)[number]).node;
    const { node: to, latency } = stops[leg + 1] as (typeof stops)[number];

    const forward = wires.find((wire) => wire.from === from.id && wire.to === to.id);
    const backward = wires.find((wire) => wire.from === to.id && wire.to === from.id);
    const [fromFace, toFace] = facesBetween(from, to);
    /* A path can jump between nodes no edge joins, so such a leg gets its own wire. */
    const legPoints = forward
      ? forward.points
      : backward
        ? [...backward.points].reverse()
        : wirePoints(from, to, fromFace, toFace, 0, 0, rows);

    arrivals.push(forward?.label ?? backward?.label ?? null);

    /* A leg starts where the last ended, carrying the packet across the box between them. */
    const entry = points[points.length - 1];
    const crossing = entry ? distance(entry, legPoints[0] as Vec3) : 0;
    const legLength = crossing + (cumulativeLengths(legPoints).at(-1) ?? 0);
    points.push(...legPoints);

    const seconds = Math.max(MIN_LEG_SECONDS, legLength / PACKET_SPEED);
    segments.push({
      startTime: time,
      endTime: time + seconds,
      fromLength: travelled,
      toLength: travelled + legLength,
      stop: leg,
    });
    time += seconds;
    travelled += legLength;

    const isLast = leg + 2 === stops.length;
    hold(leg + 1, isLast ? LAST_HOLD_SECONDS : (stepDuration(latency) / 1000) * DWELL_SCALE);
  }

  const lengths = cumulativeLengths(points);
  return {
    label: path.label,
    stops: stops.map((stop) => stop.node.id),
    arrivals,
    points,
    lengths,
    length: lengths[lengths.length - 1] as number,
    segments,
    duration: time,
  };
}

/** Where the packet is `time` seconds into the loop. Writes into `out`; allocates nothing. */
export function sampleRoute(route: ModelRoute, time: number, out: RouteSample): RouteSample {
  const wrapped = ((time % route.duration) + route.duration) % route.duration;
  let segment = route.segments[route.segments.length - 1] as RouteSegment;
  for (const candidate of route.segments) {
    if (wrapped < candidate.endTime) {
      segment = candidate;
      break;
    }
  }

  const span = segment.endTime - segment.startTime;
  const progress = span > 0 ? clamp((wrapped - segment.startTime) / span, 0, 1) : 1;
  const eased = progress * progress * (3 - 2 * progress);

  out.length = segment.fromLength + (segment.toLength - segment.fromLength) * eased;
  out.stop = segment.stop;
  out.progress = progress;
  return out;
}

/** The point `length` along the route. Writes into `out`; allocates nothing. */
export function routePoint(route: ModelRoute, length: number, out: Vec3): Vec3 {
  const { points, lengths } = route;
  const target = clamp(length, 0, route.length);

  let low = 0;
  let high = lengths.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((lengths[middle] as number) <= target) low = middle;
    else high = middle;
  }

  const a = points[low] as Vec3;
  const b = points[high] as Vec3;
  const start = lengths[low] as number;
  const end = lengths[high] as number;
  const t = end > start ? (target - start) / (end - start) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

/* ───────────────────────────────── Model ─────────────────────────────────── */

export function buildArchitectureModel(spec: ArchitectureSpec): ArchitectureModel {
  const { rows, nodes } = placeNodes(spec);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const plans: WirePlan[] = [];
  for (const edge of spec.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    plans.push({
      id: `${edge.from}->${edge.to}`,
      from,
      to,
      faces: facesBetween(from, to),
      ...(edge.label ? { label: edge.label } : {}),
    });
  }

  const slots = assignSlots(plans);
  const wires: ModelWire[] = plans.map((plan) => {
    const [fromOffset, toOffset] = slots.get(plan.id) as [number, number];
    return {
      id: plan.id,
      from: plan.from.id,
      to: plan.to.id,
      ...(plan.label ? { label: plan.label } : {}),
      points: wirePoints(
        plan.from,
        plan.to,
        plan.faces[0],
        plan.faces[1],
        fromOffset,
        toOffset,
        rows,
      ),
    };
  });

  const path = spec.paths[0];
  return { rows, nodes, wires, route: path ? buildRoute(path, byId, wires, rows) : null };
}

/** The left and right limits of a model's boxes. */
export function nodeExtent(model: ArchitectureModel): { left: number; right: number } {
  return {
    left: Math.min(...model.nodes.map((node) => node.x - node.width / 2)),
    right: Math.max(...model.nodes.map((node) => node.x + node.width / 2)),
  };
}

/** Label size that fits on one line of its box, for a typical Geist Medium advance. */
export function nodeLabelSize(node: ModelNode): number {
  const advance = 0.56;
  const room = node.width - 0.16;
  return Math.min(0.135, room / (node.label.length * advance));
}
