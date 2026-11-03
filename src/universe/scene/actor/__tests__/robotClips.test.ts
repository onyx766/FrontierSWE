import { describe, expect, it } from 'vitest';
import { RUN_SPEED, WALK_SPEED } from '../walker';
import {
  chooseLocomotion,
  CLIP_SPEED,
  nextGesture,
  nextGestureDelay,
  playbackRate,
} from '../robotClips';

describe('choosing a clip by speed', () => {
  it('stands still when not moving', () => {
    expect(chooseLocomotion(0, 'Idle')).toBe('Idle');
  });

  it('walks at low speed, as a part-pushed joystick does', () => {
    expect(chooseLocomotion(2, 'Idle')).toBe('Walking');
    expect(chooseLocomotion(3, 'Walking')).toBe('Walking');
  });

  it('runs at the walking pace, which is more than three body lengths a second', () => {
    expect(chooseLocomotion(WALK_SPEED, 'Walking')).toBe('Running');
    expect(chooseLocomotion(RUN_SPEED, 'Running')).toBe('Running');
  });

  it('cannot flicker around a threshold', () => {
    /* Between the two limits, whichever clip is playing stays. */
    expect(chooseLocomotion(4.1, 'Walking')).toBe('Walking');
    expect(chooseLocomotion(4.1, 'Running')).toBe('Running');
    expect(chooseLocomotion(0.5, 'Idle')).toBe('Idle');
    expect(chooseLocomotion(0.5, 'Walking')).toBe('Walking');
  });

  it('goes straight from a run to a stop', () => {
    expect(chooseLocomotion(0.1, 'Running')).toBe('Idle');
  });
});

describe('playback speed', () => {
  it('leaves the idle alone', () => {
    expect(playbackRate('Idle', 0)).toBe(1);
  });

  it('matches the clip to the ground, so planted feet do not slide', () => {
    expect(playbackRate('Running', WALK_SPEED)).toBeCloseTo(WALK_SPEED / CLIP_SPEED.Running);
    expect(playbackRate('Walking', 3)).toBeCloseTo(3 / CLIP_SPEED.Walking);
  });

  it('stops short of a blur at a full run', () => {
    expect(playbackRate('Running', RUN_SPEED)).toBeLessThanOrEqual(2.9);
    expect(playbackRate('Running', RUN_SPEED)).toBeGreaterThan(playbackRate('Running', WALK_SPEED));
  });

  it('never drags the clip out to a crawl', () => {
    expect(playbackRate('Walking', 0.1)).toBeGreaterThanOrEqual(0.5);
  });
});

describe('gestures while explaining', () => {
  it('waves on arrival', () => {
    expect(nextGesture(null)).toBe('Wave');
  });

  it('then alternates a nod and a thumbs-up', () => {
    expect(nextGesture('Wave')).toBe('Yes');
    expect(nextGesture('Yes')).toBe('ThumbsUp');
    expect(nextGesture('ThumbsUp')).toBe('Yes');
  });

  it('waits several seconds between them', () => {
    expect(nextGestureDelay(0)).toBeGreaterThanOrEqual(5);
    expect(nextGestureDelay(1)).toBeLessThanOrEqual(9);
  });
});
