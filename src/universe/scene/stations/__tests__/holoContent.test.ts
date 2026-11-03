import { describe, expect, it } from 'vitest';
import { world } from '../../../world/world';
import { buildArchitectureModel } from '../architectureModel';
import { clip, holoCopy, stationModelSpec } from '../holoContent';

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('Short line', 20)).toBe('Short line');
  });

  it('cuts at a word boundary and stays within the limit', () => {
    const clipped = clip('Queue-backed execution rather than long-lived HTTP requests', 30);
    expect(clipped.length).toBeLessThanOrEqual(30);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipped).toBe('Queue-backed execution rather…');
  });
});

describe('holoCopy', () => {
  it('produces compact copy for every beat of every station', () => {
    for (const station of world.stations) {
      const briefing = world.briefing(station.id);
      briefing.beats.forEach((beat, index) => {
        const copy = holoCopy(briefing, index);
        const label = `${station.id}/${beat.id}`;
        expect(copy.kicker, label).toBe(beat.kicker);
        expect(copy.page, label).toBe(index + 1);
        expect(copy.pages, label).toBe(briefing.beats.length);
        expect(copy.lines.length, label).toBeLessThanOrEqual(4);
        const words = copy.lines.map((line) => line.text).join('');
        expect(words.length, label).toBeLessThanOrEqual(280);
      });
    }
  });

  it('uses the extra room of a text-only panel', () => {
    const briefing = world.briefing('engineering-principles');
    expect(holoCopy(briefing, 0).lines.every((line) => line.note === undefined)).toBe(true);

    const wide = holoCopy(briefing, 0, true);
    expect(wide.lines.length).toBe(4);
    for (const line of wide.lines) {
      expect(line.note?.length).toBeGreaterThan(0);
      expect(line.note?.length).toBeLessThanOrEqual(74);
    }
  });

  it('fits a long list on a text-only panel by dropping the notes', () => {
    const wide = holoCopy(world.briefing('capability-matrix'), 0, true);
    expect(wide.lines.length).toBe(6);
    expect(wide.lines.every((line) => line.note === undefined)).toBe(true);
  });

  it('does not repeat the title in the heading', () => {
    const briefing = world.briefing('rag-knowledge-service');
    expect(holoCopy(briefing, 0).heading).toBeNull();
    expect(holoCopy(briefing, 1).heading).toBe('What needed solving');
  });

  it('stays in range when the beat is out of bounds', () => {
    const briefing = world.briefing('rag-knowledge-service');
    expect(holoCopy(briefing, 99).page).toBe(briefing.beats.length);
    expect(holoCopy(briefing, -3).page).toBe(1);
  });

  it('leaves the display to the model on the architecture beat', () => {
    const briefing = world.briefing('rag-knowledge-service');
    const index = briefing.beats.findIndex((beat) => beat.id === 'architecture');
    expect(holoCopy(briefing, index).lines).toEqual([]);
  });
});

describe('stationModelSpec', () => {
  const model = (id: string) =>
    stationModelSpec(world.station(id).content, world.briefing(id));

  it('gives a project its declared architecture', () => {
    expect(model('rag-knowledge-service')).toBe(
      world.briefing('rag-knowledge-service').beats.find((beat) => beat.architecture)?.architecture,
    );
  });

  it('gives a domain a model of its sub-architecture, one row per column', () => {
    const spec = model('domain-ai-systems');
    expect(spec?.layers.length).toBe(5);
    expect(spec?.paths).toEqual([]);
    if (!spec) throw new Error('no model');

    const built = buildArchitectureModel(spec);
    expect(built.wires.length).toBe(spec.edges.length);
    expect(built.route).toBeNull();
  });

  it('gives every other station no model', () => {
    for (const id of ['welcome', 'about-profile', 'career-timeline', 'services']) {
      expect(model(id), id).toBeNull();
    }
  });
});
