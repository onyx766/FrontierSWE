'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { EffectPass, ToneMappingMode } from 'postprocessing';
import type { BloomEffect, EffectComposer as ComposerImpl } from 'postprocessing';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useUniverse, type Quality } from '../../state/store';

/**
 * The final image. The canvas is `flat`, so this is the only place tone mapping
 * happens: colours above 1 reach bloom intact and then roll off through ACES.
 *
 * On low quality there is no composer at all, so the renderer applies ACES itself
 * and the picture keeps its character without the bloom.
 */

const MULTISAMPLES: Record<Quality, number> = { high: 4, medium: 0, low: 0 };

/*
 * A bright strip is a thin line from far away and a wide band up close, so the same
 * bloom that gives the opening shot its glow would wash out the walking view.
 */
const BLOOM_AT_OPENING = 1.35;
const BLOOM_UP_CLOSE = 0.75;
const BLOOM_NEAR_DISTANCE = 30;
const BLOOM_FAR_DISTANCE = 170;

function Composer({ multisampling }: { multisampling: number }) {
  const composer = useRef<ComposerImpl>(null);
  const bloom = useRef<BloomEffect>(null);

  useFrame(({ camera }) => {
    /*
     * Near-black gradients band badly in eight bits, and the sky is nothing but
     * near-black gradients. The pass that needs dithering is rebuilt whenever the
     * effects change, so this checks rather than sets it once.
     */
    composer.current?.passes.forEach((pass) => {
      if (pass instanceof EffectPass && !pass.dithering) pass.dithering = true;
    });

    if (bloom.current) {
      const reach = THREE.MathUtils.smoothstep(
        camera.position.length(),
        BLOOM_NEAR_DISTANCE,
        BLOOM_FAR_DISTANCE,
      );
      bloom.current.intensity = THREE.MathUtils.lerp(BLOOM_UP_CLOSE, BLOOM_AT_OPENING, reach);
    }
  });

  return (
    <EffectComposer
      ref={composer}
      multisampling={multisampling}
      frameBufferType={THREE.HalfFloatType}
    >
      <Bloom
        ref={bloom}
        mipmapBlur
        luminanceThreshold={1}
        luminanceSmoothing={0.35}
        radius={0.85}
        levels={8}
      />
      <Vignette offset={0.38} darkness={0.34} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

/**
 * Count a whole frame. The renderer resets its counters at every render call and
 * the composer makes several, so left alone `gl.info` would describe only the last
 * full-screen pass, and every frame-budget check would read one draw call.
 */
function FrameCounters() {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame(() => gl.info.reset(), -1000);

  return null;
}

export function PostEffects() {
  const quality = useUniverse((state) => state.quality);
  const gl = useThree((state) => state.gl);

  /* The composer resets tone mapping as it mounts and unmounts, so this holds it each frame. */
  useFrame(() => {
    const wanted = quality === 'low' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    if (gl.toneMapping !== wanted) gl.toneMapping = wanted;
  });

  return (
    <>
      <FrameCounters />
      {quality === 'low' ? null : <Composer multisampling={MULTISAMPLES[quality]} />}
    </>
  );
}
