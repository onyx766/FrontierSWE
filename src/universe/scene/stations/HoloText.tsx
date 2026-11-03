'use client';

import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentProps, type RefObject } from 'react';
import * as THREE from 'three';
import { HOLO_ORDER } from './holoMaterials';

export const HOLO_FONT = {
  bold: '/fonts/Geist-Bold.ttf',
  semiBold: '/fonts/Geist-SemiBold.ttf',
  medium: '/fonts/Geist-Medium.ttf',
  regular: '/fonts/Geist-Regular.ttf',
  mono: '/fonts/GeistMono-Medium.ttf',
} as const;

/** For text that does not fade. */
export const SOLID: RefObject<number> = { current: 1 };

/** The parts of a troika text mesh this layer uses. */
export interface TextMesh extends THREE.Mesh {
  fillOpacity: number;
  /** Set after the text is laid out: [minX, minY, maxX, maxY]. */
  textRenderInfo: { blockBounds: [number, number, number, number] } | null;
}

/**
 * Text only reads from the front; from behind it would be mirrored, so it is
 * hidden. Each text owns its material because troika keeps a derived copy alive
 * until the base is disposed, and a hologram's text comes and goes with the visitor.
 */
function createTextMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

type HoloTextProps = Omit<ComponentProps<typeof Text>, 'ref' | 'material' | 'fillOpacity'> & {
  /** The owner's fade, 0 to 1, read every frame. */
  fade: RefObject<number>;
  opacity?: number;
  onMesh?: (mesh: TextMesh | null) => void;
};

/** drei Text set up for the hologram: local fonts only, fading with its panel. */
export function HoloText({ fade, opacity = 1, onMesh, children, ...props }: HoloTextProps) {
  const mesh = useRef<TextMesh | null>(null);
  const material = useMemo(createTextMaterial, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (mesh.current) mesh.current.fillOpacity = fade.current * opacity;
  });

  return (
    <Text
      ref={(value: THREE.Mesh | null) => {
        mesh.current = value as TextMesh | null;
        onMesh?.(mesh.current);
      }}
      material={material}
      renderOrder={HOLO_ORDER.text}
      {...props}
    >
      {children}
    </Text>
  );
}
