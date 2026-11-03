import * as THREE from 'three';
import { CRACK_TILE } from './gemTextures';

/**
 * The crystal's two glass passes.
 *
 * `body` draws the far walls. It absorbs most of what is behind the crystal, which
 * is what makes it read as a solid dark gem rather than a neon outline, and it
 * adds the far walls' own veins, so back faces show through the front ones. The
 * same walls would blind a camera that drifts inside, so they clear as it nears.
 *
 * `shell` draws the near walls additively. Fractures sit at three depths inside
 * the glass: the texture is read at offsets along the refracted view ray, so they
 * slide against each other as the camera moves and the volume looks real, for a
 * handful of texture reads and no noise at runtime.
 */

export interface GemTextures {
  cracks: THREE.Texture;
  marble: THREE.Texture;
}

const VERTEX = /* glsl */ `
  attribute vec3 aTangent;
  attribute vec4 aEdge;
  attribute vec2 aPane;
  attribute vec4 aFrost;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec2 vUv;
  varying vec4 vEdge;
  varying vec2 vPane;
  varying vec4 vFrost;

  void main() {
    vUv = uv;
    vEdge = aEdge;
    vPane = aPane;
    vFrost = aFrost;
    vNormal = normal;
    vTangent = aTangent;
    vWorld = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const SHARED = /* glsl */ `
  uniform sampler2D uCracks;
  uniform sampler2D uMarble;
  uniform float uTime;
  uniform float uGlow;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec2 vUv;
  varying vec4 vEdge;
  varying vec2 vPane;
  varying vec4 vFrost;

  /* Electric blue at the crown, through violet and magenta to hot orange below. */
  vec3 gemTint(float y) {
    const vec3 blue = vec3(0.03, 0.24, 1.0);
    const vec3 indigo = vec3(0.1, 0.14, 1.0);
    const vec3 violet = vec3(0.3, 0.13, 1.0);
    const vec3 magenta = vec3(0.72, 0.14, 0.86);
    const vec3 orange = vec3(1.0, 0.3, 0.05);

    vec3 color = mix(orange, magenta, smoothstep(-13.5, -11.0, y));
    color = mix(color, violet, smoothstep(-11.5, -7.0, y));
    color = mix(color, indigo, smoothstep(-4.0, 3.0, y));
    return mix(color, blue, smoothstep(3.0, 10.5, y));
  }

  /*
   * The clamp matters. With multisampling, a varying can be read beyond the edge of
   * a partly covered triangle, and on a facet seen edge-on that overshoots by a long
   * way, which an exp() of this value would turn into infinity and then a bloom flare.
   */
  float nearestEdge() {
    return max(0.0, min(min(vEdge.x, vEdge.y), min(vEdge.z, vEdge.w)));
  }

  /* Each pane is frosted to its own degree, with a clean joint between panes. */
  float paneFrost(vec2 wander) {
    vec2 side = smoothstep(-0.55, 0.55, vPane + wander * 2.6);
    return mix(mix(vFrost.x, vFrost.y, side.x), mix(vFrost.z, vFrost.w, side.x), side.y);
  }
