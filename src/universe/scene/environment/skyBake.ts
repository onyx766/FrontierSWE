import * as THREE from 'three';
import { getComposition, heroRay } from './composition';
import { NOISE_GLSL } from './noiseField';

/**
 * The sky, painted once at startup and never computed again.
 *
 * Two cubes come out of one shader. The background is what the visitor sees. The
 * reflection cube is what dark metal sees: the same sky, without stars, plus the
 * things that actually light this world, which is the Earth's limb, the low sun
 * and broad soft panels. It is filtered by PMREM, so it costs nothing per frame.
 * Without it gunmetal would reflect near-black space and read as flat grey.
 */

export interface SkyBake {
  background: THREE.CubeTexture;
  environment: THREE.Texture;
  dispose(): void;
}

const VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform highp sampler3D uNoise;
  uniform vec3 uBandNormal;
  uniform vec3 uBandCore;
  uniform vec3 uNebula;
  uniform vec3 uNebulaAxis;
  uniform vec3 uWarmDust;
  uniform vec3 uDarkCloud;
  uniform vec3 uPinkCloud;
  uniform vec3 uTealCloud;
  uniform vec3 uMagentaCloud;
  uniform vec3 uEarthAxis;
  uniform float uEarthCos;
  uniform vec3 uSun;

  varying vec3 vDirection;

  ${NOISE_GLSL}

  /* A soft round patch of sky. sharpness 8 is about 20 degrees, 130 about 5. */
  float lobe(vec3 d, vec3 center, float sharpness) {
    return exp(sharpness * (dot(d, center) - 1.0));
  }

  vec3 nebulae(vec3 d) {
    float broad = fbm(d * 2.7 + vec3(1.7, 9.2, 4.4), 5);
    float warp = fbm(d * 2.1 + vec3(21.0, 3.0, 8.0), 4);

    /* Navy, never black: the eye reads pure black as an empty canvas. */
    vec3 color = mix(
      vec3(0.0052, 0.0104, 0.0200),
      vec3(0.0100, 0.0200, 0.0420),
      smoothstep(-0.20, 0.28, broad)
    );

    /* A galactic band, so that every direction has some structure in it. */
    float latitude = dot(d, uBandNormal) + warp * 0.34;
    float band = exp(-latitude * latitude / 0.030);
    float glow = exp(-latitude * latitude / 0.200);
    float filaments = ridged(d * 3.4 + warp * 3.0 + vec3(31.0, 7.0, 13.0), 6);
    float lanes = smoothstep(-0.02, 0.26, fbm(d * 5.4 + warp * 2.6 + vec3(4.0, 40.0, 19.0), 6));
    float coreGlow = lobe(d, uBandCore, 5.0);

    vec3 bandColor = mix(vec3(0.035, 0.040, 0.150), vec3(0.150, 0.080, 0.340), filaments);
    bandColor = mix(bandColor, vec3(0.34, 0.17, 0.26), coreGlow * 0.55);
    color += glow * vec3(0.002, 0.003, 0.009);
    color += band * bandColor * (0.10 + 0.34 * filaments * filaments) * (1.0 - lanes * 0.82);

    /* Wispy indigo cloud at the upper right of the opening shot, reaching past the planet. */
    vec3 fromNebula = d - uNebula;
    float reach = dot(fromNebula, uNebulaAxis);
    float offAxis = dot(fromNebula, cross(uNebulaAxis, uNebula)) + warp * 0.05;
    float shape = exp(-pow(reach / 0.062, 2.0) - pow(offAxis / 0.021, 2.0));
    vec3 stretched = d - uNebulaAxis * reach * 0.72;
    float gas = fbm(stretched * 15.0 + warp * 3.5 + vec3(5.0, 11.0, 2.0), 6, 0.56);
    float rifts = fbm(stretched * 31.0 + warp * 6.0 + vec3(25.0, 3.0, 14.0), 5, 0.6);
    float density = smoothstep(-0.12, 0.2, gas) * (1.0 - smoothstep(-0.04, 0.2, rifts) * 0.8);
    color += shape * density * mix(vec3(0.030, 0.050, 0.200), vec3(0.150, 0.100, 0.460), density);

    /* Faint warm dust left of centre. */
    float dust = fbm(d * 8.5 + warp * 2.0 + vec3(17.0, 2.0, 33.0), 6);
    color += lobe(d, uWarmDust, 60.0) * smoothstep(-0.16, 0.28, dust)
      * vec3(0.0120, 0.0056, 0.0030);

    /* A dark cloud at the upper left, where the reference shows stars thinning. */
    float shade = smoothstep(-0.20, 0.18, fbm(d * 6.0 + vec3(3.0, 27.0, 12.0), 5));
    color *= 1.0 - lobe(d, uDarkCloud, 90.0) * shade * 0.72;

    /* Small magenta knot low on the right, just off the Earth's limb. */
    float knot = ridged(d * 26.0 + warp * 7.0 + vec3(9.0, 1.0, 37.0), 5);
    color += lobe(d, uPinkCloud, 9000.0) * vec3(0.05, 0.016, 0.08) * (0.05 + 2.0 * knot * knot);

    /* Far-side colour, for the visitor who turns around. */
    float tealShape = smoothstep(-0.16, 0.30, fbm(d * 3.6 + warp * 3.0 + vec3(13.0, 50.0, 3.0), 6));
    color += lobe(d, uTealCloud, 9.0) * tealShape * vec3(0.012, 0.070, 0.095);
    float magentaShape = ridged(d * 3.0 + warp * 3.4 + vec3(60.0, 8.0, 22.0), 5);
    color += lobe(d, uMagentaCloud, 12.0) * magentaShape * magentaShape
      * vec3(0.190, 0.042, 0.170);

    return color;
  }

  vec4 hash(vec3 cell) {
    vec4 p = fract(cell.xyzx * vec4(0.1031, 0.1030, 0.0973, 0.1099));
    p += dot(p, p.wzxy + 33.33);
    return fract((p.xxyz + p.yzzw) * p.zywx);
  }

  /* Fine stars too faint to deserve a point each. */
  vec3 starLayer(vec3 d, float scale, float threshold, float size, float gain) {
    vec3 p = d * scale;
    vec3 cell = floor(p);
    vec4 random = hash(cell);
    if (random.a < threshold) return vec3(0.0);
    vec3 star = cell + 0.2 + random.rgb * 0.6;
    float distance = length(p - star);
    float brightness = (random.a - threshold) / (1.0 - threshold);
    float shape = smoothstep(size, 0.0, distance);
    vec3 tint = mix(vec3(1.0, 0.72, 0.46), vec3(0.62, 0.78, 1.0), random.r);
    return tint * shape * shape * (0.3 + brightness * 0.7) * gain;
  }

  vec3 stars(vec3 d, float density) {
    return starLayer(d, 300.0, 0.955 - density * 0.05, 0.34, 0.045)
      + starLayer(d.zxy, 460.0, 0.925 - density * 0.07, 0.42, 0.030)
      + starLayer(d.yzx, 640.0, 0.900 - density * 0.09, 0.50, 0.022);
  }

  #ifdef REFLECTION
    /* What metal sees. Values are far above 1: dark gunmetal reflects about 3%. */
    vec3 lightPanels(vec3 d) {
      vec3 color = vec3(0.0);

      /* The Earth fills the lower sky, and its limb is a bright horizon band. */
      float along = dot(d, uEarthAxis);
      float earth = smoothstep(uEarthCos - 0.015, uEarthCos + 0.015, along);
      color = mix(color, vec3(0.03, 0.075, 0.17), earth);
      float limb = exp(-pow((along - uEarthCos) / 0.03, 2.0));
      color += limb * vec3(0.7, 1.6, 3.8);

      /* The low sun, and a warm wash around it. */
      color += lobe(d, uSun, 900.0) * vec3(52.0, 38.0, 25.0);
      color += lobe(d, uSun, 30.0) * vec3(1.4, 0.72, 0.3);

      /*
       * Small, bright panels rather than wide dim ones. A mirror-like surface sees
       * only the panel's brightness, while rough rock integrates its area, so this
       * is what keeps metal lit and rock dark.
       */
      color += lobe(d, normalize(vec3(0.05, 0.55, -0.83)), 16.0) * vec3(1.2, 2.0, 4.4);
      color += lobe(d, normalize(vec3(0.75, 0.42, -0.5)), 26.0) * vec3(0.7, 0.4, 1.7);
      color += lobe(d, normalize(vec3(0.55, 0.05, 0.83)), 40.0) * vec3(2.4, 1.15, 0.36);

      return color;
    }
  #endif

  void main() {
    vec3 d = normalize(vDirection);

    #ifdef REFLECTION
      gl_FragColor = vec4(nebulae(d) + lightPanels(d), 1.0);
    #else
      float density = exp(-pow(dot(d, uBandNormal) / 0.28, 2.0));
      gl_FragColor = vec4(nebulae(d) + stars(d, density), 1.0);
    #endif
  }
