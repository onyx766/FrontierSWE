'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { world } from '../../world/world';
import { applyLensShift } from '../heroCamera';
import type { ActorLink } from './link';
import { Rig, type RigFrame } from './rig';

/** Same limit as the controller, so that the camera keeps pace with the robot. */
const MAX_DELTA = 1 / 20;
/** After the controller, before the robot is drawn where the two agree. */
const PRIORITY = -2;

/** Pixels a press must travel to count as a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** Wheel pixels to a factor on the camera distance. */
const ZOOM_SPEED = 0.0011;
const LINE_HEIGHT = 16;
/** Below this the briefing is a bottom sheet rather than a side panel. */
const NARROW_WIDTH = 768;
/** Under this a shift is treated as none, which turns the view offset off entirely. */
const NO_SHIFT = 1e-4;

/** `/lab?cam=...` holds the camera for a fixed shot, and the rig must not fight it. */
function isHeldByLab(): boolean {
  return new URLSearchParams(window.location.search).has('cam');
}

/** The one thing that moves the camera. The logic is in `rig.ts`. */
export function CameraRig({ link }: { link: ActorLink }) {
  const gl = useThree((state) => state.gl);
  const [held] = useState(isHeldByLab);

  const [frame] = useState<RigFrame>(() => {
    const { phase, active, reducedMotion } = useUniverse.getState();
    return {
      phase,
      station: active ? world.station(active) : null,
      aspect: window.innerWidth / window.innerHeight,
      narrow: window.innerWidth < NARROW_WIDTH,
      reducedMotion,
      robot: runtime.robot,
      motion: link.driver.motion,
      steering: false,
      dragging: false,
    };
  });

  const [rig] = useState(() => new Rig(frame, world.surface, world.network.blockers));

  useEffect(() => {
    const element = gl.domElement;
    /* The rig reads every touch; the browser must not take them for scrolling. */
    element.style.touchAction = 'none';

    let pointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      if (!runtime.view.dragging) {
        const travelled = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (travelled < DRAG_THRESHOLD) return;
        runtime.view.dragging = true;
      }
      rig.drag(dx, dy);
    };

    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      runtime.view.dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || pointer !== null) return;
      if (useUniverse.getState().phase === 'loading') return;
      pointer = event.pointerId;
      startX = lastX = event.clientX;
      startY = lastY = event.clientY;
      /* On the window, so a drag survives passing over the HUD. */
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (useUniverse.getState().phase === 'loading') return;
      const pixels = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT : event.deltaY;
      rig.zoom(Math.exp(pixels * ZOOM_SPEED));
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      runtime.view.dragging = false;
    };
  }, [gl, rig]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, MAX_DELTA);
    const { phase, active, reducedMotion } = useUniverse.getState();
    const { width, height } = state.size;

    frame.phase = phase;
    frame.station = active ? world.station(active) : null;
    frame.aspect = width / height;
    frame.narrow = width < NARROW_WIDTH;
    frame.reducedMotion = reducedMotion;
    frame.steering = link.steering;
    frame.dragging = runtime.view.dragging;

    if (link.recenter) {
      link.recenter = false;
      rig.recenter(reducedMotion);
    }

    rig.update(frame, dt);
    link.basisAzimuth = rig.basisAzimuth;

    if (held) return;

    const camera = state.camera as THREE.PerspectiveCamera;
    const { pose, camera: position } = rig;
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(pose.x, pose.y, pose.z);
    camera.fov = pose.fov;
    applyLensShift(
      camera,
      width,
      height,
      Math.abs(pose.shiftX) < NO_SHIFT ? 0 : pose.shiftX,
      Math.abs(pose.shiftY) < NO_SHIFT ? 0 : pose.shiftY,
    );
    camera.updateProjectionMatrix();

    runtime.view.x = position.x;
    runtime.view.y = position.y;
    runtime.view.z = position.z;
  }, PRIORITY);

  return null;
}
