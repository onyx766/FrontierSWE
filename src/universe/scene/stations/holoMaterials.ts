import * as THREE from 'three';
import { COLORS, hdr } from '../palette';

/**
 * Shaders for the open hologram. There is only ever one on screen, but it can
 * fill much of the frame, so each stays a handful of analytic terms: no noise, no
 * loops, and no lighting.
 */

/** The most nodes a model can light up. A test holds every project and domain to it. */
export const MAX_MODEL_NODES = 16;

/** Hologram draw order. Everything blends, so it is stated rather than left to sorting. */
export const HOLO_ORDER = {
  rays: 30,
  glass: 31,
  frame: 32,
  wires: 33,
  nodes: 34,
  text: 35,
  packet: 36,
} as const;

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export type GlassUniforms = {
  uSize: THREE.IUniform<THREE.Vector2>;
  uRadius: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  /** Brief overall lift while the display switches on. */
  uBoost: THREE.IUniform<number>;
};

/**
 * Smoked glass with a blue-violet light in it. One premultiplied pass both darkens
 * what is behind the panel and adds the glow on top, which is what keeps white text
 * readable over a bright backdrop such as the crystal or the Earth's limb.
 */
export function createGlassMaterial(width: number, height: number, radius: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: new THREE.Vector2(width, height) },
      uRadius: { value: radius },
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uTop: { value: new THREE.Color(COLORS.blue) },
      uBottom: { value: new THREE.Color(COLORS.violet) },
    },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec2 uSize;
      uniform float uRadius;
      uniform float uTime;
      uniform float uBoost;
      uniform vec3 uTop;
      uniform vec3 uBottom;

      float boxDistance(vec2 point, vec2 halfSize, float radius) {
        vec2 q = abs(point) - halfSize + radius;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      void main() {
        vec2 point = (vUv - 0.5) * uSize;
        float edge = boxDistance(point, uSize * 0.5, uRadius);
        float inside = 1.0 - smoothstep(-0.008, 0.008, edge);
        if (inside <= 0.0) discard;

        /* Dark in the middle and lit from its edges, as glass with a light in its frame is. */
        float rim = exp(edge * 5.5);
        float glow = exp(edge * 1.5);
        float lines = 0.5 + 0.5 * cos(point.y * 118.0);
        vec2 cells = abs(fract(point * 2.0) - 0.5);
        float grid = smoothstep(0.482, 0.497, max(cells.x, cells.y));
        float offset = (vUv.y - fract(uTime * 0.09) * 1.3 + 0.15) * 9.0;
        float sweep = exp(-offset * offset);
        float flicker = 0.975 + 0.025 * sin(uTime * 29.0) * sin(uTime * 7.3);

        vec3 tint = mix(uBottom, uTop, vUv.y);
        float light = 0.008 + glow * 0.035 + lines * 0.007 + grid * 0.014;
        light += rim * 0.16 + sweep * 0.022 + uBoost;

        gl_FragColor = vec4(tint * light * flicker * inside, 0.88 * inside);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

/**
 * Bright thin lines in the panel's own plane. Blended, unlike the kit's glow
 * materials: drawn in the opaque pass they would fight the glass for the same depth.
 */
export function createLineMaterial(color: string, intensity: number) {
  return new THREE.MeshBasicMaterial({
    color: hdr(color, intensity),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** The soft sheet of light running from the pad up to the panel. */
export function createRaysMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(COLORS.blue) },
      uStrength: { value: 0 },
    },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uStrength;

      void main() {
        float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float sides = smoothstep(0.0, 0.34, across);
        /* 1 at the pad, 0 at the panel: lifts off the pad softly, thins on the way up. */
        float rising = smoothstep(1.0, 0.82, vUv.y) * mix(0.3, 1.0, vUv.y);
        gl_FragColor = vec4(uColor * sides * rising * uStrength, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * The model's lines, drawn as thin tubes so that they hold their width and bloom.
 * `aKind` is 0 for row rails, 1 for wires and 2 for the request route; `aAlong` is
 * the distance along the wire. The route glows hot for a stretch behind `uHead`,
 * the packet's position, which gives the packet a trail for no extra geometry.
 */
export function createWireMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHead: { value: -1 },
      uWire: { value: new THREE.Color(COLORS.blue) },
      uHot: { value: new THREE.Color(COLORS.orange) },
    },
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aAlong;
      varying float vKind;
      varying float vAlong;
      void main() {
        vKind = aKind;
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vKind;
      varying float vAlong;
      uniform float uTime;
      uniform float uHead;
      uniform vec3 uWire;
      uniform vec3 uHot;

      void main() {
        vec3 color;
        if (vKind < 0.5) {
          color = uWire * 0.32;
        } else if (vKind < 1.5) {
          float dash = sin(vAlong * 15.0 - uTime * 5.0);
          color = uWire * (1.05 + 0.75 * smoothstep(0.1, 0.9, dash));
        } else {
          float behind = uHead - vAlong;
          float trail = behind < 0.0 ? 0.0 : exp(-behind * 2.4);
          color = uWire * 0.28 + uHot * trail * 5.0;
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * Glass boxes for the model's nodes. A single merged mesh, so each vertex carries
 * which node it belongs to and `uHeat` lights a node as the packet reaches it.
 * The bright line along each box edge comes from the distance to the box's faces.
 */
export function createNodeMaterial() {
  return new THREE.ShaderMaterial({
    defines: { MAX_NODES: MAX_MODEL_NODES },
    uniforms: {
      uHeat: { value: new Float32Array(MAX_MODEL_NODES) },
      uDefault: { value: new THREE.Color(COLORS.blue) },
      uAccent: { value: new THREE.Color(COLORS.cyan) },
      uHot: { value: new THREE.Color(COLORS.orange) },
    },
    vertexShader: /* glsl */ `
      attribute float aNode;
      attribute float aTone;
      attribute vec3 aLocal;
      attribute vec3 aHalf;
      uniform float uHeat[MAX_NODES];

      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocal;
      varying vec3 vHalf;
      varying float vTone;
      varying float vHeat;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalMatrix * normal;
        vViewPosition = -view.xyz;
        vLocal = aLocal;
        vHalf = aHalf;
        vTone = aTone;
        vHeat = uHeat[int(aNode)];
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocal;
      varying vec3 vHalf;
      varying float vTone;
      varying float vHeat;

      uniform vec3 uDefault;
      uniform vec3 uAccent;
      uniform vec3 uHot;

      void main() {
        float facing = abs(dot(normalize(vViewNormal), normalize(vViewPosition)));
        /* Clamped: a base that rounds below zero makes pow() a NaN, and bloom spreads a NaN. */
        float fresnel = pow(clamp(1.0 - facing, 0.0, 1.0), 2.2);

        /* The middle of the three face distances is small only along a box edge. */
        vec3 gap = vHalf - abs(vLocal);
        float middle = max(min(gap.x, gap.y), min(max(gap.x, gap.y), gap.z));
        float line = 1.0 - smoothstep(0.012, 0.042, middle);

        vec3 tone = vTone > 0.5 ? uAccent : uDefault;
        float level = vTone < -0.5 ? 0.5 : (vTone > 0.5 ? 1.5 : 1.0);

        vec3 color = tone * level * (0.03 + fresnel * 0.42 + line * 1.5);
        /* Heat stays on the outline: a filled box would drown its own white label. */
        color += uHot * vHeat * (0.07 + fresnel * 0.7 + line * 4.2);

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