`;

const BODY_FRAGMENT = /* glsl */ `
  ${SHARED}

  uniform float uSolid;

  void main() {
    vec3 cracks = texture2D(uCracks, vUv).rgb;
    vec3 marble = texture2D(uMarble, vUv * 2.1).rgb;

    float edge = nearestEdge();
    float tight = exp(-edge * 1.6);

    float y = vWorld.y + (marble.g - 0.5) * 5.0;
    vec3 tint = gemTint(y);

    vec3 color = vec3(0.004, 0.0075, 0.03) * (0.6 + 0.8 * marble.g);
    color += tint * marble.g * marble.g * 0.05;
    color += tint * marble.r * 0.14;
    color += tint * cracks.g * cracks.g * 0.3 * marble.b;
    color += mix(tint, vec3(1.0), 0.3) * cracks.r * 0.26 * marble.b;
    color += tint * tight * 0.07;
    color += tint * paneFrost(marble.gb - 0.5) * 0.04;

    gl_FragColor = vec4(color * uGlow * (0.22 + 0.78 * uSolid), 0.94 * uSolid);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  ${SHARED}

  uniform float uDetail;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 tangent = normalize(vTangent);
    vec3 bitangent = cross(normal, tangent);
    vec3 incident = normalize(vWorld - cameraPosition);
    float facing = clamp(-dot(incident, normal), 0.0, 1.0);

    /* The view ray once it has bent into the glass, in texture space per world unit. */
    vec3 refracted = refract(incident, normal, 0.66);
    vec2 ray = vec2(dot(refracted, tangent), dot(refracted, bitangent))
      / max(0.34, -dot(refracted, normal)) / ${CRACK_TILE.toFixed(1)};

    float crown = smoothstep(0.6, 0.95, normal.y);

    /* The crown's cracks run finer than the walls', as they do in the reference. */
    vec2 uvCracks = vUv * (1.0 + crown * 0.2);
    vec3 surface = texture2D(uCracks, uvCracks).rgb;
    vec3 middle = texture2D(uCracks, uvCracks * 1.31 + ray * 3.2 + vec2(0.37, 0.61)).rgb;
    vec3 cloudy = texture2D(uMarble, vUv * 2.1 + ray * 4.0).rgb;
    vec2 fine = texture2D(uMarble, vUv * 4.3 + ray * 2.5 + vec2(0.13, 0.57)).rg;
    float drift = texture2D(uMarble, vUv * 0.62 + vec2(uTime * 0.0042, -uTime * 0.0061)).b;

    /* The deepest fractures and the hairlines go first on a slow machine. */
    vec3 deep = vec3(0.0);
    float hairline = 0.0;
    if (uDetail > 0.5) {
      deep = texture2D(uCracks, uvCracks * 0.77 + ray * 8.5 + vec2(0.71, 0.23), 1.2).rgb;
      hairline = texture2D(uCracks, vUv * 3.7).b;
    }

    float plasma = fine.r;
    float grain = mix(cloudy.g, fine.g, 0.55);

    float edge = nearestEdge();
    float tight = exp(-edge * 2.1);
    float soft = exp(-edge * 0.34);

    /* Disturbing the height makes the colour bands burn into each other like flame. */
    float y = vWorld.y + (cloudy.g - 0.5) * 5.0;
    vec3 tint = gemTint(y);
    float base = 1.0 - smoothstep(-10.5, -2.0, vWorld.y);

    /* Cracks stay coloured down in the plasma and on the crown, and pale only between. */
    vec3 pale = mix(tint, vec3(0.8, 0.9, 1.0), 0.6 - 0.34 * max(crown, base));

    float pulse = 0.6 + 0.8 * drift;
    float patches = smoothstep(0.22, 0.6, cloudy.b);
    float cloud = cloudy.g * cloudy.g;
    float frost = paneFrost(cloudy.gb - 0.5);

    /* Saturated dark glass, lit from within only where something is happening. */
    vec3 wall = mix(tint, vec3(0.32, 0.36, 0.62), (1.0 - crown) * smoothstep(-2.0, 9.0, vWorld.y) * 0.72);
    vec3 color = wall * (0.006 + 0.016 * cloud) * (1.0 - crown * 0.5);

    /* Frost: on the crown it is the main light, on the walls a ghost of it. */
    color += wall * frost * (0.02 + 0.07 * cloud) * (1.0 - crown * 0.6);
    vec3 frosted = mix(tint, vec3(0.1, 0.5, 1.0), 0.55);
    float outward = smoothstep(3.0, 16.0, abs(vWorld.x));
    color += frosted * crown * frost * (0.015 + outward * (0.3 + 0.95 * grain * grain));

    /* Plasma gathers along the base. */
    color += tint * base * base * frost * (0.07 + 0.34 * cloud + 1.7 * plasma * (0.35 + patches));

    /* The front corner runs hottest, where the reference burns orange. */
    float heat = exp(-length(vWorld - vec3(3.5, -11.2, 14.5)) * 0.2);
    color += vec3(1.0, 0.34, 0.06) * heat * heat * (0.16 * cloud + 3.4 * plasma);

    /* From far off a crack is a soft line. Close to, only its centre stays hot. */
    float away = smoothstep(16.0, 70.0, length(vWorld - cameraPosition));
    float line = surface.r + middle.r * 0.34 + deep.r * 0.1;
    float core = mix(line * line * line * 2.4, line * 1.25, away);
    float glow = surface.g * 0.8 + middle.g * 0.4 + deep.g * 0.3;
    color += tint * glow * glow * (0.5 + crown * 0.7) * (0.2 + patches) * pulse;
    color += pale * core * (1.25 + crown * 0.7 - base * 0.65) * patches * patches * pulse;
    color += pale * hairline * mix(0.085, 0.03, away) * patches * pulse;

    /* A few veins run warm, as if lit by the spokes outside. */
    float embers = smoothstep(0.64, 0.82, cloudy.b) * (1.0 - base) * (1.0 - crown * 0.6);
    color += vec3(1.0, 0.42, 0.12) * embers * (glow * 0.14 + core * 0.22);

    color += wall * (tight * 0.42 + soft * soft * (0.035 - crown * 0.02));

    float grazing = pow(1.0 - facing, 4.0);
    color += vec3(0.12, 0.24, 0.7) * grazing * 0.22;

    /* Soft highlights from the key and the rim light slide over the facets as one walks by. */
    vec3 mirrored = reflect(incident, normal);
    float keySheen = pow(max(dot(mirrored, vec3(-0.72, 0.3, 0.62)), 0.0), 60.0);
    float rimSheen = pow(max(dot(mirrored, vec3(0.62, 0.42, -0.66)), 0.0), 34.0);
    color += vec3(0.9, 0.72, 0.6) * keySheen * 0.08 + vec3(0.3, 0.45, 1.0) * rimSheen * 0.1;

    gl_FragColor = vec4(color * uGlow, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface GemMaterials {
  body: THREE.ShaderMaterial;
  shell: THREE.ShaderMaterial;
}

export function createGemMaterials(textures: GemTextures): GemMaterials {
  const shared = {
    uCracks: { value: textures.cracks },
    uMarble: { value: textures.marble },
    uTime: { value: 0 },
    uGlow: { value: 1 },
  };

  const body = new THREE.ShaderMaterial({
    uniforms: { ...shared, uSolid: { value: 1 } },
    vertexShader: VERTEX,
    fragmentShader: BODY_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  const shell = new THREE.ShaderMaterial({
    uniforms: { ...shared, uDetail: { value: 1 } },
    vertexShader: VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { body, shell };
}
