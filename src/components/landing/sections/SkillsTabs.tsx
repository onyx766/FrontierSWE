'use client';

import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import styles from './Skills.module.css';

/* ── Shared selection ─────────────────────────────────────────────────────────
   The tabs sit in the content column and the cube in the heading column, so
   they can't share state through a parent; a tiny module store links them. It
   also keeps the cube's accumulated angles, so every change turns the short
   way round instead of unwinding everything turned so far. */

interface SkillsView {
  index: number;
  /** Cube rotation about X and Y in degrees, accumulated across changes. */
  x: number;
  y: number;
}

const INITIAL_VIEW: SkillsView = { index: 0, x: 0, y: 0 };
let view = INITIAL_VIEW;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getView = () => view;
const getServerView = () => INITIAL_VIEW;

/** The four side faces carry tabs 0–3; the top and bottom faces carry tabs 4 and 5. */
const SIDE_FACES = 4;

/** Signed turn from `from` to the nearest angle congruent with `to`; a half-turn tie follows the tabs' direction. */
function shortestTurn(from: number, to: number, direction: number) {
  let delta = (((to - from) % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  if (delta === 180 && direction > 0) delta = -180;
  return delta;
}

function selectSkill(index: number) {
  if (index === view.index) return;
  const direction = Math.sign(index - view.index);
  const x = index < SIDE_FACES ? 0 : index === SIDE_FACES ? -90 : 90;
  // A side face turns to the front; for the top or bottom face the cube first
  // squares up to a whole turn, so that face arrives the right way up.
  const target = index < SIDE_FACES ? -90 * index : 0;
  view = { index, x, y: view.y + shortestTurn(view.y, target, direction) };
  for (const listener of listeners) listener();
}

function useSkillsView() {
  return useSyncExternalStore(subscribe, getView, getServerView);
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

interface SkillsTabsProps {
  /** Stable ids from the data, used to build element ids. */
  ids: string[];
  /** Each tab's face (icon tile, label, caption), rendered on the server. */
  tabs: ReactNode[];
  /** Each tab's panel body, rendered on the server. */
  panels: ReactNode[];
  /** Accessible name for the tab list. */
  label: string;
}

/**
 * WAI-ARIA tabs with automatic activation: arrow keys, Home and End move focus
 * and selection together, and only the selected tab is in the tab order. The
 * server renders the first tab selected. Inactive panels are hidden by CSS
 * only once JavaScript runs, so without it every panel stays readable.
 */
export function SkillsTabs({ ids, tabs, panels, label }: SkillsTabsProps) {
  const { index: active } = useSkillsView();
  // Panels animate in only after a visitor has changed tabs, not on load.
  const [animate, setAnimate] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number, moveFocus: boolean) => {
    selectSkill(index);
    setAnimate(true);
    const tab = tabRefs.current[index];
    if (!tab) return;
    if (moveFocus) tab.focus({ preventScroll: true });
    // On phones the row scrolls sideways: centre the chosen tab in it. The
    // row is scrolled directly so the page itself never jumps.
    const scroller = scrollerRef.current;
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({
        left: tab.offsetLeft - (scroller.clientWidth - tab.offsetWidth) / 2,
        behavior: reduced ? 'auto' : 'smooth',
      });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = ids.length;
    const focused = tabRefs.current.findIndex((tab) => tab === document.activeElement);
    const from = focused === -1 ? active : focused;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (from + 1) % count;
        break;
      case 'ArrowLeft':
        next = (from - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next, true);
  };

  return (
    <div className={styles.tabs} data-animate={animate ? '' : undefined}>
      <div ref={scrollerRef} className={styles.scroller}>
        <div role="tablist" aria-label={label} className={styles.tablist} onKeyDown={onKeyDown}>
          {ids.map((id, index) => {
            const selected = index === active;
            return (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`skills-tab-${id}`}
                aria-selected={selected}
                aria-controls={`skills-panel-${id}`}
                aria-labelledby={`skills-tab-${id}-label`}
                aria-describedby={`skills-tab-${id}-caption`}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                onClick={() => select(index, false)}
              >
                {tabs[index]}
              </button>
            );
          })}
        </div>
      </div>

      {ids.map((id, index) => (
        <div
          key={id}
          role="tabpanel"
          id={`skills-panel-${id}`}
          aria-labelledby={`skills-tab-${id}-label`}
          tabIndex={0}
          data-active={index === active}
          className={styles.panel}
        >
          {panels[index]}
        </div>
      ))}
    </div>
  );
}

/* ── Cube ─────────────────────────────────────────────────────────────────── */

/** The fixed three-quarter view: the face being shown, with its top and right side. */
const VIEW_ANGLE = 'rotateX(-20deg) rotateY(-32deg)';

/**
 * Decoration for the heading column: a cube with one skill area per face that
 * turns to show whichever tab is selected. Purely visual (aria-hidden) — the
 * tabs are the control.
 */
export function SkillsCube({ faces, className }: { faces: ReactNode[]; className?: string }) {
  const { index, x, y } = useSkillsView();
  return (
    <div aria-hidden className={cn(styles.cubeStage, className)}>
      <span className={styles.cubeHalo} />
      <div className={styles.cubeFloat}>
        <div
          className={styles.cube}
          style={{ transform: `${VIEW_ANGLE} rotateX(${x}deg) rotateY(${y}deg)` } as CSSProperties}
        >
          {faces.map((face, faceIndex) => (
            <div
              // The faces are a fixed set of six that never reorder.
              key={faceIndex}
              className={styles.face}
              data-face={faceIndex}
              data-active={faceIndex === index}
            >
              {face}
            </div>
          ))}
        </div>
      </div>
      <span className={styles.cubeShadow} />
    </div>
  );
}
