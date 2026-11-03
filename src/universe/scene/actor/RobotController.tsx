'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { world } from '../../world/world';
import { STICK_DEADZONE, type DriveInput } from './driver';
import type { ActorLink } from './link';
import { saveRobotPosition } from './placement';
import { combineSticks } from './steering';
import { useKeyboard } from './useKeyboard';
import { stationAt } from './walker';

/** Longest step the physics takes. Below 20 fps the world slows rather than jumps. */
const MAX_DELTA = 1 / 20;
const PAD_CHECK_SECONDS = 0.1;
const SAVE_SECONDS = 1;
/** Failed attempts at a route before the autopilot gives up on it. */
const REROUTE_LIMIT = 2;

/** Before the rig, which follows where the robot has just moved to. */
const PRIORITY = -3;

/**
 * Turns input and the store into motion, each frame: stick or autopilot, the
 * walker, then whether the robot has reached a pad.
 */
export function RobotController({ link }: { link: ActorLink }) {
  useKeyboard(link);

  const routedTo = useRef<string | null>(null);
  const reroutes = useRef(0);
  const padClock = useRef(0);
  const saveClock = useRef(0);
  const savedAt = useRef({ x: 0, z: 0 });
  /**
   * The pad the visit began on. The robot starts on the welcome pad, and arriving
   * by loading the page is not arriving: nothing should pop open until the
   * visitor asks, or leaves and comes back.
   */
  const startedOn = useRef<string | null | undefined>(undefined);
  const drive = useRef<DriveInput>({
    stick: link.stick,
    run: false,
    jump: false,
    touchMagnitude: 0,
    basisAzimuth: 0,
    facing: null,
  });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, MAX_DELTA);
    if (dt <= 0) return;

    const { robot, input } = runtime;
    if (useUniverse.getState().phase === 'loading') {
      input.jump = false;
      return;
    }

    combineSticks(input.moveX, input.moveY, input.touchX, input.touchY, link.stick);
    link.steering = link.stick.magnitude > STICK_DEADZONE;

    if (link.steering) {
      const { phase, travel, touring, explore, cancelTravel } = useUniverse.getState();
      if (phase === 'overview') explore();
      if (travel !== null || touring) cancelTravel();
    }

    const { driver } = link;
    const { travel, active } = useUniverse.getState();

    if (travel !== routedTo.current) {
      routedTo.current = travel;
      reroutes.current = 0;
      if (travel === null) driver.stopFollowing();
      else startRoute(travel);
    }

    const order = drive.current;
    order.run = input.run;
    order.jump = input.jump;
    order.touchMagnitude = Math.min(Math.hypot(input.touchX, input.touchY), 1);
    order.basisAzimuth = link.basisAzimuth;
    order.facing = active ? world.station(active).facing : null;

    driver.tick(robot, order, world.surface, dt);
    input.jump = false;

    if (driver.arrived && travel !== null) useUniverse.getState().setNear(travel);
    if (driver.stalled && travel !== null) retryRoute(travel);

    padClock.current += dt;
    if (padClock.current >= PAD_CHECK_SECONDS) {
      padClock.current = 0;
      checkPads();
    }

    saveClock.current += dt;
    if (saveClock.current >= SAVE_SECONDS) {
      saveClock.current = 0;
      if (robot.x !== savedAt.current.x || robot.z !== savedAt.current.z) {
        savedAt.current.x = robot.x;
        savedAt.current.z = robot.z;
        saveRobotPosition();
      }
    }
  }, PRIORITY);

  function startRoute(stationId: string) {
    try {
      link.driver.follow(world.routeTo(runtime.robot, stationId).points);
    } catch (error) {
      console.error(`No route to station "${stationId}"`, error);
      giveUp();
    }
  }

  function retryRoute(stationId: string) {
    reroutes.current += 1;
    if (reroutes.current > REROUTE_LIMIT) {
      console.error(`Autopilot could not reach station "${stationId}"`);
      giveUp();
    } else {
      startRoute(stationId);
    }
  }

  function giveUp() {
    link.driver.stopFollowing();
    useUniverse.getState().cancelTravel();
  }

  function checkPads() {
    const store = useUniverse.getState();
    const here = stationAt(world.stations, runtime.robot)?.id ?? null;

    if (startedOn.current === undefined) startedOn.current = here;
    if (store.phase !== 'explore') return;
    if (here !== startedOn.current) startedOn.current = null;

    /* The autopilot opens its destination when it has stopped there, not at the rim. */
    if (here !== null && here === store.travel) return;

    if (here !== null && here === startedOn.current && store.near !== here) {
      /* The same state as having pressed Esc here: E brings the briefing up. */
      useUniverse.setState({ near: here, dismissed: true });
      return;
    }

    store.setNear(here);
  }

  return null;
}
