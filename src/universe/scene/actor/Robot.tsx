'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { runtime } from '../../state/runtime';
import { useUniverse } from '../../state/store';
import { COLORS, hdr } from '../palette';
import { createRobotLook, dressRobot } from './dressRobot';
import type { ActorLink } from './link';
import {
  chooseLocomotion,
  nextGesture,
  nextGestureDelay,
  playbackRate,
  ROBOT_SCALE,
  type Gesture,
  type Locomotion,
} from './robotClips';
import { SpeechBubble } from './SpeechBubble';
import { damp, dampAngle } from './steering';

const MODEL_URL = '/models/robot.glb';

/* The model is plain glTF, so neither decoder is needed, and Draco's comes from a CDN. */
useGLTF.preload(MODEL_URL, false, false);

/** After the rig, so that robot and camera agree on the frame. */
const PRIORITY = -1;

const FADE_SECONDS = 0.22;
/**
 * Part of the physical hop that lifts the body. The Jump clips already raise it by
 * about 0.8, and the two together would be a leap rather than the hop it should be.
 */
const HOP_SHARE = 0.35;
const GROUND_RATE = 20;
/** Lean into the run, a little. */
const LEAN_PER_SPEED = 0.012;
const LEAN_RATE = 8;

function RobotModel() {
  const { scene, animations } = useGLTF(MODEL_URL, false, false);
  const look = useMemo(createRobotLook, []);
  const dressed = useMemo(() => dressRobot(scene, look), [scene, look]);
  const { actions, mixer } = useAnimations(animations, dressed.model);

  const body = useRef<THREE.Group>(null);
  const locomotion = useRef<Locomotion>('Idle');
  const playing = useRef<THREE.AnimationAction | null>(null);
  const gesture = useRef<THREE.AnimationAction | null>(null);
  const lastGesture = useRef<Gesture | null>(null);
  const gestureClock = useRef(0);
  const hopping = useRef(false);

  useEffect(() => {
    const idle = actions.Idle;
    if (!idle) return undefined;
    idle.reset().play();
    playing.current = idle;
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, mixer]);

  useEffect(
    () => () => {
      dressed.dispose();
      for (const material of Object.values(look)) material.dispose();
    },
    [dressed, look],
  );

  const crossfade = (next: THREE.AnimationAction | undefined | null) => {
    if (!next || next === playing.current) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(FADE_SECONDS).play();
    playing.current?.fadeOut(FADE_SECONDS);
    playing.current = next;
  };

  const playOnce = (next: THREE.AnimationAction | undefined | null) => {
    if (!next) return;
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    crossfade(next);
  };

  useFrame((_, delta) => {
    const { robot } = runtime;
    const { active, reducedMotion } = useUniverse.getState();

    locomotion.current = chooseLocomotion(robot.speed, locomotion.current);
    const base = locomotion.current;

    /* A hop takes over the whole body, and hands back on landing. */
    if (robot.lift > 0 && !hopping.current) {
      hopping.current = true;
      gesture.current = null;
      playOnce(base === 'Idle' ? actions.Jump : actions.WalkJump);
    } else if (robot.lift === 0 && hopping.current) {
      hopping.current = false;
      crossfade(actions[base]);
    }

    if (!hopping.current) {
      const standing = base === 'Idle';

      if (!standing && gesture.current) gesture.current = null;

      if (standing && active && !reducedMotion) {
        if (gesture.current && !gesture.current.isRunning()) {
          gesture.current = null;
          gestureClock.current = nextGestureDelay(Math.random());
          crossfade(actions.Idle);
        } else if (!gesture.current) {
          gestureClock.current -= delta;
          if (gestureClock.current <= 0) {
            lastGesture.current = nextGesture(lastGesture.current);
            gesture.current = actions[lastGesture.current] ?? null;
            playOnce(gesture.current);
          }
        }
      } else {
        if (!active) {
          lastGesture.current = null;
          gestureClock.current = 0;
        }
        gesture.current = null;
      }

      if (!gesture.current) {
        const action = actions[base];
        crossfade(action);
        action?.setEffectiveTimeScale(playbackRate(base, robot.speed));
      }
    }

    /* Standing perfectly still is the point of reduced motion. */
    mixer.timeScale = reducedMotion && base === 'Idle' && !hopping.current ? 0 : 1;

    const target = body.current;
    if (target) {
      const lean = reducedMotion ? 0 : Math.min(robot.speed, 12) * LEAN_PER_SPEED;
      target.rotation.x = damp(target.rotation.x, lean, LEAN_RATE, delta);
    }
  }, PRIORITY);

  return (
    <group ref={body}>
      <primitive object={dressed.model} scale={ROBOT_SCALE} />
    </group>
  );
}

const FLAT_UP = new THREE.Vector3(0, 1, 0);
const groundNormal = new THREE.Vector3();

/** The robot in the world: placed each frame from `runtime`, drawn by what is inside. */
export function Robot({ link }: { link: ActorLink }) {
  const root = useRef<THREE.Group>(null);
  const heading = useRef<THREE.Group>(null);
  const marks = useRef<THREE.Group>(null);
  const groundY = useRef<number | null>(null);

  useFrame((_, rawDelta) => {
    const { robot } = runtime;
    const delta = Math.min(rawDelta, 1 / 20);
    const ground = link.driver.motion.groundY;
    groundY.current = damp(groundY.current ?? ground, ground, GROUND_RATE, delta);

    const place = root.current;
    if (place) place.position.set(robot.x, groundY.current, robot.z);

    const turn = heading.current;
    if (turn) {
      turn.position.y = robot.lift * HOP_SHARE;
      turn.rotation.y = dampAngle(turn.rotation.y, robot.yaw, 24, delta);
    }

    const under = marks.current;
    if (under) {
      /* Lies along the deck, or a ramp would slice through the disc. */
      const { slope } = link.driver.motion;
      groundNormal.set(-slope.x, 1, -slope.z).normalize();
      under.quaternion.setFromUnitVectors(FLAT_UP, groundNormal);
      const fade = 1 / (1 + robot.lift * 1.4);
      under.scale.setScalar(fade);
    }
  }, PRIORITY);

  return (
    <group ref={root}>
      <group ref={marks}>
        <GroundMarks />
      </group>
      <group ref={heading}>
        <Suspense fallback={null}>
          <RobotModel />
        </Suspense>
      </group>
      <SpeechBubble link={link} />
    </group>
  );
}

function createDiscTexture(stops: [number, string][]): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Clears the junction plates, which sit 0.05 proud of the roads they cover. */
const MARK_LIFT = 0.09;

/** A soft shadow to ground the robot, and a pool of its own light on the deck. */
function GroundMarks() {
  const shadow = useMemo(
    () =>
      createDiscTexture([
        [0, 'rgba(0,0,0,0.78)'],
        [0.45, 'rgba(0,0,0,0.5)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    [],
  );
  const pool = useMemo(
    () =>
      createDiscTexture([
        [0, 'rgba(255,255,255,0.9)'],
        [0.35, 'rgba(255,255,255,0.28)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    [],
  );
  const color = useMemo(() => hdr(COLORS.cyan, 1), []);

  useEffect(
    () => () => {
      shadow.dispose();
      pool.dispose();
    },
    [shadow, pool],
  );

  return (
    <>
      <mesh position={[0, MARK_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[2.3, 2.3]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, MARK_LIFT + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshBasicMaterial
          map={pool}
          color={color}
          opacity={0.32}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
