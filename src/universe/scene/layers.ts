import { lazy } from 'react';

/**
 * The scene's independent layers. Each is a default-exported component with no
 * props, and each is loaded separately: `/lab?only=core,roads` renders just the
 * named layers, and a layer that fails is logged and skipped by its error
 * boundary rather than taking the rest of the world down with it.
 */
export const LAYERS = {
  environment: lazy(() => import('./environment/EnvironmentLayer')),
  core: lazy(() => import('./core/CoreLayer')),
  roads: lazy(() => import('./roads/RoadsLayer')),
  islands: lazy(() => import('./islands/IslandsLayer')),
  stations: lazy(() => import('./stations/StationsLayer')),
  actor: lazy(() => import('./actor/ActorLayer')),
} as const;

export type LayerName = keyof typeof LAYERS;

export const LAYER_NAMES = Object.keys(LAYERS) as LayerName[];
