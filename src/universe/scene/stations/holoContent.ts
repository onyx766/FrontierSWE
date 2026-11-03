import { domains } from '@/data/domains';
import type { StationContent } from '@/data/universe';
import type { ArchitectureSpec } from '@/lib/types';
import type { Beat, Briefing } from '../../world/beats';
import { firstSentences } from '../../world/beats';

/**
 * What the hologram shows of a beat.
 *
 * The briefing panel carries the full text. The hologram is the physical object
 * in the world, so it gets a compact version: short enough to read from a few
 * metres away, and always the same words the panel uses.
 */

export interface HoloLine {
  text: string;
  /** A short line beneath it, when the panel has the room. */
  note?: string;
}

export interface HoloCopy {
  eyebrow: string;
  title: string;
  kicker: string;
  /** Null when it would only repeat `title`. */
  heading: string | null;
  lines: HoloLine[];
  /** True when `lines` is a list rather than prose. */
  isList: boolean;
  /** Technologies and similar tags, on one wrapped line. */
  tags: string | null;
  /** 1-based position in the briefing. */
  page: number;
  pages: number;
}

/** A panel shared with a model has a narrow text column; a text-only one has the width. */
const LIMITS = {
  narrow: { list: 4, line: 64, prose: 172 },
  wide: { list: 6, line: 64, prose: 300 },
} as const;
/** Above this many lines there is only room for each line, not a note beneath it. */
const NOTED_LINES = 4;
const NOTE_LIMIT = 74;
const TAG_LIMIT = 6;

/** Cuts `text` at a word boundary so that it fits in `limit` characters. */
export function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  const kept = space > limit * 0.5 ? cut.slice(0, space) : cut.slice(0, limit - 1);
  return `${kept.replace(/[\s,;:.–—-]+$/, '')}…`;
}

function beatLines(beat: Beat, wide: boolean): { lines: HoloLine[]; isList: boolean } {
  /* The architecture beat gives the display to the model; the panel has the prose. */
  if (beat.architecture) return { lines: [], isList: false };

  const limits = wide ? LIMITS.wide : LIMITS.narrow;

  if (beat.items?.length) {
    const items = beat.items.slice(0, limits.list);
    const noted = wide && items.length <= NOTED_LINES;
    return {
      lines: items.map((item) => ({
        text: clip(item.title, limits.line),
        ...(noted ? { note: clip(firstSentences(item.body, NOTE_LIMIT), NOTE_LIMIT) } : {}),
      })),
      isList: true,
    };
  }
  if (beat.metrics?.length) {
    return {
      lines: beat.metrics
        .slice(0, limits.list)
        .map((metric) => ({ text: clip(`${metric.label}: ${metric.value}`, limits.line) })),
      isList: true,
    };
  }
  if (beat.bullets?.length) {
    return {
      lines: beat.bullets.slice(0, 3).map((bullet) => ({ text: clip(bullet, limits.line) })),
      isList: true,
    };
  }
  if (beat.body) {
    /* `firstSentences` always keeps the first sentence, however long that is. */
    const text = clip(firstSentences(beat.body, limits.prose), limits.prose);
    return { lines: [{ text }], isList: false };
  }
  return { lines: [], isList: false };
}

export function holoCopy(briefing: Briefing, beatIndex: number, wide = false): HoloCopy {
  const index = Math.max(0, Math.min(briefing.beats.length - 1, beatIndex));
  const beat = briefing.beats[index] as Beat;
  const tags = beat.chips?.length ? beat.chips.slice(0, TAG_LIMIT).join(' · ') : null;

  return {
    eyebrow: briefing.eyebrow,
    title: briefing.title,
    kicker: beat.kicker,
    heading: beat.title === briefing.title ? null : beat.title,
    ...beatLines(beat, wide),
    tags,
    page: index + 1,
    pages: briefing.beats.length,
  };
}

/**
 * The diagram a station's hologram carries, if it has one: a project's declared
 * architecture, or a domain's sub-architecture with each column as a row. Domains
 * declare no request path, so their models have wires but no travelling packet.
 */
export function stationModelSpec(
  station: StationContent,
  briefing: Briefing,
): ArchitectureSpec | null {
  const declared = briefing.beats.find((beat) => beat.architecture)?.architecture;
  if (declared) return declared;
  if (station.subject.type !== 'domain') return null;

  const { nodes, edges } = domains[station.subject.domain].subArchitecture;
  const columns = [...new Set(nodes.map((node) => node.column))].sort((a, b) => a - b);

  return {
    layers: columns.map((column) => ({
      label: '',
      nodes: nodes
        .filter((node) => node.column === column)
        .sort((a, b) => a.row - b.row)
        .map(({ id, label, tone }) => ({ id, label, ...(tone ? { tone } : {}) })),
    })),
    edges,
    paths: [],
  };
}
