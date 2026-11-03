import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { GradientText, SectionHeading } from '@/components/landing/primitives/SectionHeading';
import { Tilt } from '@/components/landing/primitives/Tilt';
import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import { engagementIntro, engagements, hero } from '@/data/landing';
import { cn } from '@/lib/utils';
import { EngagementOrbit } from './EngagementOrbit';
import styles from './Engagement.module.css';

/** "Ways to work together" → ["Ways to work ", "together"]: the last word takes the accent. */
function splitLastWord(text: string): [string, string] {
  const at = text.lastIndexOf(' ');
  return at === -1 ? ['', text] : [text.slice(0, at + 1), text.slice(at + 1)];
}

/**
 * Ways to work together: the four engagement shapes. A centred heading for a
 * change of rhythm after the side-headed sections, over an orbit decoration.
 */
export function Engagement() {
  const [lead, accent] = splitLastWord(engagementIntro.title);

  return (
    <section id="engagement" aria-labelledby="engagement-title" className="lp-section">
      <div className="lp-container">
        <SectionHeading
          id="engagement-title"
          align="center"
          eyebrow={engagementIntro.eyebrow}
          title={
            <>
              {lead}
              <GradientText italic>{accent}</GradientText>
            </>
          }
          // Balanced, so the two centred lines don't leave a word or two behind.
          description={<span className="block text-balance">{engagementIntro.description}</span>}
        />

        {/* Wider margins from 1280px leave room for the orbit's arcs. */}
        <div className="relative mt-14 md:mt-16 xl:mt-20">
          <EngagementOrbit />

          <RevealGroup as="ul" className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {engagements.map((item) => (
              // Four rows of a shared subgrid: the "Best for" rules line up
              // across a row however long each description runs.
              <li key={item.title} className="row-span-4 grid grid-rows-subgrid gap-y-0">
                <Tilt
                  max={6}
                  lift={6}
                  className={cn(
                    'lp-card lp-spotlight lp-gradient-border row-span-4 grid grid-rows-subgrid gap-y-0 overflow-hidden rounded-[1.5rem] p-6 xl:p-7',
                    styles.card,
                  )}
                >
                  <Icon name={item.icon} className={styles.watermark} strokeWidth={1.25} />
                  <div className={styles.iconWrap}>
                    <span aria-hidden className={styles.iconRing} />
                    <span className={styles.iconDisc}>
                      <Icon name={item.icon} className={styles.icon} />
                    </span>
                  </div>
                  <h3 className="lp-h3 mt-6">{item.title}</h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-lp-body">{item.description}</p>
                  <dl className="mt-6 border-t border-lp-line pt-4">
                    <dt className="text-[0.6875rem] font-semibold tracking-[0.16em] text-lp-violet-700 uppercase">
                      Best for
                    </dt>
                    <dd className="mt-1.5 text-sm leading-snug font-medium text-lp-ink-2">{item.bestFor}</dd>
                  </dl>
                </Tilt>
              </li>
            ))}
          </RevealGroup>
        </div>

        <Reveal className="mt-12 flex justify-center md:mt-14 xl:mt-24">
          <LpButton href={hero.secondaryCta.href} variant="gradient" icon="arrow-up-right" magnetic>
            {hero.secondaryCta.label}
          </LpButton>
        </Reveal>
      </div>
    </section>
  );
}
