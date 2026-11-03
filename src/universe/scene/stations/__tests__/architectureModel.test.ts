import { describe, expect, it } from 'vitest';
import { domains } from '@/data/domains';
import { archiveProjects } from '@/data/landing';
import type { ArchitectureSpec } from '@/lib/types';
import { distance, type Vec3 } from '../../../world/vec';
import { MAX_MODEL_NODES } from '../holoMaterials';
import {
  buildArchitectureModel,
  MODEL,
  nodeExtent,
  nodeLabelSize,
  routePoint,
  sampleRoute,
  type ArchitectureModel,
  type ModelNode,
  type RouteSample,
} from '../architectureModel';

const models = archiveProjects.flatMap((project) =>
  project.architecture
    ? [{ name: project.slug, spec: project.architecture, model: buildArchitectureModel(project.architecture) }]
    : [],
);

function touchesBox(point: Vec3, node: ModelNode): boolean {
  const margin = 1e-6;
  return (
    Math.abs(point.x - node.x) <= node.width / 2 + margin &&
    Math.abs(point.y - node.y) <= node.height / 2 + margin &&
    Math.abs(point.z - node.z) <= node.depth / 2 + margin
  );
}

function nodeNamed(model: ArchitectureModel, id: string): ModelNode {
  const node = model.nodes.find((entry) => entry.id === id);
  if (!node) throw new Error(`no node ${id}`);
  return node;
}

describe('architecture model', () => {
  it('turns every layer into a row and keeps every node', () => {
    for (const { name, spec, model } of models) {
      expect(model.rows.map((row) => row.label), name).toEqual(
        spec.layers.map((layer) => layer.label),
      );
      expect(model.nodes.length, name).toBe(
        spec.layers.reduce((sum, layer) => sum + layer.nodes.length, 0),
      );
    }
  });

  it('keeps nodes inside the model and clear of the rail', () => {
    for (const { name, model } of models) {
      for (const node of model.nodes) {
        expect(node.x - node.width / 2, `${name}/${node.id}`).toBeGreaterThanOrEqual(
          -MODEL.width / 2 + MODEL.railWidth - 1e-6,
        );
        expect(node.x + node.width / 2, `${name}/${node.id}`).toBeLessThanOrEqual(
          MODEL.width / 2 + 1e-6,
        );
        expect(Math.abs(node.y) + node.height / 2, `${name}/${node.id}`).toBeLessThanOrEqual(
          MODEL.height / 2 + 1e-6,
        );
      }
    }
  });

  it('never overlaps two boxes in a row', () => {
    for (const { name, model } of models) {
      for (const a of model.nodes) {
        for (const b of model.nodes) {
          if (a === b || a.row !== b.row) continue;
          expect(Math.abs(a.x - b.x), `${name}: ${a.id}/${b.id}`).toBeGreaterThanOrEqual(
            (a.width + b.width) / 2,
          );
        }
      }
    }
  });

  it('leaves no rail for rows without names, so that a domain model fills its width', () => {
    const spec = {
      layers: [
        { label: '', nodes: [{ id: 'a', label: 'A' }] },
        { label: '', nodes: [{ id: 'b', label: 'B' }] },
      ],
      edges: [],
      paths: [],
    };
    const { left, right } = nodeExtent(buildArchitectureModel(spec));
    expect((left + right) / 2).toBeCloseTo(0);
  });

  it('steps each row towards the viewer so that rows cannot hide each other', () => {
    for (const { name, model } of models) {
      for (let row = 1; row < model.rows.length; row += 1) {
        const previous = model.rows[row - 1];
        const current = model.rows[row];
        expect((current?.z ?? 0) - (previous?.z ?? 0), name).toBeCloseTo(MODEL.rowStep);
        expect(current?.y ?? 0, name).toBeLessThan(previous?.y ?? 0);
      }
    }
  });

  it('draws every edge, from one box to the other', () => {
    for (const { name, spec, model } of models) {
      expect(model.wires.length, name).toBe(spec.edges.length);
      for (const wire of model.wires) {
        const first = wire.points[0] as Vec3;
        const last = wire.points[wire.points.length - 1] as Vec3;
        expect(touchesBox(first, nodeNamed(model, wire.from)), `${name} ${wire.id} start`).toBe(
          true,
        );
        expect(touchesBox(last, nodeNamed(model, wire.to)), `${name} ${wire.id} end`).toBe(true);
      }
    }
  });

  it('routes wires that skip a row in front of the row they skip', () => {
    const skipping = models.flatMap(({ model }) =>
      model.wires.filter(
        (wire) =>
          Math.abs(nodeNamed(model, wire.from).row - nodeNamed(model, wire.to).row) > 1,
      ).map((wire) => ({ model, wire })),
    );
    expect(skipping.length).toBeGreaterThan(0);

    for (const { model, wire } of skipping) {
      const a = nodeNamed(model, wire.from).row;
      const b = nodeNamed(model, wire.to).row;
      const between = model.rows.slice(Math.min(a, b) + 1, Math.max(a, b));
      const front = Math.max(...between.map((row) => row.z)) + MODEL.nodeDepth / 2;
      const peak = Math.max(...wire.points.map((point) => point.z));
      expect(peak, wire.id).toBeGreaterThan(front);
    }
  });

  it('stays within the nodes the shader can light', () => {
    const specs = [
      ...models.map(({ spec }) => spec),
      ...Object.values(domains).map((domain) => ({
        layers: [{ label: '', nodes: domain.subArchitecture.nodes }],
        edges: [],
        paths: [],
      })),
    ];
    for (const spec of specs) {
      const nodes = spec.layers.reduce((sum, layer) => sum + layer.nodes.length, 0);
      expect(nodes).toBeLessThanOrEqual(MAX_MODEL_NODES);
    }
  });

  it('fits every label on its box', () => {
    for (const { name, model } of models) {
      for (const node of model.nodes) {
        const width = nodeLabelSize(node) * node.label.length * 0.56;
        expect(width, `${name}/${node.id}`).toBeLessThanOrEqual(node.width - 0.15);
        expect(nodeLabelSize(node), `${name}/${node.id}`).toBeGreaterThan(0.09);
      }
    }
  });
});

