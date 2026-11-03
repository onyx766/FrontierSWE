'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { world } from '../../world/world';
import type { ActorLink } from './link';

/** Beside the head, at about the height of the eyes. */
const HEAD_HEIGHT = 1.55;
const HEAD_REACH = 0.82;
const LETTERS_PER_SECOND = 46;
const TICK_MS = 33;

const anchor = new THREE.Vector3();
const cameraRight = new THREE.Vector3();

interface BubbleElements {
  root: HTMLDivElement;
  typed: HTMLSpanElement;
  rest: HTMLSpanElement;
}

function createBubble(): BubbleElements {
  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.className = 'pointer-events-none absolute left-0 top-0 z-[8] hidden md:block';
  root.style.visibility = 'hidden';

  const box = document.createElement('div');
  box.className =
    'relative w-[300px] -translate-y-[38px] rounded-xl border border-white/15 bg-[#060a14]/90 ' +
    'px-4 py-3 text-[13px] leading-[1.45] text-[#e6edf8] shadow-[0_0_24px_rgba(63,157,255,0.22)]';

  const typed = document.createElement('span');
  const rest = document.createElement('span');
  rest.className = 'opacity-0';

  const tail = document.createElement('span');
  tail.className =
    'absolute left-[-5px] top-[33px] size-[9px] rotate-45 border-b border-l border-white/15 ' +
    'bg-[#060a14]';

  box.append(typed, rest, tail);
  root.append(box);
  return { root, typed, rest };
}

/**
 * What the robot is saying. The briefing panel carries the same words for screen
 * readers, so this is decoration to them. On narrow screens the panel takes over.
 *
 * It sits to the side of the head rather than above it. The robot stands on the
 * left of every station shot with the hologram above and beside it, so above is
 * the one place a long sentence would cover what it is explaining. The anchor is a
 * point in the world, on the camera's right of the head, so that the gap stays in
 * proportion however far away the camera is.
 *
 * This is a plain element rather than drei's `<Html>`. That runs its own React
 * root and unmounts it synchronously, which React reports as an error when the
 * whole canvas goes away, as it does on following a link to a case study. Nothing
 * here needs React in any case: the words are typed straight into the DOM, and the
 * position changes every frame.
 */
export function SpeechBubble({ link }: { link: ActorLink }) {
  const gl = useThree((state) => state.gl);
  const bubble = useRef<BubbleElements | null>(null);
  const active = useUniverse((state) => state.active);
  const beat = useUniverse((state) => state.beat);
  const reducedMotion = useUniverse((state) => state.reducedMotion);

  const speech = active ? world.briefing(active).beats[beat]?.speech : undefined;

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return undefined;

    const elements = createBubble();
    host.append(elements.root);
    bubble.current = elements;

    return () => {
      elements.root.remove();
      bubble.current = null;
    };
  }, [gl]);

  useEffect(() => {
    const elements = bubble.current;
    if (!elements) return undefined;

    if (!speech) {
      elements.root.style.visibility = 'hidden';
      return undefined;
    }

    /* The untyped remainder stays in the flow, invisibly, so that the bubble takes
       its final size at once and the words do not reflow as they arrive. */
    const show = (count: number) => {
      elements.typed.textContent = speech.slice(0, count);
      elements.rest.textContent = speech.slice(count);
    };

    if (reducedMotion) {
      show(speech.length);
      return undefined;
    }

    const start = performance.now();
    show(0);
    const timer = window.setInterval(() => {
      const count = Math.ceil(((performance.now() - start) / 1000) * LETTERS_PER_SECOND);
      show(count);
      if (count >= speech.length) window.clearInterval(timer);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [speech, reducedMotion]);

  useFrame(({ camera, size }) => {
    const element = bubble.current?.root;
    if (!element || !speech) return;

    /* The rig has just moved the camera, and the matrices follow only at render. */
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);

    const { robot } = runtime;
    anchor
      .set(
        robot.x + cameraRight.x * HEAD_REACH,
        link.driver.motion.groundY + HEAD_HEIGHT,
        robot.z + cameraRight.z * HEAD_REACH,
      )
      .project(camera);

    const x = Math.round(((anchor.x + 1) / 2) * size.width);
    const y = Math.round(((1 - anchor.y) / 2) * size.height);
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    element.style.visibility = anchor.z < 1 ? 'visible' : 'hidden';
  });

  return null;
}
