'use client';

import { getIslandPlans } from './islandPlan';
import { IslandBase } from './IslandBase';
import { IslandShards } from './IslandShards';
import { LabelPlates } from './LabelPlates';
import { ISLAND_PROPS } from './props';

/** The six floating platforms: rock, decks, rim light, name plates and each island's props. */
export default function IslandsLayer() {
  return (
    <>
      <IslandBase />
      <IslandShards />
      {getIslandPlans().map(({ island, center }) => {
        const Props = ISLAND_PROPS[island.id];
        return (
          <group key={island.id} position={[center.x, center.y, center.z]}>
            <Props />
          </group>
        );
      })}
      <LabelPlates />
    </>
  );
}
