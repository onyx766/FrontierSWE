'use client';

import { Text } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { getPlateLayouts, type PlateLayout } from './plateLayout';

/**
 * The smoked-glass name plates and the islands' click targets. Both act on
 * behalf of an island, so they share one set of pointer handlers.
 */

/** A real click barely moves. Anything further was a drag to orbit. */
const CLICK_SLOP_PX = 4;

/** Plates fade between these camera distances from the island, and stop taking clicks. */
const FADE_NEAR = 46;
const FADE_FAR = 78;

/** How far in front of its real depth a plate is drawn, so that props never cut it. */
const DEPTH_PULL = 9;

/** One unit of polygon offset in world units at distance 1, for a 24-bit depth buffer. */
const DEPTH_STEP = 2 ** -24;

/** Text sits slightly proud of the glass, in reference pixels. */
const TEXT_LIFT = 3;

/**
 * Plates draw after everything else transparent. Merged meshes all sort by their
 * origin at the world's centre, which says nothing about the additive detail
 * they hold, so distance alone would let glows draw over the far plates.
 */
const GLASS_ORDER = 20;
const TEXT_ORDER = 21;

const TITLE_FONT = '/fonts/Geist-Bold.ttf';
const SUB_FONT = '/fonts/Geist-Regular.ttf';

/**
 * The title stays just under the bloom threshold: anything above it turns the
 * lettering soft without making it any whiter, because ACES has flattened out by then.
 */
const TITLE_COLOR = new THREE.Color(1.02, 1.02, 1.02);
const SUB_COLOR = new THREE.Color(0.8, 0.84, 0.92);

const toCamera = new THREE.Vector3();

const textMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  depthWrite: false,
});

/** Never rendered: it only needs a side, so rays hit it from either direction. */
const pickMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

/**
 * The island's clickable volume: the rock and platform, stopping just under the
 * deck so a station pad on the deck is hit first, plus a narrower column around
 * the props that leaves the pads clear.
 */
function createPickGeometry(): THREE.BufferGeometry {
  const profile: [radius: number, y: number][] = [
    [0.01, -26],
    [8, -26],
    [18.6, -3],
    [18.6, -0.04],
    [9.4, -0.04],
    [9.4, 15],
    [0.01, 15],
  ];
  return new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    16,
  );
}

const plateVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A rounded rectangle as a distance field, so that it stays crisp at any orbit. */
const plateFragment = /* glsl */ `
  #define GLASS_ALPHA 0.985

  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uHover;
  varying vec2 vUv;

  float roundedBox(vec2 point, vec2 half_, float radius) {
    vec2 q = abs(point) - half_ + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    vec2 point = (vUv - 0.5) * uSize;
    float dist = roundedBox(point, uSize * 0.5 - 2.0, uRadius);
    float width = fwidth(dist);
    float inside = 1.0 - smoothstep(-width, width, dist);

    float height = vUv.y;
    vec3 glass = mix(vec3(0.0045, 0.0105, 0.024), vec3(0.009, 0.0135, 0.03), height * height);
    glass += vec3(0.006, 0.009, 0.02) * smoothstep(-14.0, 0.0, dist);

    float edge = 1.0 - smoothstep(0.0, 1.5, abs(dist + 0.8));
    float edgeLight = mix(0.05, 0.13, height) + uHover * 1.3;
    vec3 color = glass + vec3(0.42, 0.56, 0.95) * edge * edgeLight;

    /* Nearly solid: at HDR levels, a few percent of a strip behind would still read clearly. */
    float alpha = mix(GLASS_ALPHA, 1.0, edge) * inside + edge * 0.1;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function ignoreRaycast(): void {
  /* Replaces `raycast` on a target that is switched off. */
}

/** Troika's mesh, with the two properties animated here. */
type PlateText = THREE.Mesh & { fillOpacity: number; depthOffset: number };

interface IslandPlateProps {
  layout: PlateLayout;
  pickGeometry: THREE.BufferGeometry;
}

function IslandPlate({ layout, pickGeometry }: IslandPlateProps) {
  const { island, center, measure } = layout;

  const root = useRef<THREE.Group>(null);
  const glass = useRef<THREE.Mesh>(null);
  const pick = useRef<THREE.Mesh>(null);
  const title = useRef<PlateText>(null);
  const subtitle = useRef<PlateText>(null);
  const pointers = useRef(0);
  const hover = useRef(0);

  const canvas = useThree((state) => state.gl.domElement);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: plateVertex,
        fragmentShader: plateFragment,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        uniforms: {
          uSize: { value: new THREE.Vector2(measure.width + 8, measure.height + 8) },
          uRadius: { value: measure.radius },
          uOpacity: { value: 1 },
          uHover: { value: 0 },
        },
      }),
    [measure],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(
    () => () => {
      canvas.style.cursor = '';
    },
    [canvas],
  );

  const handlers = useMemo(() => {
    const firstStation = island.stations[0];

    return {
      onClick(event: ThreeEvent<MouseEvent>) {
        if (event.delta >= CLICK_SLOP_PX || !firstStation) return;
        /* A station pad on the island gets its own click. */
        if (event.intersections[0]?.object !== event.object) return;
        const universe = useUniverse.getState();
        if (universe.phase !== 'loading') universe.travelTo(firstStation.id);
      },
      onPointerOver() {
        if (runtime.view.dragging || useUniverse.getState().phase === 'loading') return;
        pointers.current += 1;
        canvas.style.cursor = 'pointer';
      },
      onPointerOut() {
        pointers.current = Math.max(0, pointers.current - 1);
        if (pointers.current === 0) canvas.style.cursor = '';
      },
    };
  }, [canvas, island]);

  useFrame(({ camera }, delta) => {
    const group = root.current;
    const plate = glass.current;
    if (!group || !plate) return;

    toCamera.set(camera.position.x - center.x, 0, camera.position.z - center.z);
    const flat = toCamera.length() || 1;
    toCamera.divideScalar(flat);

    const distance = Math.hypot(flat, camera.position.y - center.y);
    const opacity = smoothstep(FADE_NEAR, FADE_FAR, distance);
    const shown = opacity > 0.005;
    group.visible = shown;

    /* Too close to fade in: stop catching the pointer as well as being unseen. */
    const live = opacity > 0.5;
    plate.raycast = live ? THREE.Mesh.prototype.raycast : ignoreRaycast;
    if (pick.current) pick.current.raycast = live ? THREE.Mesh.prototype.raycast : ignoreRaycast;

    if (!shown) return;

    group.position.set(
      center.x + toCamera.x * layout.out + toCamera.z * layout.side,
      center.y + layout.up,
      center.z + toCamera.z * layout.out - toCamera.x * layout.side,
    );
    group.quaternion.copy(camera.quaternion);

    hover.current = THREE.MathUtils.damp(hover.current, pointers.current > 0 ? 1 : 0, 12, delta);

    const uniforms = material.uniforms as Record<string, THREE.IUniform<number>>;
    (uniforms.uOpacity as THREE.IUniform<number>).value = opacity;
    (uniforms.uHover as THREE.IUniform<number>).value = hover.current;

    /* Polygon offset is in depth-buffer steps, which grow with the square of distance. */
    const range = group.position.distanceTo(camera.position);
    const depthStep = (DEPTH_STEP * range * range) / (camera as THREE.PerspectiveCamera).near;
    const offset = -DEPTH_PULL / depthStep;

    material.polygonOffsetUnits = offset;
    material.polygonOffsetFactor = offset;

    for (const text of [title.current, subtitle.current]) {
      if (!text) continue;
      text.fillOpacity = opacity;
      text.depthOffset = offset;
    }
  });

  return (
    <>
      <mesh
        ref={pick}
        geometry={pickGeometry}
        material={pickMaterial}
        position={[center.x, center.y, center.z]}
        visible={false}
        {...handlers}
      />

      <group ref={root} scale={layout.pixel}>
        <mesh ref={glass} material={material} renderOrder={GLASS_ORDER} {...handlers}>
          <planeGeometry args={[measure.width + 8, measure.height + 8]} />
        </mesh>

        <Text
          ref={title}
          font={TITLE_FONT}
          fontSize={measure.titleSize}
          lineHeight={1.2}
          letterSpacing={0.012}
          textAlign="center"
          position={[0, measure.titleY, TEXT_LIFT]}
          material={textMaterial}
          color={TITLE_COLOR}
          renderOrder={TEXT_ORDER}
        >
          {island.label}
        </Text>

        <Text
          ref={subtitle}
          font={SUB_FONT}
          fontSize={measure.subSize}
          textAlign="center"
          position={[0, measure.subY, TEXT_LIFT]}
          material={textMaterial}
          color={SUB_COLOR}
          renderOrder={TEXT_ORDER}
        >
          {island.sublabel}
        </Text>
      </group>
    </>
  );
}

export function LabelPlates() {
  const layouts = useMemo(getPlateLayouts, []);
  const pickGeometry = useMemo(createPickGeometry, []);

  useEffect(() => () => pickGeometry.dispose(), [pickGeometry]);

  return (
    <>
      {layouts.map((layout) => (
        <IslandPlate key={layout.island.id} layout={layout} pickGeometry={pickGeometry} />
      ))}
    </>
  );
}
