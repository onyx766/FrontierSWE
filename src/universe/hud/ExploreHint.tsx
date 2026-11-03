'use client';

import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';

/**
 * The hint on the right of the opening view. It doubles as the way in for anyone
 * who does not know to press a key: clicking or tapping it starts the walk. The
 * keyboard prompt beneath it fades in only after the opening shot has held for a
 * few seconds, so the first impression stays the composition alone.
 */
export function ExploreHint() {
  const touch = useUniverse((state) => state.touch);

  return (
    <button
      type="button"
      className="uh-hint uh-opening"
      aria-label={hudCopy.explore.action}
      onClick={() => useUniverse.getState().explore()}
    >
      {/* The wheel is its own element so that it animates on the compositor, without repainting. */}
      <span className="uh-hint-mouse" aria-hidden>
        <svg viewBox="0 0 28 43">
          <rect x="1" y="1" width="26" height="41" rx="13" />
        </svg>
        <span className="uh-hint-wheel" />
      </span>
      <span className="uh-hint-title">{hudCopy.explore.title}</span>
      <span className="uh-hint-detail">
        {touch ? hudCopy.explore.touchHint : hudCopy.explore.hint}
      </span>
      {touch ? null : (
        <span className="uh-hint-keys" aria-hidden>
          {['W', 'A', 'S', 'D'].map((key) => (
            <kbd key={key} className="uh-key">
              {key}
            </kbd>
          ))}
          <span className="uh-hint-keys-label">{hudCopy.explore.walk}</span>
        </span>
      )}
    </button>
  );
}
