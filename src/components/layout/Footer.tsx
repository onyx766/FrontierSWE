import Link from 'next/link';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { profile } from '@/data/profile';
import { footerColumns } from '@/data/site';

export function Footer() {
  // Server component: evaluated at build time, so no hydration concern.
  const year = new Date().getFullYear();

  const socials = [
    profile.contact.github ? { label: 'GitHub', href: profile.contact.github } : null,
    profile.contact.linkedin ? { label: 'LinkedIn', href: profile.contact.linkedin } : null,
    profile.contact.x ? { label: 'X', href: profile.contact.x } : null,
    profile.contact.resumeUrl ? { label: 'Résumé', href: profile.contact.resumeUrl } : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return (
    <footer className="mt-24 border-t border-line md:mt-32">
      <div className="site-container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-primary">{profile.name}</span>
            <span aria-hidden className="text-muted">
              //
            </span>
            <MonoLabel size="sm">Engineering Universe</MonoLabel>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-body">{profile.tagline}</p>
          <div className="mt-6 flex items-center gap-2">
            <StatusDot state={profile.availability.state} />
            <MonoLabel size="sm" tone="accent">
              {profile.availability.label}
            </MonoLabel>
          </div>
          <Link
            href="/start-project"
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            Start a project
            <span aria-hidden>→</span>
          </Link>
        </div>

        {footerColumns.map((column) => (
          <nav key={column.label} aria-label={column.label}>
            <MonoLabel>{column.label}</MonoLabel>
            <ul className="mt-5 space-y-3">
              {column.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-body transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line-faint">
        <div className="site-container flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <MonoLabel size="sm" tone="faint">
            © {year} {profile.name} · Built with Next.js, TypeScript and Tailwind
          </MonoLabel>
          {socials.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-6">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="label-mono-sm transition-colors hover:text-primary"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
