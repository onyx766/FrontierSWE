'use client';

import { Component, useState, type ReactNode } from 'react';
import { CameraRig } from './CameraRig';
import { createActorLink } from './link';
import { placeRobot } from './placement';
import { Robot } from './Robot';
import { RobotController } from './RobotController';

/**
 * Keeps the camera and controls alive if the model fails to load. Without the
 * rig the opening shot would never be posed, and one missing file should cost
 * the visitor the robot, not the whole composition.
 */
class RobotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('The robot failed to load', error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The visitor's presence in the world: the robot, the controls, the autopilot,
 * the station logic and the camera. Everything that moves the robot is in
 * `driver.ts` and everything that moves the camera is in `rig.ts`, both without
 * React, so this layer only connects them to the frame loop.
 */
export default function ActorLayer() {
  const [link] = useState(() => {
    placeRobot();
    return createActorLink();
  });

  return (
    <>
      <RobotController link={link} />
      <CameraRig link={link} />
      <RobotBoundary>
        <Robot link={link} />
      </RobotBoundary>
    </>
  );
}
