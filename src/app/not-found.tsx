import type { Metadata } from 'next';
import { Icon } from '@/components/landing/primitives/Icon';
import { LogoMark } from '@/components/landing/primitives/Logo';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { navSections } from '@/data/landing';
import { worldHref } from '@/data/universe';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * The site is one page, so a 404 only needs to point back into it. Renders
 * outside the landing layout, so it brings its own `.lp-root` for the light theme.
 */
export default function NotFound() {
  return (
    <main className="lp-root relative isolate grid min-h-dvh place-items-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_40%,rgb(167_139_250/0.28),transparent_70%)]"
      />
      <div className="max-w-xl text-center">
        <a href="/" className="group mx-auto inline-flex rounded-lg" aria-label="Home">
          <LogoMark uid="404" className="size-12" />
        </a>
        <p className="lp-eyebrow mt-8">404 · Page not found</p>
        <h1 className="lp-h2 mt-4">That page isn&rsquo;t part of the city</h1>
        <p className="lp-lead mx-auto mt-5 max-w-md">
          Everything lives on one page now. Head back to it, or jump straight to a section.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LpButton href="/" variant="dark" size="lg">
            Back to home
          </LpButton>
          <LpButton href={worldHref()} variant="outline" size="lg" icon="arrow-up-right">
            Enter 3D World
          </LpButton>
        </div>
        <nav aria-label="Sections" className="mt-10 flex flex-wrap justify-center gap-2">
          {navSections
            .filter((section) => section.id !== 'home')
            .map((section) => (
              <a
                key={section.id}
                href={`/#${section.id}`}
                className="lp-chip transition-colors hover:border-lp-violet/40 hover:text-lp-violet-700"
              >
                {section.label}
                <Icon name="arrow-right" className="size-3 opacity-60" />
              </a>
            ))}
        </nav>
      </div>
    </main>
  );
}
