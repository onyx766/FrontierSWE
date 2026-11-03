'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { runtime } from '../state/runtime';
import { useUniverse } from '../state/store';
import { HERO_SHOT, REFERENCE_FRAME, world } from '../world/world';
import { heroPosition, poseHeroCamera } from './heroCamera';
import { LAYER_NAMES, LAYERS, type LayerName } from './layers';

/**
 * The canvas and the layer composition. Everything visible lives in `layers.ts`;
 * this file only owns the renderer, readiness and the failure paths.
 */

export interface LabCamera {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

interface UniverseSceneProps {
  /** Lab only: render just these layers. */
  only?: LayerName[];
  /** Lab only: hold the camera here instead of the opening shot. */
  labCamera?: LabCamera;
}

class LayerBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`Universe layer "${this.props.name}" failed`, error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Marks the scene ready after real frames have been presented, not merely mounted. */
function ReadyWhenRendering() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) useUniverse.getState().markReady();
  });
  useEffect(() => () => useUniverse.getState().markUnmounted(), []);
  return null;
}

function HoldCamera({ camera: shot }: { camera: LabCamera }) {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.position.set(...shot.position);
    perspective.fov = shot.fov;
    perspective.clearViewOffset();
    perspective.updateProjectionMatrix();
    perspective.lookAt(...shot.target);
  }, [camera, shot]);

  useFrame(() => {
    runtime.view.x = camera.position.x;
    runtime.view.y = camera.position.y;
    runtime.view.z = camera.position.z;
  });

  return null;
}

function HeroPose() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useLayoutEffect(() => {
    poseHeroCamera(camera as THREE.PerspectiveCamera, size.width, size.height);
  }, [camera, size]);
  return null;
}

/** Exposes the world to the browser console and to `scripts/shot.mjs`. */
function DebugBridge() {
  const state = useThree();
  useEffect(() => {
    const target = window as unknown as { __universe?: unknown };
    target.__universe = { store: useUniverse, runtime, world, three: state };
    return () => {
      delete target.__universe;
    };
  }, [state]);
  return null;
}

export default function UniverseScene({ only, labCamera }: UniverseSceneProps) {
  const names = only ?? LAYER_NAMES;
  const hasActor = names.includes('actor');

  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      camera={{
        fov: HERO_SHOT.fov,
        near: 0.5,
        far: 9000,
        position: heroPosition(REFERENCE_FRAME.width / REFERENCE_FRAME.height).toArray(),
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#02040b', 1);
        useUniverse.getState().setWebgl('ok');
      }}
      fallback={null}
      aria-hidden
    >
      <Suspense fallback={null}>
        {names.map((name) => {
          const Layer = LAYERS[name];
          return (
            <LayerBoundary key={name} name={name}>
              <Layer />
            </LayerBoundary>
          );
        })}
        <ReadyWhenRendering />
      </Suspense>

      {labCamera ? <HoldCamera camera={labCamera} /> : null}
      {!labCamera && !hasActor ? <HeroPose /> : null}
      <DebugBridge />
    </Canvas>
  );
}
