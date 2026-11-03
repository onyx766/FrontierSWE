import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
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
    // suppressHydrationWarning is required and scoped: the inline script below
    // sets `data-js` on <html> before React hydrates, so the server and client
    // attributes differ by design. It applies to this element's attributes
    // only — mismatches inside the page are still reported.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
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
        {children}
      </body>
    </html>
  );
}
