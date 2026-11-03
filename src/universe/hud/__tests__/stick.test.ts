import { describe, expect, it } from 'vitest';
import { stickVector } from '../stick';

describe('stickVector', () => {
  it('ignores a thumb resting near the centre', () => {
    expect(stickVector(5, -5, 60)).toEqual({ x: 0, y: 0 });
  });

  it('maps pushing the stick up to walking away from the camera', () => {
    const { x, y } = stickVector(0, -60, 60);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it('maps pushing right to walking right', () => {
    const { x, y } = stickVector(60, 0, 60);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });

  it('never leaves the unit circle, however far the thumb strays', () => {
    const { x, y } = stickVector(400, -300, 60);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });

  it('rises smoothly from the edge of the dead zone', () => {
    const justOutside = stickVector(0, -10, 60);
    const further = stickVector(0, -40, 60);
    expect(justOutside.y).toBeGreaterThan(0);
    expect(justOutside.y).toBeLessThan(0.1);
    expect(further.y).toBeGreaterThan(justOutside.y);
  });
});
