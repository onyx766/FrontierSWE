'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getComposition } from './composition';

/**
 * Glare where the sun touches the limb, at the far left of the opening shot. A
 * screen-aligned streak and a warm core, drawn once to a canvas: on the standard
 * frame only the right half shows, on a wider screen the whole of it does.
 */

const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 128;

function createFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');

  const centerX = TEXTURE_WIDTH / 2;
  const centerY = TEXTURE_HEIGHT / 2;

  context.fillStyle = '#000';
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  context.globalCompositeOperation = 'lighter';

  context.save();
  context.translate(centerX, centerY);
  context.scale(1, 0.16);
  const streak = context.createRadialGradient(0, 0, 0, 0, 0, centerX);
  streak.addColorStop(0, 'rgba(235,245,255,1)');
  streak.addColorStop(0.16, 'rgba(160,200,255,0.5)');
  streak.addColorStop(0.5, 'rgba(70,120,255,0.13)');
  streak.addColorStop(1, 'rgba(40,80,255,0)');
  context.fillStyle = streak;
  context.beginPath();
  context.arc(0, 0, centerX, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const core = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    TEXTURE_HEIGHT * 0.4,
  );
  core.addColorStop(0, 'rgba(255,245,230,1)');
  core.addColorStop(0.3, 'rgba(255,225,190,0.42)');
  core.addColorStop(1, 'rgba(255,200,150,0)');
  context.fillStyle = core;
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function SunFlare() {
  const sprite = useMemo(() => {
    const material = new THREE.SpriteMaterial({
      map: createFlareTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    material.color.setScalar(0.42);

    const object = new THREE.Sprite(material);
    object.position.copy(getComposition().sunPosition);
    object.scale.set(1500, 240, 1);
    return object;
  }, []);

  useEffect(
    () => () => {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    },
    [sprite],
  );

  return <primitive object={sprite} />;
}