describe('request route', () => {
  const routed = models.filter(({ spec }) => spec.paths.length > 0);

  it('exists for every project, and follows the first path in order', () => {
    expect(routed.length).toBe(models.length);
    for (const { name, spec, model } of routed) {
      expect(model.route?.stops, name).toEqual(spec.paths[0]?.steps);
    }
  });

  it('passes through each stop in turn', () => {
    for (const { name, model } of routed) {
      const route = model.route;
      if (!route) throw new Error('no route');
      const sample: RouteSample = { length: 0, stop: 0, progress: 0 };
      const point: Vec3 = { x: 0, y: 0, z: 0 };

      route.stops.forEach((id, stop) => {
        const hold = route.segments.find(
          (segment) => segment.stop === stop && segment.fromLength === segment.toLength,
        );
        if (!hold) throw new Error(`${name}: no hold at stop ${stop}`);
        sampleRoute(route, (hold.startTime + hold.endTime) / 2, sample);
        routePoint(route, sample.length, point);

        const node = nodeNamed(model, id);
        const reach = Math.hypot(node.width, node.height, node.depth) / 2;
        expect(distance(point, node), `${name} stop ${stop} ${id}`).toBeLessThanOrEqual(reach);
      });
    }
  });

  it('has a continuous timeline that covers the whole route', () => {
    for (const { name, model } of routed) {
      const route = model.route;
      if (!route) throw new Error('no route');
      let previous = route.segments[0];
      expect(previous?.startTime, name).toBe(0);
      for (const segment of route.segments.slice(1)) {
        expect(segment.startTime, name).toBeCloseTo(previous?.endTime ?? 0);
        expect(segment.fromLength, name).toBeCloseTo(previous?.toLength ?? 0);
        previous = segment;
      }
      expect(previous?.endTime, name).toBeCloseTo(route.duration);
      expect(previous?.toLength ?? 0, name).toBeCloseTo(route.length, 1);
    }
  });

  it('never moves backwards within a loop, and loops', () => {
    const route = routed[0]?.model.route;
    if (!route) throw new Error('no route');
    const sample: RouteSample = { length: 0, stop: 0, progress: 0 };

    let last = -1;
    for (let time = 0; time < route.duration; time += route.duration / 200) {
      sampleRoute(route, time, sample);
      expect(sample.length).toBeGreaterThanOrEqual(last - 1e-6);
      last = sample.length;
    }

    sampleRoute(route, route.duration + 0.01, sample);
    expect(sample.length).toBe(0);
    expect(sample.stop).toBe(0);
  });

  it('is omitted rather than invented when a spec has no paths', () => {
    const spec: ArchitectureSpec = { ...models[0]!.spec, paths: [] };
    expect(buildArchitectureModel(spec).route).toBeNull();
  });
});
