'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { LAYER_NAMES, type LayerName } from './scene/layers';
import type { LabCamera } from './scene/UniverseScene';

const UniverseScene = dynamic(() => import('./scene/UniverseScene'), { ssr: false });

function parseCamera(value: string | null): LabCamera | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map(Number);
  if (parts.length < 6 || parts.some((part) => Number.isNaN(part))) return undefined;
  const [x = 0, y = 0, z = 0, tx = 0, ty = 0, tz = 0, fov = 32] = parts;
  return { position: [x, y, z], target: [tx, ty, tz], fov };
}

function Lab() {
  const params = useSearchParams();
  const only = params.get('only');
  const cam = params.get('cam');

  const layers = useMemo<LayerName[] | undefined>(() => {
    if (!only) return undefined;
    const wanted = only.split(',');
    return LAYER_NAMES.filter((name) => wanted.includes(name));
  }, [only]);

  const labCamera = useMemo(() => parseCamera(cam), [cam]);

  return (
    <div className="fixed inset-0 bg-[#02040b]">
      <UniverseScene {...(layers ? { only: layers } : {})} {...(labCamera ? { labCamera } : {})} />
    </div>
  );
}

export function UniverseLab() {
  return (
    <Suspense fallback={null}>
      <Lab />
    </Suspense>
  );
}
