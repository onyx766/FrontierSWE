import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../world/vec';
import { RibbonBuilder, rgb } from '../ribbons';

function square(): Vec3[] {
  return [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
  ];
}

function tangentAt(geometry: THREE.BufferGeometry, vertex: number): THREE.Vector3 {
  return new THREE.Vector3()
    .fromBufferAttribute(geometry.getAttribute('aTangent') as THREE.BufferAttribute, vertex)
    .normalize();
}

describe('RibbonBuilder', () => {
  const style = { width: 0.2, minPixels: 2, color: () => [1, 1, 1] as const };

  it('makes one quad per segment of an open line', () => {
    const builder = new RibbonBuilder();
    builder.add(square(), style);
    const geometry = builder.build();

    expect(geometry.getAttribute('position').count).toBe(8);
    expect(geometry.index?.count).toBe(18);
  });

  it('closes a loop with a segment back to its start', () => {
    const builder = new RibbonBuilder();
    builder.add(square(), { ...style, closed: true });
    const geometry = builder.build();

    expect(geometry.getAttribute('position').count).toBe(10);
    expect(geometry.index?.count).toBe(24);
  });

  it('gives both ends of a closed loop the same tangent, so that it has no seam', () => {
    const builder = new RibbonBuilder();
    builder.add(square(), { ...style, closed: true });
    const geometry = builder.build();

    const first = tangentAt(geometry, 0);
    const last = tangentAt(geometry, geometry.getAttribute('position').count - 1);
    expect(first.distanceTo(last)).toBeLessThan(1e-6);
  });

  it('keeps several lines separate in one buffer', () => {
    const builder = new RibbonBuilder();
    builder.add(square(), style);
    builder.add(square(), style);
    const geometry = builder.build();
    const index = Array.from(geometry.index?.array ?? []);

    expect(Math.max(...index)).toBe(15);
    expect(geometry.getAttribute('aFacet').count).toBe(16);
  });

  it('stores colour above one for anything that should bloom', () => {
    const builder = new RibbonBuilder();
    builder.add(square(), { ...style, color: () => rgb('#ffffff', 3) });
    const colors = builder.build().getAttribute('aColor');

    expect(colors.getX(0)).toBeCloseTo(3);
    expect(colors.getZ(0)).toBeCloseTo(3);
  });
});
