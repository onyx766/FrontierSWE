import { describe, expect, it } from 'vitest';
import { WORLD } from '../../../world/network';
import { REFERENCE_FRAME, world } from '../../../world/world';
import { heroReferenceCamera } from '../../heroCamera';
import { compassOf, getIslandPlans, isClear } from '../islandPlan';
import { getPlateLayouts } from '../plateLayout';
import { buildIslandPlatform, DECK_RADIUS } from '../platformGeometry';
import { buildIslandRock, buildShardRock, layOutShards } from '../rockGeometry';
import type { TriangleSoup } from '../soup';
import * as THREE from 'three';

interface Point {
  x: number;
  y: number;
  z: number;
}

function pointsOf(soup: TriangleSoup): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < soup.positions.length; index += 3) {
    points.push({
      x: soup.positions[index] as number,
      y: soup.positions[index + 1] as number,
      z: soup.positions[index + 2] as number,
    });
  }
  return points;
}

const plans = getIslandPlans();

describe('island platforms', () => {
  it('keeps the deck flat at y = 0, covering the walkable radius', () => {
    for (const plan of plans) {
      const deck = pointsOf(buildIslandPlatform(plan).deck);
      const reach = Math.max(...deck.map((point) => Math.hypot(point.x, point.z)));

      expect(deck.every((point) => point.y === 0)).toBe(true);
      expect(reach).toBeCloseTo(DECK_RADIUS, 5);
      expect(reach).toBeGreaterThan(WORLD.islandWalkRadius);
    }
  });

  it('never raises metal above the deck, where the robot walks', () => {
    for (const plan of plans) {
      const hull = pointsOf(buildIslandPlatform(plan).hull);
      expect(Math.max(...hull.map((point) => point.y))).toBeLessThanOrEqual(0);
    }
  });

  it('bakes only finite values', () => {
    for (const plan of plans) {
      const { deck, hull, light, haze } = buildIslandPlatform(plan);
      for (const soup of [deck, hull, light, haze]) {
        expect(soup.positions.every(Number.isFinite)).toBe(true);
        expect(soup.colors.every(Number.isFinite)).toBe(true);
        expect(soup.glows.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('island rock', () => {
  it('hangs well below the rim and stays under the deck', () => {
    for (const plan of plans) {
      const rock = pointsOf(buildIslandRock(plan));
      const lowest = Math.min(...rock.map((point) => point.y));
      const highest = Math.max(...rock.map((point) => point.y));

      expect(-lowest).toBeGreaterThan(WORLD.islandRadius * 1.2);
      expect(-lowest).toBeLessThan(WORLD.islandRadius * 1.6);
      expect(highest).toBeLessThan(0);
    }
  });

  it('stays out of every road outside the deck', () => {
    const roads = world.network.edges.filter(
      (edge) => edge.style !== 'islandLoop' && edge.style !== 'spur',
    );

    for (const plan of plans) {
      const rock = pointsOf(buildIslandRock(plan)).map((point) => ({
        x: point.x + plan.center.x,
        y: point.y + plan.center.y,
        z: point.z + plan.center.z,
      }));

      for (const road of roads) {
        for (const sample of road.points) {
          const fromCenter = Math.hypot(sample.x - plan.center.x, sample.z - plan.center.z);
          if (fromCenter < WORLD.islandRadius + 0.5 || fromCenter > 30) continue;

          for (const point of rock) {
            const overlapsDeck = Math.abs(point.y - sample.y) < 0.5;
            if (!overlapsDeck) continue;
            const across = Math.hypot(point.x - sample.x, point.z - sample.z);
            expect(across).toBeGreaterThan(road.width / 2 - 0.3);
          }
        }
      }
    }
  });

  it('breaks faces without opening cracks: every edge is shared by exactly two', () => {
    const points = pointsOf(buildShardRock());
    const key = ({ x, y, z }: Point) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    const edges = new Map<string, number>();

    for (let index = 0; index < points.length; index += 3) {
      const corners = [points[index], points[index + 1], points[index + 2]] as Point[];
      corners.forEach((corner, side) => {
        const next = corners[(side + 1) % 3] as Point;
        const edge = [key(corner), key(next)].sort().join('|');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      });
    }

    expect([...edges.values()].every((count) => count === 2)).toBe(true);
  });

  it('scatters shards outside the Ring and below every road', () => {
    for (const plan of plans) {
      for (const shard of layOutShards(plan)) {
        expect(Math.hypot(shard.position.x, shard.position.z)).toBeGreaterThanOrEqual(60);
        expect(shard.position.y).toBeLessThan(-5);
      }
    }
  });
});

describe('island plan', () => {
  it('reads compass bearings the way the rest of the world does', () => {
    expect(compassOf(0, -1)).toBeCloseTo(0);
    expect(compassOf(1, 0)).toBeCloseTo(90);
    expect(compassOf(0, 1)).toBeCloseTo(180);
    expect(compassOf(-1, 0)).toBeCloseTo(270);
  });

  it('finds the roads crossing the rim', () => {
    const vault = plans.find((plan) => plan.island.id === 'data-vault');
    if (!vault) throw new Error('Data Vault is missing');

    /* The Ring and the link meet the Vault on its north side, its open flank is south. */
    expect(isClear(vault, 340, 380, 19)).toBe(false);
    expect(isClear(vault, 170, 190, 21)).toBe(true);
  });
});

describe('label plates', () => {
  it('land on their reference pixels at the opening shot', () => {
    const camera = heroReferenceCamera();

    for (const layout of getPlateLayouts()) {
      const toCamera = new THREE.Vector3(
        camera.position.x - layout.center.x,
        0,
        camera.position.z - layout.center.z,
      ).normalize();

      const position = new THREE.Vector3(
        layout.center.x + toCamera.x * layout.out + toCamera.z * layout.side,
        layout.center.y + layout.up,
        layout.center.z + toCamera.z * layout.out - toCamera.x * layout.side,
      ).project(camera);

      const x = ((position.x + 1) / 2) * REFERENCE_FRAME.width;
      const y = ((1 - position.y) / 2) * REFERENCE_FRAME.height;

      expect(Math.abs(x - layout.measure.x)).toBeLessThan(0.5);
      expect(Math.abs(y - layout.measure.y)).toBeLessThan(0.5);
    }
  });
});
