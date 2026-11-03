import type { Metadata } from 'next';
import { profile } from '@/data/profile';
import { WORLD_PATH } from '@/data/universe';
import { buildMetadata } from '@/lib/seo';
import { UniverseStage } from '@/universe/UniverseStage';

export const metadata: Metadata = buildMetadata({
  title: '3D Engineering World',
  description: `Walk ${profile.name}'s engineering world in 3D: a robot guide explains every project at its own stop. ${profile.tagline}`,
  path: WORLD_PATH,
});

/**
 * The interactive 3D portfolio. Opt-in: the plain site at `/` links here, and
 * `?at=<station>` (see `worldHref`) opens the world at one project's stop.
 */
export default function WorldPage() {
  return <UniverseStage />;
}
