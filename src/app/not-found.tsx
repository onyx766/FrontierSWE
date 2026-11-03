import type { Metadata } from 'next';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { domainList } from '@/data/domains';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Node not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <SiteChrome>
      <section className="site-container flex min-h-[70vh] flex-col justify-center py-20">
        <MonoLabel as="p" tone="warn">
          404 · node unreachable
        </MonoLabel>
        <h1 className="text-display-sm mt-6 max-w-2xl">That part of the network does not exist</h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-body">
          The route resolved but there is nothing listening on it. Head back to the universe, or
          jump straight into one of the engineering areas.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <ActionLink href="/" variant="primary" size="lg">
            Back to the universe
          </ActionLink>
          <ActionLink href="/projects" variant="secondary" size="lg">
            View projects
          </ActionLink>
        </div>

        <nav aria-label="Engineering areas" className="mt-14 border-t border-line pt-6">
          <MonoLabel as="p" size="sm" tone="faint">
            Nodes
          </MonoLabel>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {domainList.map((domain) => (
              <li key={domain.id}>
                <Link
                  href={`/system/${domain.id}`}
                  className="label-mono transition-colors hover:text-accent"
                >
                  {domain.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </SiteChrome>
  );
}
