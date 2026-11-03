import * as THREE from 'three';
import type { Vec3 } from '../../world/vec';
import { hdr } from '../palette';

/**
 * Glowing lines as thin camera-facing strips.
 *
 * GL lines are one pixel wide and alias, and thin tubes shimmer when they get
 * small on screen. A strip that always turns to face the camera, with a soft
 * profile across it, stays smooth from any distance, and a minimum on-screen
 * width keeps it from dissolving at the opening shot. Every line on the crystal
 * shares one strip mesh, so they cost one draw call between them.
 */

export type Rgb = readonly [number, number, number];

/** A palette colour at an intensity, as plain numbers for a vertex attribute. */
export function rgb(hex: string, intensity: number): Rgb {
  const { r, g, b } = hdr(hex, intensity);
  return [r, g, b];
}

export interface RibbonStyle {
  /** World half-width of the whole strip, including its soft skirt. */
  width: number;
  /** The strip is never narrower than this many pixels either side of its centre. */
  minPixels: number;
  /** Colour above 1 at a point along the line. `t` runs 0 to 1. */
  color: (point: Vec3, t: number) => Rgb;
  /** Closes the line into a loop. */
  closed?: boolean;
  /**
   * Outward normal of the facet the line lies on. The line dims when that facet
   * turns away, so hidden edges recede and only the visible ones burn.
   */
  facet?: Vec3;
}

export class RibbonBuilder {
  private readonly positions: number[] = [];
  private readonly tangents: number[] = [];
  private readonly colors: number[] = [];
  private readonly shapes: number[] = [];
  private readonly facets: number[] = [];
  private readonly indices: number[] = [];

  add(points: Vec3[], style: RibbonStyle): void {
    const closed = style.closed === true;
    const line = closed ? [...points, points[0] as Vec3] : points;
    const count = line.length;
    const base = this.positions.length / 3;

    line.forEach((point, index) => {
      /* The tangent through a point: the next point minus the previous, wrapping on a loop. */
      const isSeam = closed && (index === 0 || index === count - 1);
      const before = isSeam ? line[count - 2] : line[Math.max(0, index - 1)];
      const after = isSeam ? line[1] : line[Math.min(count - 1, index + 1)];
      const from = before as Vec3;
      const to = after as Vec3;
      const color = style.color(point, index / (count - 1));

      for (const side of [-1, 1]) {
        this.positions.push(point.x, point.y, point.z);
        this.tangents.push(to.x - from.x, to.y - from.y, to.z - from.z);
        this.colors.push(color[0], color[1], color[2]);
        this.shapes.push(side, style.width, style.minPixels);
        this.facets.push(style.facet?.x ?? 0, style.facet?.y ?? 0, style.facet?.z ?? 0);
      }

      if (index < count - 1) {
        const a = base + index * 2;
        this.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('aTangent', new THREE.Float32BufferAttribute(this.tangents, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aShape', new THREE.Float32BufferAttribute(this.shapes, 3));
    geometry.setAttribute('aFacet', new THREE.Float32BufferAttribute(this.facets, 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

export function createRibbonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlow: { value: 1 },
      /** World units per pixel, per unit of distance from the camera. */
      uPixel: { value: 0.001 },
      /** The name plate as seen from the lens: centre and half-size, per unit of distance. */
      uPlate: { value: new THREE.Vector4(0, 0, 0, 0) },
      uPlateShade: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aTangent;
      attribute vec3 aColor;
      attribute vec3 aShape;
      attribute vec3 aFacet;

      uniform float uPixel;
      uniform vec4 uPlate;
      uniform float uPlateShade;

      varying float vSide;
      varying float vSharpness;
      varying vec3 vColor;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);

        /* Lines are far brighter than the plate is dark, and would show through its glass. */
        vec2 fromPlate = abs(view.xy / -view.z - uPlate.xy) - uPlate.zw;
        float behindPlate = 1.0 - smoothstep(-0.008, 0.0, max(fromPlate.x, fromPlate.y));

        /* Beside the lens a thin line would swell into a blurred column of light. */
        float clearOfLens = smoothstep(1.2, 6.0, -view.z);

        vec3 along = normalize(mat3(modelViewMatrix) * aTangent);
        vec3 across = normalize(cross(along, normalize(-view.xyz)));

        float pixel = uPixel * -view.z;
        float halfWidth = max(aShape.y, aShape.z * pixel);
        view.xyz += across * aShape.x * halfWidth;

        float visible = 1.0;
        if (dot(aFacet, aFacet) > 0.0) {
          float facing = dot(aFacet, normalize(cameraPosition - position));
          visible = mix(0.14, 1.0, smoothstep(-0.04, 0.1, facing));
        }

        /* The bright core stays at least a pixel or so wide, or thin lines break into dots. */
        vSharpness = min(42.0, pow(halfWidth / (pixel * 0.85), 2.0));
        vSide = aShape.x;
        vColor = aColor * visible * clearOfLens * (1.0 - behindPlate * uPlateShade * 0.88);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;

      varying float vSide;
      varying float vSharpness;
      varying vec3 vColor;

      void main() {
        float d = abs(vSide);
        float core = exp(-d * d * vSharpness);
        float skirt = exp(-d * d * 7.0) * max(0.0, 1.0 - d * d);
        vec3 hot = vColor + vec3(dot(vColor, vec3(0.33))) * 0.24;
        gl_FragColor = vec4((vColor * skirt * 0.42 + hot * core) * uGlow, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
