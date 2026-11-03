import { polar, vec, type Vec3 } from '../../world/vec';

/**
 * The crystal's shape, as pure data: no three.js, so it can be tested in Node.
 *
 * From the opening shot the crystal has to read as the reference's hexagon, a
 * glass cube with a vertical edge towards the camera. Solved through the hero
 * camera, that fixes the top at y=12 and the vertical edges down to about y=-11:
 * the cube straddles the Ring plane. Below that the four lower facets converge
 * on a point on the axis, placed so that it projects onto the same pixel as the
 * cube's front corner. The opening silhouette is therefore exact, and from
 * anywhere else the crystal is a pointed gem hanging over the void.
 *
 * The solid is built as an intersection of half-spaces. A bevel is then just one
 * more plane per edge and a cut corner one more per vertex, and the facets of the
 * result come out consistent without any special cases.
 */

export const GEM = {
  /** Axis to vertical edge. */
  radius: 18.55,
  top: 12,
  girdle: -11.2,
  apex: -25.2,
  /** How far each bevel plane cuts into a sharp edge. */
  bevel: 0.1,
  /** How far each corner plane cuts into a sharp vertex. */
  cornerCut: 0.62,
} as const;

export type FacetKind = 'top' | 'side' | 'lower' | 'bevel' | 'corner' | 'heart';

export interface GemFacet {
  kind: FacetKind;
  /** Outward unit normal. */
  normal: Vec3;
  /** Convex outline, counter-clockwise seen from outside. */
  points: Vec3[];
}

interface Plane {
  kind: FacetKind;
  normal: Vec3;
  /** Points inside satisfy `dot(normal, p) <= offset`. */
  offset: number;
}

const EPSILON = 1e-6;

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

