/**
 * Focus hand-offs between the mission log and the briefing panel.
 *
 * Opening a briefing normally leaves focus alone: a visitor walking with the
 * keyboard must not have it pulled into the panel, where Space would press a
 * button instead of jumping. A keyboard visitor who set off from the mission log
 * is different. Their next task is the briefing, so it receives focus on
 * arrival and gives it back to their row when it closes.
 */

let awaitingArrival: string | null = null;

export function logRowId(stationId: string): string {
  return `log-row-${stationId}`;
}

export function logHeadingId(): string {
  return 'mission-log-heading';
}

/** Remember that this station's briefing should take focus when it opens. */
export function focusBriefingOnArrival(stationId: string): void {
  awaitingArrival = stationId;
}

/** True once, for the station a keyboard visitor set off towards. */
export function claimArrivalFocus(stationId: string): boolean {
  const claimed = awaitingArrival === stationId;
  if (claimed) awaitingArrival = null;
  return claimed;
}

/** Back to the station's row, or to the log's heading when the list is collapsed. */
export function returnFocusToLog(stationId: string): void {
  const row = document.getElementById(logRowId(stationId));
  if (row && row.offsetParent !== null) row.focus();
  else document.getElementById(logHeadingId())?.focus();
}
