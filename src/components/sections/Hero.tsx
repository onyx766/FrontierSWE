import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Panel } from '@/components/primitives/Panel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { Reveal, RevealGroup, RevealItem } from '@/components/primitives/Reveal';
import { profile, proofPoints } from '@/data/profile';

/**
 * First screen. Deliberately sparse: the reading order is name → role →
 * one-line positioning → status → call to action, all of it above the
 * visualisation. A founder should be able to answer "who is this and are they
 * available" before the diagram enters their field of view.
 */
export function Hero() {
  return (
    <section className="site-container pt-12 pb-10 md:pt-20 md:pb-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Reveal>
            <MonoLabel as="p" tone="muted">
              {profile.role}
            </MonoLabel>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="text-display mt-6 text-primary">{profile.name}</h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-body md:text-xl">
              {profile.tagline}
            </p>
          </Reveal>

          <RevealGroup className="mt-10 flex flex-wrap items-center gap-3" delay={0.18}>
            <RevealItem>
              <ActionLink href="/#topology" variant="secondary" size="lg">
                Explore system
              </ActionLink>
            </RevealItem>
            <RevealItem>
              <ActionLink href="/start-project" variant="primary" size="lg">
                Start a project
              </ActionLink>
            </RevealItem>
          </RevealGroup>
        </div>

        <Reveal delay={0.2} className="flex flex-col gap-4 lg:items-end">
          <Panel className="w-full p-5 lg:max-w-xs">
            <MonoLabel as="p">System status</MonoLabel>
            <p className="mt-4 flex items-center gap-2.5">
              <StatusDot state={profile.availability.state} />
              <span className="font-mono text-xs tracking-[0.14em] text-accent uppercase">
                {profile.availability.label}
              </span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-body">
              {profile.availability.detail}
            </p>
          </Panel>

          <div className="w-full border-t border-line pt-5 lg:max-w-xs">
            <p className="font-sans text-4xl leading-none font-medium tracking-tight text-primary">
              {profile.yearsExperience}
            </p>
            <MonoLabel as="p" className="mt-2.5 block">
              Years engineering
            </MonoLabel>
          </div>

          <dl className="w-full divide-y divide-line-faint border-t border-line-faint lg:max-w-xs">
            {proofPoints.slice(1).map((point) => (
              <div key={point.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="label-mono-sm text-faint">{point.label}</dt>
                <dd className="text-right text-xs text-body">{point.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
