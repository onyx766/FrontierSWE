'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { hudCopy, type StationContent } from '@/data/universe';
import { cn } from '@/lib/utils';
import { useUniverse } from '../state/store';
import { ACCENT_HEX } from './colors';
import { focusBriefingOnArrival, logHeadingId, logRowId } from './focus';
import { CheckIcon, ChevronDownIcon } from './icons';
import { stationCount, stationGroups, stationHref } from './stations';
import { useMediaQuery } from './useMediaQuery';

const NARROW_QUERY = '(max-width: 767px)';

function StationRow({
  station,
  onTravel,
}: {
  station: StationContent;
  onTravel: () => void;
}) {
  const visited = useUniverse((state) => state.visited.includes(station.id));
  const heading = useUniverse((state) => state.travel === station.id);
  const here = useUniverse((state) => state.near === station.id);

  /*
   * The row is a real link, for crawlers and for browsers with no world to walk
   * in. Once the world is running, a plain click walks there instead; a modified
   * click still opens the page, as a visitor expects of a link.
   */
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const { phase, webgl, travelTo } = useUniverse.getState();
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (phase === 'loading' || webgl === 'failed' || modified) return;

    event.preventDefault();
    if (event.detail === 0) focusBriefingOnArrival(station.id);
    travelTo(station.id);
    onTravel();
  };

  return (
    <li>
      <Link
        id={logRowId(station.id)}
        href={stationHref(station)}
        prefetch={false}
        onClick={onClick}
        aria-current={here ? 'location' : undefined}
        className="uh-log-row"
        data-state={here ? 'here' : heading ? 'heading' : visited ? 'visited' : 'new'}
      >
        <span className="uh-log-mark" aria-hidden>
          {visited ? <CheckIcon className="size-2.5" strokeWidth="2.4" /> : null}
        </span>
        <span className="min-w-0 flex-1">{station.title}</span>{' '}
        {here ? <span className="uh-log-here">{hudCopy.log.here}</span> : null}{' '}
        {visited ? <span className="sr-only">{hudCopy.log.explored}</span> : null}
      </Link>
    </li>
  );
}

/**
 * Every stop in the world, always in the DOM. It is a complete keyboard route:
 * each row walks to its station, whose briefing then opens and links on to the
 * full case study.
 */
export function MissionLog() {
  const explored = useUniverse((state) => state.visited.length);
  const touch = useUniverse((state) => state.touch);
  const reading = useUniverse((state) => state.active !== null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [choice, setChoice] = useState<boolean | null>(null);

  /*
   * During a briefing the list folds away, so the robot and its hologram are not
   * covered. The visitor's own choice, once they make one, always wins.
   */
  const compact = touch || narrow;
  const expanded = choice ?? !(compact || reading);
  const toggleLabel = expanded ? hudCopy.log.hide : hudCopy.log.show;

  return (
    <section id="mission-log" className="uh-log uh-glass" aria-label={hudCopy.log.title}>
      <h2 className="m-0 tracking-normal">
        <button
          id={logHeadingId()}
          type="button"
          className="uh-log-head"
          aria-expanded={expanded}
          aria-controls="mission-log-list"
          title={toggleLabel}
          onClick={() => setChoice(!expanded)}
        >
          <span className="uh-log-title">{hudCopy.log.title}</span>{' '}
          <span className="uh-log-count">
            {explored} of {stationCount} {hudCopy.log.explored}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-3 shrink-0 text-[#8d94a1] transition-transform duration-300',
              expanded && 'rotate-180',
            )}
          />
        </button>
      </h2>

      <div className="uh-log-progress" aria-hidden>
        <div style={{ transform: `scaleX(${explored / stationCount})` }} />
      </div>

      <div id="mission-log-list" className="uh-log-list" hidden={!expanded}>
        {stationGroups.map((group) => (
          <div key={group.id} className="uh-log-group">
            <h3 className="uh-log-group-title">
              <span
                className="uh-log-group-dot"
                aria-hidden
                style={{ background: group.accent ? ACCENT_HEX[group.accent] : '#eaf2ff' }}
              />
              {group.label}
            </h3>
            <ul>
              {group.stations.map((station) => (
                <StationRow
                  key={station.id}
                  station={station}
                  onTravel={() => {
                    if (compact) setChoice(false);
                  }}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
