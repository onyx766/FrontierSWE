import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../world/vec';
import { MODEL, nodeExtent, type ArchitectureModel, type ModelNode } from './architectureModel';

/** Static hologram geometry. Each function returns one merged geometry: one draw call. */

const BOX_RADIUS = 0.05;
const BOX_SEGMENTS = 2;
const WIRE_RADIUS = 0.0085;
const ROUTE_RADIUS = 0.013;
const RAIL_RADIUS = 0.005;
const RAIL_OVERHANG = 0.12;
const TUBE_SIDES = 5;

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  return shape;
}

function bar(x: number, y: number, width: number, height: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(width, height).translate(x, y, 0);
}

/**
 * The panel's bright frame: a hairline around the whole edge, heavier brackets at
 * the corners, and small registration ticks. Thin geometry rather than GL lines,
 * which are one pixel wide on every platform and would not bloom.
 */
export function createFrameGeometry(
  width: number,
  height: number,
  radius: number,
): THREE.BufferGeometry {
  const line = 0.012;
  const bracket = 0.03;
  const reach = 0.44;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const outline = roundedRectShape(width, height, radius);
  outline.holes.push(roundedRectShape(width - line * 2, height - line * 2, radius - line));
  const parts: THREE.BufferGeometry[] = [new THREE.ShapeGeometry(outline, 8)];

  for (const sideX of [-1, 1]) {
    for (const sideY of [-1, 1]) {
      const x = sideX * (halfWidth + 0.05);
      const y = sideY * (halfHeight + 0.05);
      parts.push(bar(x - (sideX * reach) / 2, y, reach, bracket));
      parts.push(bar(x, y - (sideY * reach) / 2, bracket, reach));
    }
  }

  for (let tick = -3; tick <= 3; tick += 1) {
    parts.push(bar((tick * width) / 8, halfHeight + 0.05, 0.06, 0.012));
    parts.push(bar((tick * width) / 8, -halfHeight - 0.05, 0.06, 0.012));
  }

  return mergeGeometries(parts) as THREE.BufferGeometry;
}

/** The sheet of light from the pad to the bottom edge of the panel. */
export function createRaysGeometry(
  panelWidth: number,
  panelBottom: number,
  padDistance: number,
  padHeight: number,
): THREE.BufferGeometry {
  const padWidth = 2.2;
  const positions = new Float32Array([
    -padWidth / 2,
    padHeight,
    padDistance,
    padWidth / 2,
    padHeight,
    padDistance,
    panelWidth / 2,
    panelBottom,
    0,
    -panelWidth / 2,
    panelBottom,
    0,
  ]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  return geometry;
}

/** A tube through `points`, with its wire attributes. */
function tube(
  points: Vec3[],
  radius: number,
  kind: number,
  startAlong: number,
  segments: number,
): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    false,
    'centripetal',
  );
  const length = path.getLength();
  const geometry = new THREE.TubeGeometry(path, segments, radius, TUBE_SIDES, false);

  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const along = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i += 1) along[i] = startAlong + uv.getX(i) * length;

  geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(uv.count).fill(kind), 1));
  return geometry;
}

/** Every line in the model: row rails, wires, and the route on top of them. */
export function createWiresGeometry(model: ArchitectureModel): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const { left, right } = nodeExtent(model);

  for (const row of model.rows) {
    const y = row.y - MODEL.nodeHeight / 2 - 0.05;
    parts.push(
      tube(
        [
          { x: left - RAIL_OVERHANG, y, z: row.z },
          { x: (left + right) / 2, y, z: row.z },
          { x: right + RAIL_OVERHANG, y, z: row.z },
        ],
        RAIL_RADIUS,
        0,
        0,
        4,
      ),
    );
  }

  for (const wire of model.wires) parts.push(tube(wire.points, WIRE_RADIUS, 1, 0, 20));

  if (model.route) {
    const samples = MODEL.wireSamples + 1;
    const legs = Math.floor(model.route.points.length / samples);
    for (let leg = 0; leg < legs; leg += 1) {
      const start = leg * samples;
      parts.push(
        tube(
          model.route.points.slice(start, start + samples),
          ROUTE_RADIUS,
          2,
          model.route.lengths[start] as number,
          20,
        ),
      );
    }
  }

  return mergeGeometries(parts) as THREE.BufferGeometry;
}

function nodeBox(node: ModelNode, index: number): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(
    node.width,
    node.height,
    node.depth,
    BOX_SEGMENTS,
    BOX_RADIUS,
  );

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = position.count;
  const halves = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    halves[i * 3] = node.width / 2;
    halves[i * 3 + 1] = node.height / 2;
    halves[i * 3 + 2] = node.depth / 2;
  }
  const tone = node.tone === 'accent' ? 1 : node.tone === 'muted' ? -1 : 0;

  geometry.setAttribute('aLocal', position.clone());
  geometry.setAttribute('aHalf', new THREE.BufferAttribute(halves, 3));
  geometry.setAttribute('aNode', new THREE.BufferAttribute(new Float32Array(count).fill(index), 1));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(count).fill(tone), 1));
  geometry.deleteAttribute('uv');
  geometry.translate(node.x, node.y, node.z);
  return geometry;
}

/** Every node box. Node index in the geometry matches its index in `model.nodes`. */
export function createNodesGeometry(model: ArchitectureModel): THREE.BufferGeometry {
  return mergeGeometries(model.nodes.map(nodeBox)) as THREE.BufferGeometry;
}
