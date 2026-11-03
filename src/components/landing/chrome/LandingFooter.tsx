import Link from 'next/link';
import { Icon } from '@/components/landing/primitives/Icon';
import { Logo } from '@/components/landing/primitives/Logo';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { footer, socialLinks, startProjectHref } from '@/data/landing';
import { profile } from '@/data/profile';

function FooterLink({ href, label }: { href: string; label: string }) {
  const className =
    'group/link inline-flex items-center text-sm text-lp-body transition-colors duration-200 hover:text-lp-violet-700';
  // The dash grows in from nothing on hover; with no gap it adds no indent at rest.
  const inner = (
    <>
      <span
        aria-hidden
        className="mr-0 h-px w-0 bg-lp-violet transition-[width,margin] duration-300 group-hover/link:mr-1.5 group-hover/link:w-3"
      />
      {label}
    </>
  );
  return href.startsWith('#') ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export function LandingFooter() {
  // Server component: evaluated at build time, so no hydration concern.
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-lp-line bg-white/70 backdrop-blur-sm">
      <div className="lp-container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr] lg:gap-8">
        <div>
          <a href="#home" className="group inline-flex rounded-lg" aria-label="Back to the top">
            <Logo uid="footer" name={profile.name} />
          </a>
          <p className="mt-4 text-sm font-medium text-lp-ink-2">{footer.role}</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-lp-muted">{footer.tagline}</p>
        </div>

        {footer.columns.map((column) => (
          <nav key={column.label} aria-label={column.label}>
            <p className="text-sm font-semibold text-lp-ink">{column.label}</p>
            <ul className="mt-4 space-y-2.5">
              {column.items.map((item) => (
                <li key={item.label}>
                  <FooterLink href={item.href} label={item.label} />
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-label="Connect">
          <p className="text-sm font-semibold text-lp-ink">Connect</p>
          <ul className="mt-4 space-y-2.5">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  {...(link.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  className="group/social inline-flex items-center gap-2.5 text-sm text-lp-body transition-colors hover:text-lp-violet-700"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-lg border border-lp-line bg-white transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/social:rotate-[360deg] group-hover/social:border-lp-violet/40">
                    <Icon name={link.icon} className="size-3.5" />
                  </span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col items-start gap-4 lg:items-end">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-lp-ink-2">
            <span aria-hidden className="relative inline-flex size-2">
              <span className="absolute inset-0 rounded-full bg-lp-green animate-lp-pulse-ring" />
              <span className="relative inline-flex size-2 rounded-full bg-lp-green" />
            </span>
            {footer.availability}
          </span>
          <LpButton href={startProjectHref} variant="gradient" icon="arrow-up-right" magnetic>
            Start a Project
          </LpButton>
        </div>
      </div>

      <div className="border-t border-lp-line">
        <div className="lp-container flex flex-col gap-3 py-5 text-xs text-lp-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {profile.name}. Designed and built with Next.js, TypeScript and a lot of canvas.
          </p>
          <a
            href="#home"
            className="group inline-flex items-center gap-1.5 font-medium transition-colors hover:text-lp-violet-700"
          >
            Back to top
            <Icon
              name="arrow-up"
              className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
