import type { ComponentType } from 'react';
import type { IslandId } from '@/data/universe';
import { AiCoreProps } from './AiCoreProps';
import { AboutProps } from './AboutProps';
import { ProjectLabProps } from './ProjectLabProps';
import { BackendEngineProps } from './BackendEngineProps';
import { DataVaultProps } from './DataVaultProps';
import { ExperienceArchiveProps } from './ExperienceArchiveProps';

/**
 * What stands on each island. Each component renders in a group at the island's
 * centre, with y = 0 at the deck surface and +Z towards the opening camera, so
 * props are authored facing the viewer. They must stay within `islandPropReach`
 * of the centre, because the loop road runs just outside it.
 */
export const ISLAND_PROPS: Record<IslandId, ComponentType> = {
  'ai-core': AiCoreProps,
  'about': AboutProps,
  'project-lab': ProjectLabProps,
  'backend-engine': BackendEngineProps,
  'data-vault': DataVaultProps,
  'experience-archive': ExperienceArchiveProps,
};
