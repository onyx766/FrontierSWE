import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../world/vec';
import { HERO_SHOT, REFERENCE_FRAME } from '../../../world/world';
import {
  buildGemFacets,
  cross,
  dot,
  edgeDistances,
  facetTangent,
  GEM,
  gemClearance,
  gemSeams,
  roundedOutline,
} from '../gemShape';

/** Pixel in the reference frame for a world point, through the opening shot. */
function heroPixel(point: Vec3): [number, number] {
  const elevation = (HERO_SHOT.elevation * Math.PI) / 180;
  const up = Math.cos(elevation);
  const lift = Math.sin(elevation);
  const focal =
    REFERENCE_FRAME.height / 2 / Math.tan(((HERO_SHOT.fov / 2) * Math.PI) / 180);
  const depth = HERO_SHOT.distance - point.y * lift - point.z * up;
  const right = point.x;
  const raised = point.y * up - point.z * lift;
  const x = REFERENCE_FRAME.width * (0.5 + HERO_SHOT.shiftX) + (focal * right) / depth;
  const y = REFERENCE_FRAME.height * (0.5 - HERO_SHOT.shiftY) - (focal * raised) / depth;
  return [x, y];
}

describe('gem shape', () => {
  const facets = buildGemFacets();
  const allPoints = facets.flatMap((facet) => facet.points);

  it('has every facet of the bevelled solid', () => {
    const count = (kind: string) => facets.filter((facet) => facet.kind === kind).length;
    expect(count('top')).toBe(1);
    expect(count('side')).toBe(4);
    expect(count('lower')).toBe(4);
    expect(count('bevel')).toBe(16);
    expect(count('corner')).toBe(9);
  });

  it('is a closed solid: every edge is shared by exactly two facets', () => {
    const key = (point: Vec3) =>
      `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
    const edges = new Map<string, number>();
    for (const facet of facets) {
      facet.points.forEach((point, index) => {
        const next = facet.points[(index + 1) % facet.points.length] as Vec3;
        const pair = [key(point), key(next)].sort().join('|');
        edges.set(pair, (edges.get(pair) ?? 0) + 1);
      });
    }
    for (const uses of edges.values()) expect(uses).toBe(2);
  });

  it('winds each facet counter-clockwise seen from outside', () => {
    for (const facet of facets) {
      const [a, b, c] = facet.points as [Vec3, Vec3, Vec3];
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      expect(dot(cross(ab, ac), facet.normal)).toBeGreaterThan(0);
    }
  });

  it('lands on the reference silhouette through the opening shot', () => {
    const pixels = allPoints.map(heroPixel);
    const xs = pixels.map(([x]) => x);
    const ys = pixels.map(([, y]) => y);

    expect(Math.min(...ys)).toBeGreaterThan(258);
    expect(Math.min(...ys)).toBeLessThan(266);
    expect(Math.max(...ys)).toBeGreaterThan(556);
    expect(Math.max(...ys)).toBeLessThan(572);
    expect(Math.min(...xs)).toBeGreaterThan(764);
    expect(Math.min(...xs)).toBeLessThan(776);
    expect(Math.max(...xs)).toBeGreaterThan(1054);
    expect(Math.max(...xs)).toBeLessThan(1066);
  });

  it('keeps the walkable Core Loop clear', () => {
    const reach = Math.max(...allPoints.map((point) => Math.hypot(point.x, point.z)));
    expect(reach).toBeLessThan(20);
  });

  it('gives each facet a tangent lying in its plane', () => {
    for (const facet of facets) {
      expect(Math.abs(dot(facetTangent(facet), facet.normal))).toBeLessThan(1e-6);
    }
  });

  it('measures edge distances that are never negative', () => {
    for (const facet of facets) {
      for (const distances of edgeDistances(facet)) {
        expect(distances).toHaveLength(4);
        for (const distance of distances) expect(distance).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('keeps every rounded outline on its facet and inside it', () => {
    for (const facet of facets.filter((candidate) => candidate.kind !== 'bevel')) {
      const anchor = facet.points[0] as Vec3;
      for (const point of roundedOutline(facet, 0.08, 0.5, 2)) {
        const offset = { x: point.x - anchor.x, y: point.y - anchor.y, z: point.z - anchor.z };
        expect(Math.abs(dot(offset, facet.normal))).toBeLessThan(1e-6);
      }
    }
  });

  it('measures clearance as zero on the surface, negative inside, positive outside', () => {
    expect(gemClearance(0, 0, 0)).toBeLessThan(-10);
    expect(gemClearance(0, GEM.top, 0)).toBeCloseTo(0);
    expect(gemClearance(0, GEM.top + 3, 0)).toBeCloseTo(3);
    expect(gemClearance(GEM.radius / 2, 0, GEM.radius / 2)).toBeCloseTo(0);
    expect(gemClearance(0, GEM.apex, 0)).toBeCloseTo(0);
    expect(gemClearance(0, 2.5, 25)).toBeGreaterThan(4);
    expect(gemClearance(0, 4, 16.5)).toBeLessThan(0);
  });

  it('runs every seam along the surface of the solid', () => {
    for (const seam of gemSeams()) {
      for (const point of [seam.from, seam.to]) {
        for (const facet of facets) {
          const anchor = facet.points[0] as Vec3;
          const offset = { x: point.x - anchor.x, y: point.y - anchor.y, z: point.z - anchor.z };
          expect(dot(offset, facet.normal)).toBeLessThan(0.2);
        }
      }
      expect(Math.hypot(seam.normal.x, seam.normal.y, seam.normal.z)).toBeCloseTo(1);
    }
  });
});
