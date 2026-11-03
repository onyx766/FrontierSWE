import { describe, expect, it } from 'vitest';
import { islands } from '@/data/universe';
import { ringHeight, ROAD_WIDTH, WORLD, type RoadEdge } from '@/universe/world/network';
import { distanceXZ, polar, type Vec3 } from '@/universe/world/vec';
import { world } from '@/universe/world/world';
import { buildRoads } from '../buildRoads';
import { deckCover, findCrossings, islandProximity, railRuns, warmthAt } from '../layout';
import { DECK_FAMILIES } from '../roadTypes';
import { ROAD_SECTIONS } from '../sections';
import { buildFrames, refine, type Frame, type MeshBuffer } from '../sweep';
import { planTraffic, PATH_SAMPLES } from '../trafficPlan';

const { network, surface } = world;
const build = buildRoads(network, surface);
const edgesOf = (style: RoadEdge['style']) => network.edges.filter((edge) => edge.style === style);

function buffers(): [string, MeshBuffer][] {
  return [
    ...DECK_FAMILIES.map((family): [string, MeshBuffer] => [family, build.decks[family]]),
    ['hull', build.hull],
    ['lights', build.lights],
    ['decals', build.decals],
    ['plates', build.plates],
  ];
}

describe('the assembled roads', () => {
  it('produces finite geometry with indices in range', () => {
    for (const [name, buffer] of buffers()) {
      expect(buffer.vertexCount, name).toBeGreaterThan(0);
      const finite = (values: number[]) => values.every((value) => Number.isFinite(value));
      expect(finite(buffer.positions), name).toBe(true);
      expect(finite(buffer.normals), name).toBe(true);
      expect(finite(buffer.uvs), name).toBe(true);
      expect(finite(buffer.lights), name).toBe(true);
      expect(buffer.indices.every((index) => index < buffer.vertexCount), name).toBe(true);
    }
  });

  it('keeps strip spreads aligned with the strip vertices', () => {
    build.lights.padSpreads();
    expect(build.lights.spreads.length).toBe(build.lights.vertexCount * 4);
  });

  it('stays well inside the scene budget', () => {
    const triangles = buffers().reduce((sum, [, buffer]) => sum + buffer.triangleCount, 0);
    expect(triangles).toBeLessThan(130_000);
    expect(build.posts.length).toBeLessThan(1000);
    expect(build.glows.length).toBeLessThan(128);
  });
});

describe('rails and posts', () => {
  it('never stand inside a walkable surface', () => {
    for (const post of build.posts) {
      expect(surface.contains(post.x, post.y, post.z), `post at ${post.x},${post.z}`).toBe(false);
    }
  });

  it('leave the whole walkable width clear on every elevated road', () => {
    for (const style of ['ring', 'spoke', 'coreLoop', 'helix'] as const) {
      const offset = ROAD_SECTIONS[style].railOffset as number;
      expect(offset, style).toBeGreaterThan(ROAD_WIDTH[style] / 2 - 0.55 + 0.25);
    }
  });

  it('stop at island rims', () => {
    for (const post of build.posts) expect(deckCover(post.x, post.z)).toBe(0);
  });

  it('open where other roads join, on both sides of the Ring at a Spoke', () => {
    const ring = edgesOf('ring')[0] as RoadEdge;
    const frames = buildFrames(refine(ring.points));
    const offset = ROAD_SECTIONS.ring.railOffset as number;
    for (const side of [-1, 1]) {
      const runs = railRuns(frames, offset * side, surface);
      expect(runs.length, `side ${side}`).toBeGreaterThan(0);
      expect(runs[0]?.from ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('crossings', () => {
  it('finds one bridge and one underpass on every Helix leg', () => {
    for (const leg of edgesOf('helix')) {
      const crossings = findCrossings(buildFrames(refine(leg.points)));
      expect(crossings.map((crossing) => crossing.kind).sort(), leg.id).toEqual(['over', 'under']);
    }
  });

  it('sets portal stations outside the Ring on both sides', () => {
    for (const leg of edgesOf('helix')) {
      const frames = buildFrames(refine(leg.points));
      for (const crossing of findCrossings(frames)) {
        const outer = frames[crossing.outer] as Frame;
        const inner = frames[crossing.inner] as Frame;
        expect(Math.hypot(outer.x, outer.z)).toBeGreaterThan(
          WORLD.ringRadius + ROAD_WIDTH.ring / 2,
        );
        expect(Math.hypot(inner.x, inner.z)).toBeLessThan(WORLD.ringRadius - ROAD_WIDTH.ring / 2);
      }
    }
  });
});

describe('junctions', () => {
  it('draws no plate over a station pad', () => {
    const pads = network.junctions.filter((junction) => junction.kind === 'pad');
    expect(pads.length).toBeGreaterThan(0);
    const positions = build.plates.positions;
    for (const pad of pads) {
      for (let i = 0; i < positions.length; i += 3) {
        const point: Vec3 = {
          x: positions[i] as number,
          y: positions[i + 1] as number,
          z: positions[i + 2] as number,
        };
        expect(distanceXZ(point, pad.position)).toBeGreaterThan(0.5);
      }
    }
  });
});

describe('light along the Ring', () => {
  it('follows the reference: hot by the Experience Archive, cool by the Backend Engine', () => {
    const at = (id: string) => {
      const island = islands.find((entry) => entry.id === id);
      return warmthAt(island?.bearing ?? 0);
    };
    expect(at('experience-archive')).toBeGreaterThan(0.8);
    expect(at('backend-engine')).toBeLessThan(0.2);
  });

  it('is continuous all the way round', () => {
    for (let bearing = 0; bearing < 360; bearing += 1) {
      expect(Math.abs(warmthAt(bearing + 1) - warmthAt(bearing))).toBeLessThan(0.06);
    }
  });

  it('peaks at the islands and falls away midway between them', () => {
    expect(islandProximity(60)).toBeCloseTo(1, 5);
    expect(islandProximity(30)).toBeCloseTo(0, 5);
  });
});

describe('traffic', () => {
  const plan = planTraffic(network);

  it('runs 100 to 160 packets', () => {
    expect(plan.packets.length).toBeGreaterThanOrEqual(100);
    expect(plan.packets.length).toBeLessThanOrEqual(160);
  });

  it('samples every path to the texture width, on the road', () => {
    for (const path of plan.paths) {
      expect(path.points).toHaveLength(PATH_SAMPLES);
      for (const point of path.points) {
        const hit = surface.resolve(point.x, point.z, point.y);
        expect(hit, `${point.x},${point.z}`).not.toBeNull();
      }
    }
  });

  it('closes the Ring and Core Loop paths on themselves', () => {
    const closed = plan.paths.filter((path) => path.closed);
    expect(closed).toHaveLength(2);
    for (const path of closed) {
      const first = path.points[0] as Vec3;
      const last = path.points[path.points.length - 1] as Vec3;
      expect(distanceXZ(first, last)).toBeLessThan(0.01);
    }
  });

  it('puts each packet on a real path', () => {
    for (const packet of plan.packets) {
      expect(plan.paths[packet.path]).toBeDefined();
      expect(packet.speed).not.toBe(0);
    }
  });
});

describe('deck cover', () => {
  it('is full on an island and clear between them', () => {
    const island = islands[0];
    if (!island) throw new Error('no islands');
    const center = polar(WORLD.islandOrbit, island.bearing);
    expect(deckCover(center.x, center.z)).toBe(1);
    const between = polar(WORLD.ringRadius, island.bearing + 30, ringHeight(island.bearing + 30));
    expect(deckCover(between.x, between.z)).toBe(0);
  });
});
