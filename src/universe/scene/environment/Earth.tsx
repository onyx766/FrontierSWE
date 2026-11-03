'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { heroReferenceCamera } from '../heroCamera';
import { getComposition, heroRay } from './composition';
import { earthFrame, type EarthBake } from './earthBake';
import { skyClock } from './skyClock';

/**
 * The Earth. A low-poly shell only marks which pixels might show it; the sphere
 * itself is intersected analytically per pixel, so the limb is a perfect curve at
 * any distance and the planet costs a few texture reads and no triangles.
 *
 * It is drawn after the world's opaque geometry, so pixels hidden by islands are
 * skipped, and it composites over the stars with premultiplied alpha: the disc
 * replaces them, the atmosphere adds to them.
 */

const SHELL_MARGIN = 340;

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDetail;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform vec3 uAxisX;
  uniform vec3 uAxisY;
  uniform float uCapSin;
  uniform vec3 uDaylight;
  uniform vec3 uSun;
  uniform vec2 uSunOnMap;
  uniform float uTime;

  varying vec3 vWorld;

  vec2 mapUv(vec2 p) {
    return 0.5 + p / (2.0 * uCapSin);
  }

  void main() {
    vec3 ray = normalize(vWorld - cameraPosition);
    vec3 toCenter = uCenter - cameraPosition;
    float along = dot(toCenter, ray);
    float missSquared = dot(toCenter, toCenter) - along * along;
    float miss = sqrt(max(missSquared, 0.0));
    float altitude = miss - uRadius;

    /* Rays that miss land on the point of closest approach, which keeps uv derivatives sane at the limb. */
    float chord = sqrt(max(uRadius * uRadius - missSquared, 0.0));
    vec3 normal = normalize(cameraPosition + ray * (along - chord) - uCenter);

    vec2 p = vec2(dot(normal, uAxisX), dot(normal, uAxisY));
    vec4 map = texture2D(uMap, mapUv(p));

    /* The weather turns slowly about the point below the world. The ground does not. */
    float turn = uTime * 0.00035;
    float cosTurn = cos(turn);
    float sinTurn = sin(turn);
    vec2 weather = vec2(cosTurn * p.x - sinTurn * p.y, sinTurn * p.x + cosTurn * p.y);
    vec4 weatherMap = texture2D(uMap, mapUv(weather));
    float cloudField = weatherMap.r;
    float cirrus = weatherMap.a;
    float cloudTowardSun = texture2D(uMap, mapUv(weather + uSunOnMap * 0.0026)).r;

    vec4 detail = texture2D(uDetail, p * 15.3);
    vec4 fineDetail = texture2D(uDetail, vec2(p.y, -p.x) * 41.7 + 0.37);

    float mu = clamp(-dot(normal, ray), 0.0, 1.0);
    float sunlight = dot(normal, uDaylight);
    float day = smoothstep(-0.15, 0.085, sunlight);

    /* Ground: black land with real relief, and a sea that lifts towards the coast. */
    float land = smoothstep(0.495, 0.515, map.g + (detail.g - 0.5) * 0.06);
    float relief = 0.5 + detail.g * 0.7 + fineDetail.g * 0.4;
    float shelf = smoothstep(0.34, 0.5, map.g);
    vec3 ocean = mix(vec3(0.0070, 0.0135, 0.0270), vec3(0.0250, 0.0520, 0.1040), day);
    ocean *= 0.8 + shelf * 0.5;
    vec3 ground = mix(vec3(0.0085, 0.0095, 0.0125), vec3(0.0520, 0.0520, 0.0620), day) * relief;
    ground = mix(ground, vec3(0.1100, 0.0620, 0.0380), smoothstep(0.26, 0.8, map.b) * 0.65);
    vec3 surface = mix(ocean, ground, land);

    /* Air, pale along the limb where the eye looks through the most of it. The ramp is
       measured off the reference: slate, then blue, then nearly white. */
    float limbLit = 0.34 + 0.66 * smoothstep(-0.26, 0.1, sunlight);
    float depth = mix(0.092, 0.135, smoothstep(0.0, 0.1, sunlight));
    float air = exp(-mu * mu / (depth * depth));
    vec3 airColor = mix(vec3(0.0570, 0.1050, 0.2100), vec3(0.0600, 0.1700, 0.4700), smoothstep(0.07, 0.2, air));
    airColor = mix(airColor, vec3(0.1100, 0.2600, 0.8300), smoothstep(0.2, 0.35, air));
    airColor = mix(airColor, vec3(0.0300, 0.4200, 2.5500), smoothstep(0.35, 0.6, air));
    airColor = mix(airColor, vec3(0.0200, 0.9000, 5.5000), smoothstep(0.6, 1.0, air));
    airColor *= limbLit;
    float airAmount = smoothstep(0.0, 0.14, air);
    surface = mix(surface, airColor, airAmount);

    /* A wider veil of the same air, which is what makes the surface recede. */
    vec3 veil = vec3(0.0210, 0.0480, 0.1300) * exp(-mu * mu / 0.095) * limbLit;

    /* Clouds, eroded by fine noise so their edges stay crisp up close. */
    float eroded = cloudField + (detail.r - 0.5) * 0.3 + (fineDetail.r - 0.5) * 0.16;
    float cloud = smoothstep(0.47, 0.6, eroded);
    float thick = smoothstep(0.54, 0.86, eroded);
    float thin = cirrus * cirrus * mix(0.06, 0.2, day) * (1.0 - cloud);

    /* Height against the sun gives a cheap self-shadow: the sunward slope is the bright one. */
    float slope = clamp(0.5 + (cloudTowardSun - cloudField) * 9.0, 0.0, 1.0);
    float shaded = thick * 0.65 + slope * 0.35;

    vec3 cloudNight = mix(vec3(0.0160, 0.0260, 0.0480), vec3(0.0560, 0.0800, 0.1340), shaded);
    vec3 cloudDay = mix(vec3(0.1500, 0.2500, 0.5200), vec3(0.0300, 0.9400, 5.8500), shaded * shaded);
    vec3 cloudColor = mix(cloudNight, cloudDay, day);

    /* Cloud tops stand above most of the air, so they keep their shape through the haze. */
    cloudColor = mix(cloudColor, airColor, airAmount * 0.55);
    surface = mix(surface, cloudColor, max(cloud, thin));

    /* City lights: density plus grain gives a heat, which reads as glow, then dabs, then core. */
    float grain = detail.b * 0.6 + fineDetail.b * 0.4;
    float heat = map.b + (grain - 0.5) * 0.62 * smoothstep(0.0, 0.14, map.b);
    vec3 city = vec3(0.1500, 0.0600, 0.0220) * smoothstep(0.1, 0.5, heat);
    city += vec3(0.4600, 0.1300, 0.0300) * smoothstep(0.4, 0.62, heat);
    city += vec3(0.6200, 0.3800, 0.2000) * smoothstep(0.6, 0.84, heat);
    surface += city * (1.0 - cloud * 0.9) * (1.0 - day * 0.45) * (1.0 - airAmount);
    surface += veil;

    /* Above the surface the same air thins out into space. */
    float height = max(altitude, 0.0);
    vec3 line = vec3(0.0200, 0.4200, 4.4000) * exp(-height / 4.6);
    vec3 halo = vec3(0.0270, 0.0620, 0.1350) * exp(-height / 63.0);
    float towardSun = pow(max(dot(ray, uSun), 0.0), 900.0);
    vec3 atmosphere = (line + halo) * limbLit * (1.0 + towardSun * 1.5);

    float width = fwidth(altitude);
    float disc = 1.0 - smoothstep(-width, width, altitude);

    gl_FragColor = vec4(surface * disc + atmosphere * (1.0 - disc), disc);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function daylightDirection(): THREE.Vector3 {
  const { earth } = getComposition();
  const camera = heroReferenceCamera();
  const fromCenter = camera.position.clone().sub(earth.center).normalize();

  /* Daylight leans towards the far right of the visible limb, so the frame darkens to the bottom-left. */
  const limbRay = heroRay(0.74, 0.955);
  const toLimb = camera.position.clone().sub(earth.center);
  const limbPoint = camera.position
    .clone()
    .addScaledVector(limbRay, -toLimb.dot(limbRay))
    .sub(earth.center)
    .normalize();
  const tangent = limbPoint.sub(fromCenter.clone().multiplyScalar(limbPoint.dot(fromCenter)));
  tangent.normalize();

  const angle = THREE.MathUtils.degToRad(113);
  return fromCenter.multiplyScalar(Math.cos(angle)).addScaledVector(tangent, Math.sin(angle));
}

export function Earth({ bake }: { bake: EarthBake }) {
  const { earth, sunDirection } = getComposition();

  const mesh = useMemo(() => {
    const frame = earthFrame();
    const daylight = daylightDirection();
    const sunOnMap = new THREE.Vector2(daylight.dot(frame.x), daylight.dot(frame.y)).normalize();
    const geometry = new THREE.IcosahedronGeometry(1, 8);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: bake.map },
        uDetail: { value: bake.detail },
        uCenter: { value: earth.center },
        uRadius: { value: earth.radius },
        uAxisX: { value: frame.x },
        uAxisY: { value: frame.y },
        uCapSin: { value: frame.capSin },
        uDaylight: { value: daylight },
        uSunOnMap: { value: sunOnMap },
        uSun: { value: sunDirection },
        uTime: skyClock,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
    });
    const object = new THREE.Mesh(geometry, material);
    object.position.copy(earth.center);
    object.scale.setScalar(earth.radius + SHELL_MARGIN);
    object.renderOrder = 1001;
    return object;
  }, [bake, earth, sunDirection]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
}
