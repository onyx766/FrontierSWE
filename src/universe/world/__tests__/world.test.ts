import { describe, expect, it } from 'vitest';
import { coreStation, islands, tourOrder } from '@/data/universe';
import { projects } from '@/data/projects';
import { buildBriefing, firstSentences, stripPlaceholderNotes } from '../beats';
import { ringHeight, ROAD_WIDTH, WORLD, type RoadEdge } from '../network';
import { findRoute, nearestOnNetwork } from '../route';
import { distance, distanceXZ, polar, type Vec3 } from '../vec';
import { START_STATION_ID, world } from '../world';

const { network, surface } = world;

describe('road network', () => {
  it('connects every junction to the start of the walk', () => {
    const links = new Map<string, string[]>();
    for (const edge of network.edges) {
      links.set(edge.from, [...(links.get(edge.from) ?? []), edge.to]);
      links.set(edge.to, [...(links.get(edge.to) ?? []), edge.from]);
    }

    const start = world.station(START_STATION_ID).junction;
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of links.get(queue.pop() as string) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    const unreachable = network.junctions.map((j) => j.id).filter((id) => !seen.has(id));
    expect(unreachable).toEqual([]);
  });

  it('references only junctions that exist, and meets them exactly', () => {
    const byId = new Map(network.junctions.map((junction) => [junction.id, junction]));
    for (const edge of network.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      expect(from, edge.from).toBeDefined();
      expect(to, edge.to).toBeDefined();
      expect(distance(edge.points[0] as Vec3, (from as { position: Vec3 }).position)).toBeLessThan(
        0.01,
      );
      expect(
        distance(edge.points[edge.points.length - 1] as Vec3, (to as { position: Vec3 }).position),
      ).toBeLessThan(0.01);
    }
  });

  it('keeps every road walkable: no slope above 25°', () => {
    const steepest = network.edges.reduce((a, b) => (a.maxSlope > b.maxSlope ? a : b));
    expect(Math.atan(steepest.maxSlope) * (180 / Math.PI), steepest.id).toBeLessThan(25);
  });

  it('samples roads evenly enough for smooth meshes', () => {
    for (const edge of network.edges) {
      for (let i = 1; i < edge.points.length; i += 1) {
        const run = distance(edge.points[i - 1] as Vec3, edge.points[i] as Vec3);
        expect(run, edge.id).toBeLessThan(2.2);
      }
    }
  });

  it('keeps the Ring level across each island and humped between them', () => {
    for (const island of islands) {
      expect(ringHeight(island.bearing)).toBeCloseTo(0, 5);
      expect(ringHeight(island.bearing + WORLD.ringFlatBearing - 1)).toBeCloseTo(0, 5);
      expect(ringHeight(island.bearing + 30)).toBeCloseTo(WORLD.ringHump, 5);
    }
  });

  it('gives the Helix real over- and under-passes across the whole Ring deck', () => {
    const helix = network.edges.filter((edge) => edge.style === 'helix');
    const ring = network.edges.filter((edge) => edge.style === 'ring');
    expect(helix).toHaveLength(islands.length);

    for (const leg of helix) {
      let over = Infinity;
      let under = Infinity;

      for (const point of leg.points) {
        let nearest: Vec3 | null = null;
        let nearestDistance = Infinity;
        for (const road of ring) {
          for (const ringPoint of road.points) {
            const reach = distanceXZ(point, ringPoint);
            if (reach < nearestDistance) {
              nearestDistance = reach;
              nearest = ringPoint;
            }
          }
        }
        if (!nearest || nearestDistance > ROAD_WIDTH.ring / 2) continue;
        const gap = point.y - nearest.y;
        if (gap > 0) over = Math.min(over, gap);
        else under = Math.min(under, -gap);
      }

      /* 2.4 of headroom plus the deck overhead: Helix 0.55 thick, Ring 0.8. */
      expect(over, `${leg.id} over`).toBeGreaterThanOrEqual(2.95);
      expect(under, `${leg.id} under`).toBeGreaterThanOrEqual(3.2);
      expect(over).toBeLessThan(Infinity);
      expect(under).toBeLessThan(Infinity);
    }
  });

  it('never passes the Helix through an island platform', () => {
    const helix = network.edges.filter((edge) => edge.style === 'helix');
    for (const leg of helix) {
      for (const point of leg.points) {
        for (const island of islands) {
          const center = polar(WORLD.islandOrbit, island.bearing);
          if (distanceXZ(point, center) < WORLD.islandRadius + ROAD_WIDTH.helix / 2) {
            expect(point.y, `${leg.id} over ${island.id}`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('keeps the Helix off the crystal, the spokes and the island decks', () => {
    const helix = network.edges.filter((edge) => edge.style === 'helix');
    const spokes = network.edges.filter((edge) => edge.style === 'spoke');

    for (const leg of helix) {
      for (const point of leg.points) {
        expect(Math.hypot(point.x, point.z)).toBeGreaterThan(WORLD.coreLoopRadius + 3);
        for (const spoke of spokes) {
          for (const spokePoint of spoke.points) {
            expect(distanceXZ(point, spokePoint)).toBeGreaterThan(
              (ROAD_WIDTH.helix + ROAD_WIDTH.spoke) / 2,
            );
          }
        }
      }
    }
  });
});

describe('walking surface', () => {
  const step = (from: Vec3, dx: number, dz: number) => {
    const hit = surface.move(from, dx, dz);
    return { x: hit.x, y: hit.y, z: hit.z };
  };

  it('starts the robot on a walkable surface', () => {
    const { pad } = world.station(START_STATION_ID);
    expect(surface.contains(pad.x, pad.y, pad.z)).toBe(true);
  });

  it('has every station pad on the surface and outside the prop zone', () => {
    for (const station of world.stations) {
      expect(surface.contains(station.pad.x, station.pad.y, station.pad.z), station.id).toBe(true);
      for (const blocker of network.blockers) {
        expect(distanceXZ(station.pad, blocker)).toBeGreaterThan(blocker.radius);
      }
    }
  });

  it('holds the robot on the road when it walks straight off the side', () => {
    let position: Vec3 = polar(WORLD.ringRadius, 30, ringHeight(30));
    for (let i = 0; i < 60; i += 1) position = step(position, 0.2, -0.5);

    const radius = Math.hypot(position.x, position.z);
    expect(Math.abs(radius - WORLD.ringRadius)).toBeLessThan(ROAD_WIDTH.ring / 2 + 0.05);
  });

  it('never lets the robot off the network from anywhere, in any direction', () => {
    for (const edge of network.edges) {
      const start = edge.points[Math.floor(edge.points.length / 2)] as Vec3;
      for (let angle = 0; angle < 360; angle += 45) {
        let position = start;
        const dx = Math.cos((angle * Math.PI) / 180);
        const dz = Math.sin((angle * Math.PI) / 180);
        for (let i = 0; i < 40; i += 1) position = step(position, dx * 0.4, dz * 0.4);
        expect(surface.contains(position.x, position.y, position.z), edge.id).toBe(true);
      }
    }
  });

  it('keeps the robot out of the prop zone on an island', () => {
    const island = islands[0];
    if (!island) throw new Error('no islands');
    let position = world.station('domain-ai-systems').pad;
    const center = network.blockers[0];
    if (!center) throw new Error('no blockers');
    for (let i = 0; i < 80; i += 1) {
      position = step(position, (center.x - position.x) * 0.08, (center.z - position.z) * 0.08);
    }
    expect(distanceXZ(position, center)).toBeGreaterThanOrEqual(WORLD.islandPropRadius - 0.01);
  });

  it('stays on its level walking the Helix across the Ring', () => {
    const leg = network.edges.find((edge) => edge.style === 'helix') as RoadEdge;
    let position = leg.points[0] as Vec3;

    for (let i = 1; i < leg.points.length; i += 1) {
      const point = leg.points[i] as Vec3;
      position = step(position, point.x - position.x, point.z - position.z);
      expect(Math.abs(position.y - point.y), `helix sample ${i}`).toBeLessThan(0.6);
    }
  });

  it('stays on the Ring walking under and across the Helix', () => {
    for (let bearing = 0; bearing <= 360; bearing += 1) {
      const point = polar(WORLD.ringRadius, bearing, ringHeight(bearing));
      const hit = surface.resolve(point.x, point.z, point.y);
      expect(hit?.inside, `ring at ${bearing}`).toBe(true);
      expect(Math.abs((hit as { y: number }).y - point.y), `ring at ${bearing}`).toBeLessThan(0.5);
    }
  });
});

describe('routing', () => {
  it('reaches every station from the start of the walk', () => {
    const { pad } = world.station(START_STATION_ID);
    for (const station of world.stations) {
      const route = world.routeTo(pad, station.id);
      expect(route.length, station.id).toBeGreaterThanOrEqual(0);
      const end = route.points[route.points.length - 1] as Vec3;
      expect(distance(end, station.pad), station.id).toBeLessThan(0.8);
    }
  });

  it('produces routes the robot can actually walk', () => {
    const { pad } = world.station(START_STATION_ID);
    for (const station of world.stations) {
      for (const point of world.routeTo(pad, station.id).points) {
        expect(surface.contains(point.x, point.y, point.z), station.id).toBe(true);
      }
    }
  });

  it('takes the shorter direction around the Ring', () => {
    const start = polar(WORLD.ringRadius, 10, ringHeight(10));
    const shortHop = findRoute(network, start, 'ring-about');
    expect(shortHop.length).toBeLessThan(60);
  });

  it('picks the road underfoot at a crossing, not the one overhead', () => {
    const point = polar(WORLD.ringRadius, 20.5, ringHeight(20.5));
    expect(nearestOnNetwork(network, point).edge.style).toBe('ring');
    expect(nearestOnNetwork(network, { ...point, y: point.y + 4.5 }).edge.style).toBe('helix');
  });
});

describe('stations and briefings', () => {
  it('places every project at exactly one station', () => {
    const slugs = world.stations.flatMap((station) =>
      station.content.subject.type === 'project' ? [station.content.subject.slug] : [],
    );
    expect([...slugs].sort()).toEqual(projects.map((project) => project.slug).sort());
  });

  it('builds a non-empty briefing for every station', () => {
    for (const station of world.stations) {
      const briefing = buildBriefing(station.content);
      expect(briefing.beats.length, station.id).toBeGreaterThan(0);
      for (const beat of briefing.beats) {
        expect(beat.title, `${station.id}/${beat.id}`).toBeTruthy();
        expect(beat.speech, `${station.id}/${beat.id}`).toBeTruthy();
        expect(beat.speech).not.toContain('PLACEHOLDER');
      }
    }
  });

  it('ends every project briefing with a link to the projects section', () => {
    for (const project of projects) {
      const briefing = world.briefing(project.slug);
      expect(briefing.beats[briefing.beats.length - 1]?.link?.href).toBe(
        '/#projects',
      );
      expect(briefing.placeholder).toBe(project.placeholder);
    }
  });

  it('tours only stations that exist, and covers every project', () => {
    for (const id of tourOrder) expect(() => world.station(id)).not.toThrow();
    for (const project of projects) expect(tourOrder).toContain(project.slug);
    expect(tourOrder[0]).toBe(coreStation.id);
  });

  it('removes placeholder notes from speech but only from speech', () => {
    expect(stripPlaceholderNotes('Done. [PLACEHOLDER — replace this.]')).toBe('Done.');
    expect(firstSentences('One. Two. Three.', 6)).toBe('One.');
  });
});
