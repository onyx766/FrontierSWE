/**
 * Seconds of sky animation, shared by reference as a uniform by every sky shader.
 * One object, advanced once a frame, stopped for reduced motion in one place.
 */
export const skyClock = { value: 0 };
