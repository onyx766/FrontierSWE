import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroReferenceCamera } from '../../heroCamera';
import {
  EARTH_LIMB,
  getComposition,
  heroRay,
  PLANET_LIMB,
  solveLimbCone,
  sphereFromCone,
  worldSizeAt,
  type FramePoint,
} from '../composition';

/** How far a limb point misses a sphere's silhouette, in pixels of the reference frame. */
function limbErrorPixels(point: FramePoint, center: THREE.Vector3, radius: number): number {
  const camera = heroReferenceCamera().position;
  const toCenter = center.clone().sub(camera);
  const silhouette = Math.asin(radius / toCenter.length());
  const angle = heroRay(point[0], point[1]).angleTo(toCenter);
  return Math.abs(angle - silhouette) * (941 / THREE.MathUtils.degToRad(heroReferenceCamera().fov));
}

describe('solveLimbCone', () => {
  it('recovers a known cone from points on its rim', () => {
    const axis = heroRay(0.4, 1.6);
    const angle = THREE.MathUtils.degToRad(50);
    const right = new THREE.Vector3(0, 1, 0).cross(axis).normalize();
    const up = axis.clone().cross(right);

    const rim: FramePoint[] = [0.3, 0.6, 0.9, 1.2, 1.5].map((turn) => {
      const ray = axis
        .clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(right, Math.sin(angle) * Math.cos(turn))
        .addScaledVector(up, Math.sin(angle) * Math.sin(turn));
      const point = heroReferenceCamera().position.clone().add(ray).project(heroReferenceCamera());
      return [(point.x + 1) / 2, (1 - point.y) / 2];
    });

    const cone = solveLimbCone(rim);
    expect(cone.angle).toBeCloseTo(angle, 4);
    expect(cone.axis.angleTo(axis)).toBeLessThan(1e-3);
  });

  it('gives a sphere with that silhouette at any distance', () => {
    const cone = solveLimbCone(EARTH_LIMB);
    const near = sphereFromCone(cone, 4000);
    const far = sphereFromCone(cone, 8000);
    for (const point of EARTH_LIMB) {
      expect(limbErrorPixels(point, near.center, near.radius)).toBeLessThan(5);
      expect(limbErrorPixels(point, far.center, far.radius)).toBeLessThan(5);
    }
  });
});

describe('the sky composition', () => {
  const { earth, planet, sunPosition } = getComposition();

  it('lands the Earth on the limb traced from the reference', () => {
    for (const point of EARTH_LIMB) {
      expect(limbErrorPixels(point, earth.center, earth.radius)).toBeLessThan(5);
    }
  });

  it('lands the second planet on its crescent', () => {
    for (const point of PLANET_LIMB) {
      expect(limbErrorPixels(point, planet.center, planet.radius)).toBeLessThan(5);
    }
  });

  it('keeps the whole world clear of the Earth', () => {
    expect(earth.center.length() - earth.radius).toBeGreaterThan(600);
  });

  it('keeps the planets apart and inside the far plane', () => {
    const far = heroReferenceCamera().far;
    expect(earth.center.distanceTo(planet.center)).toBeGreaterThan(earth.radius + planet.radius);
    expect(planet.center.length() + planet.radius).toBeLessThan(far);
    expect(sunPosition.length()).toBeLessThan(far);
  });

  it('sizes objects by their width in the reference frame', () => {
    const camera = heroReferenceCamera();
    const distance = 500;
    const half = worldSizeAt(100, distance) / 2;
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = forward.clone().cross(camera.up).normalize();
    const center = camera.position.clone().addScaledVector(forward, distance);

    const left = center.clone().addScaledVector(right, -half).project(camera);
    const rightEdge = center.clone().addScaledVector(right, half).project(camera);
    expect(((rightEdge.x - left.x) / 2) * 1672).toBeCloseTo(100, 0);
  });
});
