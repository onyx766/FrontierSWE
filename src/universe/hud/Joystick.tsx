'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { runtime } from '../state/runtime';
import { useUniverse } from '../state/store';
import { stickVector } from './stick';

function Stick() {
  const knob = useRef<HTMLDivElement>(null);

  const release = () => {
    runtime.input.touchX = 0;
    runtime.input.touchY = 0;
    if (knob.current) knob.current.style.transform = '';
  };

  /* A stick unmounted mid-push must not leave the robot walking. */
  useEffect(() => release, []);

  const steer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    const offsetX = event.clientX - (rect.left + radius);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    const { x, y } = stickVector(offsetX, offsetY, radius);

    runtime.input.touchX = x;
    runtime.input.touchY = y;
    if (knob.current) {
      const travel = radius * 0.62;
      knob.current.style.transform = `translate3d(${x * travel}px, ${-y * travel}px, 0)`;
    }
  };

  return (
    /* A pointer gesture only: keyboard and screen-reader visitors have the mission log. */
    <div
      className="uh-stick"
      aria-hidden
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        steer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) steer(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={knob} className="uh-stick-knob" />
    </div>
  );
}

/** The on-screen stick. It writes straight to `runtime.input`, which the robot reads each frame. */
export function Joystick() {
  const show = useUniverse((state) => state.touch && state.phase === 'explore');
  return show ? <Stick /> : null;
}
