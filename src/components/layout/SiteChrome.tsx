import type { ReactNode } from 'react';
import { AssistantLauncher } from '@/components/layout/AssistantLauncher';
import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import { GridBackdrop } from '@/components/primitives/GridBackdrop';

/**
 * The frame around every page except the homepage, which is a full-screen scene
 * with its own HUD. Shared by the `(site)` layout and the root 404, which renders
 * outside that route group.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:border focus:border-accent focus:bg-void focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:tracking-[0.18em] focus:text-accent focus:uppercase"
      >
        Skip to content
      </a>
      <GridBackdrop />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
      <AssistantLauncher />
    </>
  );
}
