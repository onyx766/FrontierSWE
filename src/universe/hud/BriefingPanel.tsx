'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PlaceholderChip } from '@/components/primitives/Chip';
import { MiniArchitecture } from '@/components/system/MiniArchitecture';
import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';
import type { Beat, Briefing } from '../world/beats';
import { world } from '../world/world';
import { claimArrivalFocus, returnFocusToLog } from './focus';
import { ArrowUpRightIcon, CloseIcon } from './icons';

const PLACEHOLDER_NOTE = /(\[PLACEHOLDER[^\]]*\])/g;

/**
 * The arrow keys walk the robot, but a visitor who tabbed into the text is reading:
 * there they scroll it. Up and down only, and never after a mouse click, so WASD
 * and casual clicks on the panel cannot take the controls away.
 */
function keepArrowsForReading(event: KeyboardEvent<HTMLDivElement>) {
  const scrolling = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  if (scrolling && event.currentTarget.matches(':focus-visible')) event.stopPropagation();
}

/** `[PLACEHOLDER …]` notes are the repo's safeguard against shipping invented detail. */
function WithNotes({ text }: { text: string }) {
  return text.split(PLACEHOLDER_NOTE).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="text-warn">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function BeatContent({ beat, hideTitle }: { beat: Beat; hideTitle: boolean }) {
  return (
    <>
      <p className="uh-beat-kicker">{beat.kicker}</p>
      {hideTitle ? null : <h3 className="uh-beat-title">{beat.title}</h3>}

      {beat.body ? (
        <p className="uh-beat-body">
          <WithNotes text={beat.body} />
        </p>
      ) : null}

      {beat.architecture ? (
        <figure className="uh-beat-diagram">
          <MiniArchitecture spec={beat.architecture} className="block h-auto w-full" />
        </figure>
      ) : null}

      {beat.bullets ? (
        <ul className="uh-beat-bullets">
          {beat.bullets.map((bullet) => (
            <li key={bullet}>
              <WithNotes text={bullet} />
            </li>
          ))}
        </ul>
      ) : null}

      {beat.items ? (
        <ul className="uh-beat-items">
          {beat.items.map((item) => (
            <li key={item.title}>
              <p className="uh-beat-item-title">{item.title}</p>
              <p className="uh-beat-item-body">
                <WithNotes text={item.body} />
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {beat.metrics?.length ? (
        <dl className="uh-beat-metrics">
          {beat.metrics.map((metric) => (
            <div key={metric.label}>
              <dd>
                <WithNotes text={metric.value} />
              </dd>
              <dt>
                <WithNotes text={metric.label} />
              </dt>
              {metric.placeholder ? <PlaceholderChip className="mt-1.5" /> : null}
            </div>
          ))}
        </dl>
      ) : null}

      {beat.chips?.length ? (
        <ul className="uh-beat-chips">
          {beat.chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      ) : null}

      {beat.link ? (
        <Link href={beat.link.href} className="uh-beat-link">
          {beat.link.label}
          <ArrowUpRightIcon className="size-3" />
        </Link>
      ) : null}
    </>
  );
}

function BeatTabs({ briefing, current }: { briefing: Briefing; current: number }) {
  if (briefing.beats.length < 2) return null;
  return (
    <nav aria-label={hudCopy.briefing.beats} className="uh-beat-tabs">
      {briefing.beats.map((beat, index) => (
        <button
          key={beat.id}
          type="button"
          className="uh-beat-tab"
          data-done={index <= current}
          aria-current={index === current ? 'step' : undefined}
          aria-label={`${hudCopy.briefing.goTo} ${beat.kicker}`}
          title={beat.kicker}
          onClick={() => useUniverse.getState().goToBeat(index)}
        />
      ))}
    </nav>
  );
}

function PanelFooter({ briefing, current }: { briefing: Briefing; current: number }) {
  const touring = useUniverse((state) => state.touring);
  const last = briefing.beats.length - 1;
  const atEnd = current >= last;

  if (last === 0 && !touring) return null;

  /* `aria-disabled` rather than `disabled`, which would throw away keyboard focus. */
  const canGoBack = current > 0;
  const canGoOn = !atEnd || touring;

  return (
    <footer className="uh-panel-foot">
      <button
        type="button"
        className="uh-panel-step"
        aria-disabled={!canGoBack}
        onClick={() => useUniverse.getState().previousBeat()}
      >
        <kbd className="uh-key">Q</kbd>
        {hudCopy.briefing.back}
      </button>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#8d94a1] tabular-nums">
        {current + 1} / {last + 1}
      </span>
      <button
        type="button"
        className="uh-panel-step uh-panel-step-primary"
        aria-disabled={!canGoOn}
        onClick={() => useUniverse.getState().nextBeat()}
      >
        {atEnd && touring ? hudCopy.briefing.nextStop : hudCopy.briefing.next}
        <kbd className="uh-key">E</kbd>
      </button>
    </footer>
  );
}

/**
 * The main content surface: what the robot is explaining, in full. It stays
 * mounted, holding the last station, so that it can slide out with its content
 * still on it. Beats change with a CSS animation, restarted by keying the content
 * inside the scroller; the scroller itself stays, so that it keeps keyboard focus.
 */
export function BriefingPanel() {
  const active = useUniverse((state) => state.active);
  const beatIndex = useUniverse((state) => state.beat);

  const panel = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState({ station: active, beat: beatIndex });
  if (active !== null && (active !== shown.station || beatIndex !== shown.beat)) {
    setShown({ station: active, beat: beatIndex });
  }

  const previous = useRef(active);
  useEffect(() => {
    const before = previous.current;
    previous.current = active;

    if (active !== null && claimArrivalFocus(active)) {
      title.current?.focus();
    } else if (active === null && before !== null) {
      if (panel.current?.contains(document.activeElement)) returnFocusToLog(before);
    }
  }, [active]);

  const briefing = shown.station === null ? null : world.briefing(shown.station);
  const current = briefing ? Math.min(shown.beat, briefing.beats.length - 1) : 0;
  const beat = briefing?.beats[current];

  useEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [shown.station, current]);

  return (
    <section
      ref={panel}
      role="region"
      aria-labelledby="uh-briefing-title"
      className="uh-panel uh-glass"
      data-open={active !== null}
    >
      <p className="sr-only" aria-live="polite">
        {active !== null ? briefing?.title : ''}
      </p>

      {briefing && beat ? (
        <>
          <header className="uh-panel-head">
            <div className="flex items-start justify-between gap-3">
              <p className="uh-panel-eyebrow">{briefing.eyebrow}</p>
              <button
                type="button"
                className="uh-panel-close"
                aria-label={hudCopy.briefing.close}
                onClick={() => useUniverse.getState().closeBriefing()}
              >
                <kbd className="uh-key">Esc</kbd>
                <CloseIcon className="size-3.5" />
              </button>
            </div>
            <h2 ref={title} id="uh-briefing-title" tabIndex={-1} className="uh-panel-title">
              {briefing.title}
            </h2>
            {briefing.placeholder ? <PlaceholderChip className="mt-2" /> : null}
            <BeatTabs briefing={briefing} current={current} />
          </header>

          <div
            ref={body}
            className="uh-panel-body"
            role="group"
            aria-label={beat.kicker}
            tabIndex={0}
            onKeyDown={keepArrowsForReading}
          >
            <div key={`${briefing.stationId}:${beat.id}`} className="uh-panel-beat">
              <BeatContent beat={beat} hideTitle={beat.title === briefing.title} />
            </div>
          </div>

          <PanelFooter briefing={briefing} current={current} />
        </>
      ) : null}
    </section>
  );
}