function minus(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function plus(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function times(a: Vec3, s: number): Vec3 {
  return vec(a.x * s, a.y * s, a.z * s);
}

function size(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function unit(a: Vec3): Vec3 {
  const length = size(a);
  return length > 0 ? times(a, 1 / length) : vec(0, 0, 0);
}

function mid(a: Vec3, b: Vec3): Vec3 {
  return times(plus(a, b), 0.5);
}

function pick<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length] as T;
}

/** The sharp solid: four top corners, four girdle corners, one apex. */
function sharpVertices(): Vec3[] {
  const bearings = [0, 90, 180, 270];
  return [
    ...bearings.map((bearing) => polar(GEM.radius, bearing, GEM.top)),
    ...bearings.map((bearing) => polar(GEM.radius, bearing, GEM.girdle)),
    vec(0, GEM.apex, 0),
  ];
}

const SHARP_FACES: { kind: FacetKind; corners: number[] }[] = [
  { kind: 'top', corners: [0, 1, 2, 3] },
  ...[0, 1, 2, 3].map((i) => ({
    kind: 'side' as const,
    corners: [i, (i + 1) % 4, 4 + ((i + 1) % 4), 4 + i],
  })),
  ...[0, 1, 2, 3].map((i) => ({
    kind: 'lower' as const,
    corners: [4 + i, 4 + ((i + 1) % 4), 8],
  })),
];

function buildPlanes(): Plane[] {
  const vertices = sharpVertices();
  const inside = vec(0, 0, 0);

  const faces = SHARP_FACES.map((face) => {
    const a = pick(vertices, pick(face.corners, 0));
    const b = pick(vertices, pick(face.corners, 1));
    const c = pick(vertices, pick(face.corners, 2));
    let normal = unit(cross(minus(b, a), minus(c, a)));
    if (dot(normal, minus(inside, a)) > 0) normal = times(normal, -1);
    return { kind: face.kind, normal, offset: dot(normal, a), corners: face.corners };
  });

  const planes: Plane[] = faces.map(({ kind, normal, offset }) => ({ kind, normal, offset }));

  /* A bevel for every pair of faces sharing two corners. */
  faces.forEach((first, i) => {
    faces.slice(i + 1).forEach((second) => {
      const shared = first.corners.filter((corner) => second.corners.includes(corner));
      if (shared.length !== 2) return;
      const normal = unit(plus(first.normal, second.normal));
      const point = pick(vertices, pick(shared, 0));
      planes.push({ kind: 'bevel', normal, offset: dot(normal, point) - GEM.bevel });
    });
  });

  /* A small cut across every corner. */
  vertices.forEach((point, corner) => {
    const meeting = faces.filter((face) => face.corners.includes(corner));
    const normal = unit(meeting.reduce((sum, face) => plus(sum, face.normal), vec(0, 0, 0)));
    planes.push({ kind: 'corner', normal, offset: dot(normal, point) - GEM.cornerCut });
  });

  return planes;
}

/** The point where three planes meet, or null if they do not meet at one point. */
function meet(a: Plane, b: Plane, c: Plane): Vec3 | null {
  const bc = cross(b.normal, c.normal);
  const determinant = dot(a.normal, bc);
  if (Math.abs(determinant) < EPSILON) return null;
  const point = plus(
    plus(times(bc, a.offset), times(cross(c.normal, a.normal), b.offset)),
    times(cross(a.normal, b.normal), c.offset),
  );
  return times(point, 1 / determinant);
}

function solidVertices(planes: Plane[]): Vec3[] {
  const found: Vec3[] = [];
  planes.forEach((a, i) => {
    planes.slice(i + 1).forEach((b, j) => {
      planes.slice(i + j + 2).forEach((c) => {
        const point = meet(a, b, c);
        if (!point) return;
        if (planes.some((plane) => dot(plane.normal, point) > plane.offset + EPSILON)) return;
        const known = found.some(
          (other) => size(minus(other, point)) < 1e-5,
        );
        if (!known) found.push(point);
      });
    });
  });
  return found;
}

function orderAround(points: Vec3[], normal: Vec3): Vec3[] {
  const center = times(
    points.reduce((sum, point) => plus(sum, point), vec(0, 0, 0)),
    1 / points.length,
  );
  const reference = unit(minus(pick(points, 0), center));
  const other = cross(normal, reference);
  const angle = (point: Vec3) => {
    const offset = minus(point, center);
    return Math.atan2(dot(offset, other), dot(offset, reference));
  };
  return [...points].sort((a, b) => angle(a) - angle(b));
}

/** Every facet of the bevelled gem. */
export function buildGemFacets(): GemFacet[] {
  const planes = buildPlanes();
  const vertices = solidVertices(planes);
  const facets: GemFacet[] = [];

  for (const plane of planes) {
    const onPlane = vertices.filter(
      (point) => Math.abs(dot(plane.normal, point) - plane.offset) < 1e-5,
    );
    if (onPlane.length < 3) continue;
    facets.push({
      kind: plane.kind,
      normal: plane.normal,
      points: orderAround(onPlane, plane.normal),
    });
  }

  return facets;
}

/**
 * Distance from a point to the gem's surface: positive outside, negative inside.
 * The surface is the sharp solid's, which is close enough for what this is used
 * for, and exact on the flats.
 */
export function gemClearance(x: number, y: number, z: number): number {
  const reach = Math.abs(x) + Math.abs(z);
  const flank = (reach - GEM.radius) * Math.SQRT1_2;
  const above = y - GEM.top;

  const taper = GEM.radius / (GEM.girdle - GEM.apex);
  const under = (reach - taper * (y - GEM.apex)) / Math.sqrt(2 + taper * taper);

  return Math.max(flank, above, under);
}

/** The small octahedron at the crystal's heart, seen as light inside the glass. */
export function buildHeartFacets(center: number, radius: number, height: number): GemFacet[] {
  const ring = [0, 90, 180, 270].map((bearing) => polar(radius, bearing, center));
  const tips = [vec(0, center + height, 0), vec(0, center - height, 0)];
  const middle = vec(0, center, 0);
  const facets: GemFacet[] = [];

  ring.forEach((corner, index) => {
    const next = pick(ring, index + 1);
    for (const tip of tips) {
      const normal = unit(cross(minus(next, corner), minus(tip, corner)));
      const outward = dot(normal, minus(corner, middle)) > 0;
      facets.push({
        kind: 'heart',
        normal: outward ? normal : times(normal, -1),
        points: outward ? [corner, next, tip] : [corner, tip, next],
      });
    }
  });

  return facets;
}

/** In-plane direction that a facet's texture runs along. */
export function facetTangent(facet: GemFacet): Vec3 {
  if (facet.kind === 'top') return vec(1, 0, 0);
  const horizontal = unit(cross(vec(0, 1, 0), facet.normal));
  if (facet.kind === 'side' || facet.kind === 'lower') return horizontal;

  let longest = vec(1, 0, 0);
  let length = 0;
  facet.points.forEach((point, index) => {
    const edge = minus(pick(facet.points, index + 1), point);
    if (size(edge) > length) {
      length = size(edge);
      longest = unit(edge);
    }
  });
  return longest;
}

/**
 * For each outline point, its distance to the facet's four longest edges. A
 * distance to a straight edge is linear across a flat facet, so these interpolate
 * exactly and the shader can find the distance to the nearest edge per pixel.
 * Bevels and corners are all edge, so they report zero.
 */
export function edgeDistances(facet: GemFacet): number[][] {
  if (facet.kind === 'bevel' || facet.kind === 'corner') {
    return facet.points.map(() => [0, 0, 0, 0]);
  }

  const FAR_AWAY = 1e3;
  const edges = facet.points
    .map((point, index) => {
      const next = pick(facet.points, index + 1);
      const along = minus(next, point);
      const inward = unit(cross(facet.normal, along));
      return { point, inward, length: size(along) };
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  return facet.points.map((point) => {
    const distances = edges.map((edge) => dot(minus(point, edge.point), edge.inward));
    while (distances.length < 4) distances.push(FAR_AWAY);
    return distances;
  });
}

function quadratic(a: Vec3, control: Vec3, b: Vec3, t: number): Vec3 {
  const s = 1 - t;
  return plus(plus(times(a, s * s), times(control, 2 * s * t)), times(b, t * t));
}

/**
 * A facet's outline moved inward and with its corners rounded, as a closed loop.
 * Every facet carries its own loop, so each real edge shows two fine parallel
 * lines either side of its bevel, which reads as polished glass up close and
 * merges into one bright line from afar.
 */
export function roundedOutline(
  facet: GemFacet,
  inset: number,
  radius: number,
  maxSegment: number,
): Vec3[] {
  const moved = facet.points.map((point, index) => {
    const before = unit(minus(point, pick(facet.points, index - 1)));
    const after = unit(minus(pick(facet.points, index + 1), point));
    const inwardBefore = unit(cross(facet.normal, before));
    const inwardAfter = unit(cross(facet.normal, after));
    const blend = 1 + dot(inwardBefore, inwardAfter);
    return plus(point, times(plus(inwardBefore, inwardAfter), inset / blend));
  });

  const corners = moved.map((corner, index) => {
    const toBefore = minus(pick(moved, index - 1), corner);
    const toAfter = minus(pick(moved, index + 1), corner);
    const reachBefore = Math.min(radius, size(toBefore) / 2);
    const reachAfter = Math.min(radius, size(toAfter) / 2);
    return {
      corner,
      start: plus(corner, times(unit(toBefore), reachBefore)),
      end: plus(corner, times(unit(toAfter), reachAfter)),
    };
  });

  const loop: Vec3[] = [];

  corners.forEach(({ corner, start, end }, index) => {
    for (let step = 0; step <= 6; step += 1) {
      loop.push(quadratic(start, corner, end, step / 6));
    }

    /* Subdivide the straight run so that colour can change along it. */
    const next = pick(corners, index + 1).start;
    const pieces = Math.max(1, Math.ceil(size(minus(next, end)) / maxSegment));
    for (let piece = 1; piece < pieces; piece += 1) {
      const t = piece / pieces;
      loop.push(plus(times(end, 1 - t), times(next, t)));
    }
  });

  return loop;
}

export interface GemSeam {
  from: Vec3;
  to: Vec3;
  /** Normal of the facet it lies on. */
  normal: Vec3;
}

/**
 * Panel joints in the glass. The reference's cube is built from four panes a
 * face, so each side and the top carry a cross through their middles, and each
 * lower facet a single line to the apex.
 */
export function gemSeams(): GemSeam[] {
  const vertices = sharpVertices();
  const seams: GemSeam[] = [];

  const seam = (a: Vec3, b: Vec3, normal: Vec3, stopShort = 0.35) => {
    const direction = unit(minus(b, a));
    seams.push({
      from: plus(a, times(direction, 0.35)),
      to: minus(b, times(direction, stopShort)),
      normal,
    });
  };

  const facetNormal = (a: Vec3, b: Vec3, c: Vec3) => {
    const normal = unit(cross(minus(b, a), minus(c, a)));
    return dot(normal, a) < 0 ? times(normal, -1) : normal;
  };

  [0, 1, 2, 3].forEach((i) => {
    const topA = pick(vertices, i);
    const topB = pick(vertices, (i + 1) % 4);
    const girdleA = pick(vertices, 4 + i);
    const girdleB = pick(vertices, 4 + ((i + 1) % 4));
    const apex = pick(vertices, 8);

    const side = facetNormal(topA, topB, girdleA);
    seam(mid(topA, girdleA), mid(topB, girdleB), side);
    seam(mid(topA, topB), mid(girdleA, girdleB), side);

    const lower = facetNormal(girdleA, girdleB, apex);
    seam(mid(girdleA, girdleB), apex, lower, 1.6);
  });

  const up = vec(0, 1, 0);
  const north = pick(vertices, 0);
  const east = pick(vertices, 1);
  const south = pick(vertices, 2);
  const west = pick(vertices, 3);
  seam(mid(north, east), mid(south, west), up);
  seam(mid(north, west), mid(south, east), up);

  return seams;
}
