import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UniverseLab } from '@/universe/UniverseLab';

export const metadata: Metadata = {
  title: 'Universe lab',
  robots: { index: false, follow: false },
};

/**
 * Development-only view of the 3D world.
 *
 *   /lab?only=core,roads          render just those layers
 *   /lab?cam=x,y,z,tx,ty,tz,fov   hold the camera at a fixed shot
 */
export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UniverseLab />;
}
