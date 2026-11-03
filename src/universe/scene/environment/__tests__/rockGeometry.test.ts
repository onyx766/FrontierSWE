import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createRockGeometry, type RockOptions } from '../rockGeometry';

const options: RockOptions = {
  seed: 42,
  detail: 4,
  cuts: 12,
  craters: 8,
  roughness: 1,
  stretch: [1, 1, 1],
};

function radii(geometry: THREE.BufferGeometry): number[] {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const point = new THREE.Vector3();
  return Array.from({ length: positions.count }, (_, index) =>
    point.fromBufferAttribute(positions, index).length(),
  );
}

describe('createRockGeometry', () => {
  it('is a pure function of its seed', () => {
    const a = createRockGeometry(options).getAttribute('position').array;
    const b = createRockGeometry(options).getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('gives different rocks for different seeds', () => {
    const a = createRockGeometry(options).getAttribute('position').array;
    const b = createRockGeometry({ ...options, seed: 43 }).getAttribute('position').array;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('stays a closed lumpy solid: no spike or hole through the middle', () => {
    const lengths = radii(createRockGeometry(options));
    expect(Math.min(...lengths)).toBeGreaterThan(0.3);
    expect(Math.max(...lengths)).toBeLessThan(1.6);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(0.15);
  });

  it('has the triangle count the detail promises', () => {
    const positions = createRockGeometry(options).getAttribute('position');
    expect(positions.count / 3).toBe(20 * (options.detail + 1) ** 2);
  });

  it('paints a colour for every vertex', () => {
    const geometry = createRockGeometry(options);
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
  });
});
