import { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from '@/lib/og';
import { capabilityStrip, profile } from '@/data/profile';

export const alt = `${profile.name} — ${profile.role}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        kicker={profile.role}
        title={profile.name}
        description={profile.tagline}
        tags={capabilityStrip.slice(0, 7)}
        status="Available"
      />
    ),
    size,
  );
}
