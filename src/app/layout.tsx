import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { AssistantLauncher } from '@/components/layout/AssistantLauncher';
import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import { GridBackdrop } from '@/components/primitives/GridBackdrop';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/data/site';
import { profile } from '@/data/profile';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${profile.name} — ${profile.role}`,
    template: `%s — ${profile.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: profile.name }],
  creator: profile.name,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#06070A',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/*
          Marks that JavaScript is running, synchronously and before any content
          paints. The scroll-reveal CSS is scoped to `html[data-js]`, so without
          JavaScript nothing is hidden behind an IntersectionObserver that will
          never fire — the page simply renders fully visible.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.js='1'" }}
        />
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
      </body>
    </html>
  );
}
