/**
 * What each key means. Pure, so the rules about when a key belongs to the world
 * and when it belongs to the page can be tested without a browser.
 *
 * Movement uses `event.code`, the physical key, so WASD stays a cluster on any
 * keyboard layout. `?` uses `event.key`, because it is a character rather than a
 * position: it sits somewhere different on nearly every layout.
 */

export type HeldKey = 'forward' | 'back' | 'left' | 'right' | 'run';

export type KeyCommand = 'jump' | 'advance' | 'previous' | 'escape' | 'tour' | 'overview' | 'help';

const HELD_KEYS: Readonly<Record<string, HeldKey>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

const COMMAND_KEYS: Readonly<Record<string, KeyCommand>> = {
  Space: 'jump',
  KeyE: 'advance',
  Enter: 'advance',
  NumpadEnter: 'advance',
  KeyQ: 'previous',
  Escape: 'escape',
  KeyT: 'tour',
  KeyC: 'overview',
};

export function heldKeyFor(code: string): HeldKey | null {
  return HELD_KEYS[code] ?? null;
}

export function commandFor(code: string, key: string): KeyCommand | null {
  if (key === '?') return 'help';
  return COMMAND_KEYS[code] ?? null;
}

/** The arrow keys scroll the page unless told otherwise. */
export function isArrowKey(code: string): boolean {
  return code.startsWith('Arrow');
}

/** The commands that Enter and Space trigger, which a focused control must keep. */
export function isActivationKey(code: string): boolean {
  return code === 'Enter' || code === 'NumpadEnter' || code === 'Space';
}

export interface MoveAxes {
  /** −1 left to 1 right. */
  x: number;
  /** −1 towards the camera to 1 away from it. */
  y: number;
}

/** Axes from the physical keys currently down. Opposite keys cancel. */
export function axesFromKeys(codes: Iterable<string>): MoveAxes {
  const down = new Set<HeldKey>();
  for (const code of codes) {
    const held = heldKeyFor(code);
    if (held) down.add(held);
  }
  return {
    x: (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0),
    y: (down.has('forward') ? 1 : 0) - (down.has('back') ? 1 : 0),
  };
}

export function isRunHeld(codes: Iterable<string>): boolean {
  for (const code of codes) {
    if (heldKeyFor(code) === 'run') return true;
  }
  return false;
}

/** The parts of an event target that decide who a key belongs to. */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

/** True when typing is going on here, so every key belongs to the field. */
export function isTextEntry(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** True when Enter and Space already do something here: a link, button or similar. */
export function isActivatable(target: KeyTarget | null): boolean {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'A' || tag === 'BUTTON' || tag === 'SUMMARY') return true;
  const role = target.getAttribute?.('role');
  return role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem';
}

/** A key held with one of these is a browser shortcut, not a move. Shift is a move. */
export function isBrowserChord(event: {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.ctrlKey || event.altKey || event.metaKey;
}
