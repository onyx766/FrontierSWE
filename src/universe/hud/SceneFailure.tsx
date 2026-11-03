'use client';

import Link from 'next/link';
import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';
import { ArrowUpRightIcon } from './icons';

/** Shown when WebGL is missing or the scene fell over. The site stays fully usable. */
export function SceneFailure() {
  const failed = useUniverse((state) => state.webgl === 'failed');
  if (!failed) return null;

  return (
    <section role="alert" className="uh-failure uh-glass">
      <h2 className="text-[19px] font-medium tracking-[-0.01em] text-[#eef1f8]">
        {hudCopy.failure.title}
      </h2>
      <p className="mt-2 text-[14px] leading-[1.55] text-[#b9bfcc]">{hudCopy.failure.body}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link href="/" className="uh-pill-button">
          {hudCopy.failure.system}
          <ArrowUpRightIcon className="size-3" />
        </Link>
        <Link href="/#projects" className="uh-pill-button">
          {hudCopy.failure.projects}
          <ArrowUpRightIcon className="size-3" />
        </Link>
      </div>
    </section>
  );
}