`;

function skyUniforms(noise: THREE.Data3DTexture) {
  const { earth, sunDirection } = getComposition();

  /* The band's great circle runs through the corner of the opening shot. */
  const bandStart = heroRay(1.38, 0.2);
  const bandEnd = heroRay(1.02, -0.44);
  const bandNormal = bandStart.clone().cross(bandEnd).normalize();
  const bandCore = bandEnd.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0.83, 0));

  const earthDistance = earth.center.length();

  return {
    uNoise: { value: noise },
    uBandNormal: { value: bandNormal },
    uBandCore: { value: bandCore.normalize() },
    uNebula: { value: heroRay(1.0, 0.098) },
    uNebulaAxis: {
      value: heroRay(1.03, 0.08).sub(heroRay(0.93, 0.17)).normalize(),
    },
    uWarmDust: { value: heroRay(0.13, 0.5) },
    uDarkCloud: { value: heroRay(0.255, 0.135) },
    uPinkCloud: { value: heroRay(0.803, 0.887) },
    uTealCloud: { value: new THREE.Vector3(-0.55, 0.45, 0.7).normalize() },
    uMagentaCloud: { value: new THREE.Vector3(0.8, 0.3, 0.52).normalize() },
    uEarthAxis: { value: earth.center.clone().normalize() },
    uEarthCos: { value: Math.cos(Math.asin(earth.radius / earthDistance)) },
    uSun: { value: sunDirection.clone() },
  };
}

function bakeCube(
  renderer: THREE.WebGLRenderer,
  material: THREE.ShaderMaterial,
  target: THREE.WebGLCubeRenderTarget,
): void {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(2, 2, 2);
  const mesh = new THREE.Mesh(box, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const camera = new THREE.CubeCamera(0.1, 10, target);
  camera.update(renderer, scene);

  box.dispose();
}

export function bakeSky(
  renderer: THREE.WebGLRenderer,
  noise: THREE.Data3DTexture,
  faceSize: number,
): SkyBake {
  const uniforms = skyUniforms(noise);

  const shared = {
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  };
  const skyMaterial = new THREE.ShaderMaterial(shared);
  const reflectionMaterial = new THREE.ShaderMaterial({ ...shared, defines: { REFLECTION: 1 } });

  /* Half float keeps the darkest navy free of banding. */
  const cubeOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const skyTarget = new THREE.WebGLCubeRenderTarget(faceSize, cubeOptions);
  const reflectionTarget = new THREE.WebGLCubeRenderTarget(192, cubeOptions);

  bakeCube(renderer, skyMaterial, skyTarget);
  bakeCube(renderer, reflectionMaterial, reflectionTarget);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const filtered = pmrem.fromCubemap(reflectionTarget.texture);
  pmrem.dispose();

  skyMaterial.dispose();
  reflectionMaterial.dispose();
  reflectionTarget.dispose();

  return {
    background: skyTarget.texture,
    environment: filtered.texture,
    dispose() {
      skyTarget.dispose();
      filtered.dispose();
    },
  };
}
