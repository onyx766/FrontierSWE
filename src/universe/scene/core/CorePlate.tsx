'use client';

import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { corePlate } from '@/data/universe';
import { getCrystal } from './crystal';

/**
 * The dark glass plate carrying the name. It floats on the camera's side of the
 * crystal and stays square to the lens, which keeps it an undistorted rectangle
 * at any orbit, as it is in the reference.
 *
 * Measured there it is 229 by 144 pixels, centred 23 pixels below the crystal's
 * centre. At `STANDOFF` units in front of the axis 1 unit is 8.65 pixels.
 */

const STANDOFF = 26;
const DROP = 2.66;
const WIDTH = 26.6;
const HEIGHT = 16.7;
/** Extra quad around the plate, for its soft edge. */
const BLEED = 1.2;
const CORNER = 1.1;
/**
 * Gone by the time the camera is at the Ring, and whole at every overview zoom.
 * The plate has to stay out of the walking view, and at this size it would fill it.
 */
const FADE_NEAR = 62;
const FADE_FAR = 96;

interface TroikaText extends THREE.Mesh {
  fillOpacity: number;
}

const direction = new THREE.Vector3();
const lensUp = new THREE.Vector3();
const inLens = new THREE.Vector3();

/** Right at the bloom threshold: white through tone mapping, with barely any halo. */
const TITLE_COLOR = new THREE.Color(1.03, 1.06, 1.16);
const CAPTION_COLOR = new THREE.Color(0.98, 1.02, 1.12);

function createPlateMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uSize: { value: new THREE.Vector2(WIDTH / 2, HEIGHT / 2) },
      uCorner: { value: CORNER },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vPlane;

      void main() {
        vPlane = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec2 uSize;
      uniform float uCorner;

      varying vec2 vPlane;

      void main() {
        vec2 q = abs(vPlane) - uSize + uCorner;
        float distanceToEdge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCorner;

        float fill = 1.0 - smoothstep(-0.34, 0.26, distanceToEdge);
        float rim = exp(-distanceToEdge * distanceToEdge * 120.0);

        float height = vPlane.y / uSize.y;
        vec3 glass = mix(vec3(0.0085, 0.0185, 0.066), vec3(0.0055, 0.0135, 0.05), height * 0.5 + 0.5);

        /* A long soft glare along the top edge, leaning to the right. */
        float glare = exp(-pow(max(0.0, uSize.y - vPlane.y) * 0.9, 2.0))
          * smoothstep(0.0, 0.6, vPlane.x / uSize.x) * (1.0 - smoothstep(0.55, 1.0, vPlane.x / uSize.x));

        vec3 color = glass + vec3(0.05, 0.075, 0.2) * rim * (0.55 + 0.45 * height);
        color += vec3(0.04, 0.05, 0.085) * glare * fill;
        gl_FragColor = vec4(color, (fill * 0.94 + rim * 0.03) * uOpacity);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function CorePlate() {
  const group = useRef<THREE.Group>(null);
  const title = useRef<TroikaText>(null);
  const caption = useRef<TroikaText>(null);

  const material = useMemo(createPlateMaterial, []);
  const plane = useMemo(
    () => new THREE.PlaneGeometry(WIDTH + BLEED * 2, HEIGHT + BLEED * 2),
    [],
  );
  const crystal = useMemo(getCrystal, []);

  useEffect(
    () => () => {
      plane.dispose();
      material.dispose();
    },
    [plane, material],
  );

  useFrame(({ camera }) => {
    const plate = group.current;
    if (!plate) return;

    const away = camera.position.length();
    const t = THREE.MathUtils.clamp((away - FADE_NEAR) / (FADE_FAR - FADE_NEAR), 0, 1);
    const opacity = t * t * (3 - 2 * t);

    plate.visible = opacity > 0.004;
    if (!plate.visible) {
      crystal.setPlate(0, 0, 0, 0, 0);
      return;
    }

    direction.copy(camera.position).normalize();
    lensUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    plate.position.copy(direction).multiplyScalar(STANDOFF).addScaledVector(lensUp, -DROP);
    plate.quaternion.copy(camera.quaternion);

    camera.updateMatrixWorld();
    inLens.copy(plate.position).applyMatrix4(camera.matrixWorldInverse);
    const depth = -inLens.z;
    crystal.setPlate(
      inLens.x / depth,
      inLens.y / depth,
      WIDTH / 2 / depth,
      HEIGHT / 2 / depth,
      opacity,
    );

    material.uniforms.uOpacity!.value = opacity;

    /*
     * Blending happens in linear light, where half-transparent white still looks
     * nearly solid. The lettering goes first, or it would hang there without its plate.
     */
    const lettering = opacity ** 3.4;
    if (title.current) title.current.fillOpacity = lettering;
    if (caption.current) caption.current.fillOpacity = lettering;
  });

  return (
    <group ref={group}>
      <mesh geometry={plane} material={material} />
      <Text
        ref={title}
        font="/fonts/Geist-Bold.ttf"
        fontSize={6.3}
        letterSpacing={0.08}
        position={[0, 3.75, 0.12]}
        color={TITLE_COLOR}
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
        material-depthWrite={false}
      >
        {corePlate.title}
      </Text>
      <Text
        ref={caption}
        font="/fonts/Geist-SemiBold.ttf"
        fontSize={2.24}
        lineHeight={1.33}
        letterSpacing={0.024}
        textAlign="center"
        position={[0, -3.5, 0.12]}
        color={CAPTION_COLOR}
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
        material-depthWrite={false}
      >
        {corePlate.lines.join('\n')}
      </Text>
    </group>
  );
}
