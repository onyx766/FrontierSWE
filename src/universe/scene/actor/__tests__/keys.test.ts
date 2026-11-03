import { describe, expect, it } from 'vitest';
import {
  axesFromKeys,
  commandFor,
  heldKeyFor,
  isActivatable,
  isActivationKey,
  isArrowKey,
  isBrowserChord,
  isRunHeld,
  isTextEntry,
} from '../keys';

describe('key meanings', () => {
  it('maps WASD and the arrows to the same four directions', () => {
    expect(heldKeyFor('KeyW')).toBe('forward');
    expect(heldKeyFor('ArrowUp')).toBe('forward');
    expect(heldKeyFor('KeyS')).toBe('back');
    expect(heldKeyFor('ArrowDown')).toBe('back');
    expect(heldKeyFor('KeyA')).toBe('left');
    expect(heldKeyFor('ArrowLeft')).toBe('left');
    expect(heldKeyFor('KeyD')).toBe('right');
    expect(heldKeyFor('ArrowRight')).toBe('right');
  });

  it('treats either Shift as run, and nothing else', () => {
    expect(heldKeyFor('ShiftLeft')).toBe('run');
    expect(heldKeyFor('ShiftRight')).toBe('run');
    expect(heldKeyFor('KeyZ')).toBeNull();
  });

  it('maps the commands', () => {
    expect(commandFor('Space', ' ')).toBe('jump');
    expect(commandFor('KeyE', 'e')).toBe('advance');
    expect(commandFor('Enter', 'Enter')).toBe('advance');
    expect(commandFor('NumpadEnter', 'Enter')).toBe('advance');
    expect(commandFor('KeyQ', 'q')).toBe('previous');
    expect(commandFor('Escape', 'Escape')).toBe('escape');
    expect(commandFor('KeyT', 't')).toBe('tour');
    expect(commandFor('KeyC', 'c')).toBe('overview');
    expect(commandFor('KeyX', 'x')).toBeNull();
  });

  it('finds ? by the character it types, wherever a layout puts it', () => {
    expect(commandFor('Slash', '?')).toBe('help');
    expect(commandFor('Minus', '?')).toBe('help');
    expect(commandFor('Slash', '/')).toBeNull();
  });

  it('knows which keys need their default suppressed or kept', () => {
    expect(isArrowKey('ArrowLeft')).toBe(true);
    expect(isArrowKey('KeyA')).toBe(false);
    expect(isActivationKey('Space')).toBe(true);
    expect(isActivationKey('Enter')).toBe(true);
    expect(isActivationKey('KeyE')).toBe(false);
  });
});

describe('held keys to axes', () => {
  it('reads each direction', () => {
    expect(axesFromKeys(['KeyW'])).toEqual({ x: 0, y: 1 });
    expect(axesFromKeys(['ArrowDown'])).toEqual({ x: 0, y: -1 });
    expect(axesFromKeys(['KeyA'])).toEqual({ x: -1, y: 0 });
    expect(axesFromKeys(['ArrowRight'])).toEqual({ x: 1, y: 0 });
  });

  it('cancels opposite keys', () => {
    expect(axesFromKeys(['KeyW', 'KeyS'])).toEqual({ x: 0, y: 0 });
    expect(axesFromKeys(['KeyA', 'ArrowRight'])).toEqual({ x: 0, y: 0 });
  });

  it('does not double up two keys for one direction', () => {
    expect(axesFromKeys(['KeyW', 'ArrowUp'])).toEqual({ x: 0, y: 1 });
  });

  it('reads run', () => {
    expect(isRunHeld(['KeyW', 'ShiftRight'])).toBe(true);
    expect(isRunHeld(['KeyW'])).toBe(false);
  });
});

describe('who a key belongs to', () => {
  it('leaves typing alone', () => {
    expect(isTextEntry({ tagName: 'INPUT' })).toBe(true);
    expect(isTextEntry({ tagName: 'textarea' })).toBe(true);
    expect(isTextEntry({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntry({ tagName: 'DIV' })).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });

  it('leaves Enter and Space to a focused control', () => {
    expect(isActivatable({ tagName: 'A' })).toBe(true);
    expect(isActivatable({ tagName: 'BUTTON' })).toBe(true);
    expect(isActivatable({ tagName: 'SUMMARY' })).toBe(true);
    expect(isActivatable({ tagName: 'DIV', getAttribute: () => 'button' })).toBe(true);
    expect(isActivatable({ tagName: 'DIV', getAttribute: () => null })).toBe(false);
    expect(isActivatable({ tagName: 'BODY' })).toBe(false);
    expect(isActivatable(null)).toBe(false);
  });

  it('counts Ctrl, Alt and Meta as browser shortcuts, but not Shift', () => {
    expect(isBrowserChord({ ctrlKey: true, altKey: false, metaKey: false })).toBe(true);
    expect(isBrowserChord({ ctrlKey: false, altKey: true, metaKey: false })).toBe(true);
    expect(isBrowserChord({ ctrlKey: false, altKey: false, metaKey: true })).toBe(true);
    expect(isBrowserChord({ ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
  });
});
