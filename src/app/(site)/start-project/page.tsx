import type { Metadata } from 'next';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { Panel } from '@/components/primitives/Panel';
import { Reveal } from '@/components/primitives/Reveal';
import { StatusDot } from '@/components/primitives/StatusDot';
import { StartProjectForm } from '@/components/forms/StartProjectForm';
import { profile } from '@/data/profile';
import { smallTasks } from '@/data/services';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Start a project',
  description:
    'Tell me what you need built — AI system, SaaS product, backend, bug fix, integration, realtime feature, database work or MVP — plus your stack, budget and timeline.',
  path: '/start-project',
  keywords: ['hire engineer', 'project enquiry', 'software consulting'],
});

export default function StartProjectPage() {
  return (
    <>
      <section className="site-container pt-10 pb-10 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Reveal>
              <MonoLabel as="p">Start a project</MonoLabel>
            </Reveal>
            <Reveal delay={0.04}>
              <h1 className="text-display-sm mt-6 max-w-2xl">What do you need built?</h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-body md:text-lg">
                Three short steps. Enough detail up front that the reply can be a concrete scope —
                or a short list of questions — rather than a request for a call.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="space-y-4">
            <Panel className="p-5">
              <span className="flex items-center gap-2.5">
                <StatusDot state={profile.availability.state} />
                <MonoLabel tone="accent">{profile.availability.label}</MonoLabel>
              </span>
              <p className="mt-4 text-sm leading-relaxed text-body">
                {profile.availability.detail}
              </p>
            </Panel>

            <div className="border border-line bg-panel/50 p-5">
              <MonoLabel as="p">Small tasks welcome</MonoLabel>
              <ul className="mt-4 space-y-2">
                {smallTasks.slice(0, 4).map((task) => (
                  <li key={task.title} className="flex items-baseline justify-between gap-4">
                    <span className="text-xs text-body">{task.title}</span>
                    <span className="label-mono-sm shrink-0 text-faint">{task.turnaround}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-container pb-20 md:pb-28">
        <StartProjectForm />

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-faint">
          <MonoLabel size="sm" tone="warn" className="mr-2">
            Setup required
          </MonoLabel>
          Submissions are validated and logged server-side, but no delivery destination is
          configured yet. Set <code className="font-mono text-muted">INQUIRY_WEBHOOK_URL</code> or{' '}
          <code className="font-mono text-muted">INQUIRY_NOTIFY_EMAIL</code> in your environment —
          see <code className="font-mono text-muted">src/app/api/inquiry/route.ts</code>.
        </p>
      </section>
    </>
  );
}
