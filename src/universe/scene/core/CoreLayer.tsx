'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse } from '../../state/store';
import { CorePlate } from './CorePlate';
import { getCrystal } from './crystal';
import { gemClearance } from './gemShape';

const drawingBuffer = new THREE.Vector2();

/**
 * The crystal at the centre of the world. See `crystal.ts` for how it is put
 * together; this component only keeps it animated.
 */
export default function CoreLayer() {
  const crystal = useMemo(getCrystal, []);
  const reducedMotion = useUniverse((state) => state.reducedMotion);
  const quality = useUniverse((state) => state.quality);
  const time = useRef(0);

  useEffect(() => {
    crystal.setDetail(quality !== 'low');
  }, [crystal, quality]);

  useFrame(({ camera, gl }, delta) => {
    if (!reducedMotion) time.current += Math.min(delta, 0.1);
    const breath = reducedMotion ? 1 : 1 + 0.07 * Math.sin(time.current * 0.62);
    crystal.tick(time.current, breath);

    crystal.setCameraClearance(
      gemClearance(camera.position.x, camera.position.y, camera.position.z),
    );

    const lens = camera as THREE.PerspectiveCamera;
    gl.getDrawingBufferSize(drawingBuffer);
    crystal.setPixelScale(
      (2 * Math.tan(THREE.MathUtils.degToRad(lens.fov / 2))) / drawingBuffer.y,
    );
  });

  return (
    <>
      <primitive object={crystal.root} />
      <CorePlate />
    </>
  );
}
