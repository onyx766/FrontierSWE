import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { BackgroundCanvas } from '@/components/landing/chrome/BackgroundCanvas';
import { BackToTop } from '@/components/landing/chrome/BackToTop';
import { LandingFooter } from '@/components/landing/chrome/LandingFooter';
import { LandingNav } from '@/components/landing/chrome/LandingNav';
import { ScrollProgress } from '@/components/landing/chrome/ScrollProgress';
import { cn } from '@/lib/utils';

/** Caveat (OFL), for the hand-written note beside the hero island. */
const hand = localFont({
  src: '../fonts/caveat-latin-600.woff2',
  weight: '600',
  style: 'normal',
  display: 'swap',
  variable: '--font-hand-family',
});

/** Geist's true italic (OFL). The `geist` package only exports the upright face. */
const geistItalic = localFont({
  src: '../fonts/geist-italic-variable.woff2',
  weight: '100 900',
  style: 'italic',
  display: 'swap',
  variable: '--font-geist-italic-family',
});

/**
 * The light homepage's frame. The rest of the site keeps the dark
 * `SiteChrome` of the `(site)` group; both share the root layout, so moving
 * between them is still a client-side navigation.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn('lp-root relative isolate min-h-dvh overflow-x-clip', hand.variable, geistItalic.variable)}>
      <a href="#main" className="lp-skip">
        Skip to content
      </a>
      <BackgroundCanvas />
      <ScrollProgress />
      <LandingNav />
      <main id="main">{children}</main>
      <LandingFooter />
      <BackToTop />
    </div>
  );
}
