/**
 * Which clip the robot should be playing. Pure, so the choice can be tested
 * without a skeleton.
 */

export type Locomotion = 'Idle' | 'Walking' | 'Running';
export type Gesture = 'Wave' | 'Yes' | 'ThumbsUp';

const ROBOT_HEIGHT = 2.05;
/** Height of the model in its idle pose, measured from its vertices. */
const MODEL_HEIGHT = 4.44;
export const ROBOT_SCALE = ROBOT_HEIGHT / MODEL_HEIGHT;

/**
 * How fast a planted foot travels backwards at normal playback, in model units
 * per second, read from the foot bones' tracks. Moving at this speed the feet
 * do not slide.
 */
const STANCE_SPEED = { Walking: 3.8, Running: 6.35 } as const;

/** World speed that each clip matches at normal playback. */
export const CLIP_SPEED: Record<Exclude<Locomotion, 'Idle'>, number> = {
  Walking: STANCE_SPEED.Walking * ROBOT_SCALE,
  Running: STANCE_SPEED.Running * ROBOT_SCALE,
};

/**
 * Playback limits per clip. Past the top the legs blur, and sliding reads better;
 * the Running clip can take more because its feet are planted for an eighth of
 * the cycle, against nearly half for the Walking clip.
 */
const PLAYBACK: Record<Exclude<Locomotion, 'Idle'>, { min: number; max: number }> = {
  Walking: { min: 0.5, max: 2.6 },
  Running: { min: 1.2, max: 2.9 },
};

/**
 * Speeds at which the walk starts and stops, and the run. Each pair is apart, so
 * the clip cannot flicker. The run takes over well below the walking speed of
 * 6.5 because that speed is more than three body lengths a second: physically a
 * run, and the Walking clip would need 3.7x playback to keep its feet planted.
 */
const START_WALKING = 0.7;
const STOP_WALKING = 0.35;
const START_RUNNING = 4.4;
const STOP_RUNNING = 3.9;

export function chooseLocomotion(speed: number, current: Locomotion): Locomotion {
  if (current === 'Running') {
    if (speed >= STOP_RUNNING) return 'Running';
    return speed > STOP_WALKING ? 'Walking' : 'Idle';
  }
  if (speed >= START_RUNNING) return 'Running';
  if (current === 'Walking') return speed > STOP_WALKING ? 'Walking' : 'Idle';
  return speed >= START_WALKING ? 'Walking' : 'Idle';
}

export function playbackRate(clip: Locomotion, speed: number): number {
  if (clip === 'Idle') return 1;
  const { min, max } = PLAYBACK[clip];
  return Math.min(max, Math.max(min, speed / CLIP_SPEED[clip]));
}

/** Between gestures while explaining, so it never looks scripted. */
const GESTURE_GAP_MIN = 5;
const GESTURE_GAP_SPREAD = 4;

export function nextGestureDelay(random: number): number {
  return GESTURE_GAP_MIN + GESTURE_GAP_SPREAD * random;
}

/** Waves on arrival, then alternates a nod and a thumbs-up. */
export function nextGesture(previous: Gesture | null): Gesture {
  if (previous === null) return 'Wave';
  return previous === 'Yes' ? 'ThumbsUp' : 'Yes';
}
