import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { profile } from '@/data/profile';

interface CTABandProps {
  /** Overrides the default headline, for page-specific framing. */
  title?: string;
  description?: string;
  secondary?: { label: string; href: string };
}

/**
 * The closing conversion band. Present on every page — the site exists to
 * generate engineering work, so there is always a visible next action.
 */
export function CTABand({
  title = 'Available for new engineering work',
  description = 'A full production system or a single broken endpoint — both are worth getting in touch about.',
  secondary = { label: 'View services', href: '/services' },
}: CTABandProps) {
  return (
    <section className="site-container py-20 md:py-28">
      <div className="relative border border-line bg-panel/60 p-8 md:p-12">
        <span aria-hidden className="absolute top-0 left-0 h-px w-16 bg-accent" />
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
          <div>
            <span className="flex items-center gap-2.5">
              <StatusDot state={profile.availability.state} />
              <MonoLabel tone="accent">{profile.availability.label}</MonoLabel>
            </span>
            <h2 className="text-display-sm mt-6 max-w-2xl">{title}</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-body md:text-lg">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ActionLink href={secondary.href} variant="secondary" size="lg">
              {secondary.label}
            </ActionLink>
            <ActionLink href="/start-project" variant="primary" size="lg">
              Start a project
            </ActionLink>
          </div>
        </div>
      </div>
    </section>
  );
}
