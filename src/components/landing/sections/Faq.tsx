import { Icon } from '@/components/landing/primitives/Icon';
import { LogoMark } from '@/components/landing/primitives/Logo';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { GradientText, SectionHeading } from '@/components/landing/primitives/SectionHeading';
import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import { faqIntro, faqs, socialLinks, startProjectHref } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './Faq.module.css';
import { FaqCopyEmail } from './FaqCopyEmail';

/** "Questions, answered" → ["Questions,", "answered"]: the last word takes the accent. */
function splitLastWord(title: string): [string, string] {
  const cut = title.lastIndexOf(' ');
  return cut === -1 ? ['', title] : [title.slice(0, cut), title.slice(cut + 1)];
}

/** "Still have questions?" — a direct line, beside the accordion. */
function ContactCard() {
  const mail = socialLinks.find((link) => link.href.startsWith('mailto:'));
  const email = mail ? mail.href.slice('mailto:'.length) : '';

  return (
    <div className={cn('lp-card lp-gradient-border', styles.contact)}>
      <div aria-hidden className={styles.chat}>
        <span className={styles.avatar}>
          <span className={styles.avatarRing} />
          <span className={styles.avatarFace}>
            <LogoMark uid="faq" className={styles.avatarMark} />
          </span>
          <span className={styles.online} />
        </span>
        <span className={styles.bubble}>
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
        </span>
        <span className={styles.sticker}>?</span>
      </div>

      <h3 className="lp-h3 mt-5">Still have questions?</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-lp-body">
        Ask me directly, or start with a short brief about the project.
      </p>

      {mail && email ? (
        <div className={cn('mt-4', styles.mailField)}>
          <a href={mail.href} title={email} className={styles.mail}>
            <span aria-hidden className={styles.mailIcon}>
              <Icon name={mail.icon} className="size-4" />
            </span>
            <span className="truncate">{email}</span>
          </a>
          <FaqCopyEmail email={email} />
        </div>
      ) : null}

      <LpButton
        href={startProjectHref}
        variant="gradient"
        size="sm"
        icon="arrow-up-right"
        className="mt-3 w-full"
      >
        Start a Project
      </LpButton>
    </div>
  );
}

/**
 * FAQ: the heading and a contact card on the left, an exclusive accordion on
 * the right. Native <details name="faq"> means it opens, closes and works
 * from the keyboard without JavaScript; the CSS module adds the motion.
 * Source order is heading → questions → card, so small screens read the
 * answers before the call to action.
 */
export function Faq() {
  const [lead, accent] = splitLastWord(faqIntro.title);

  return (
    <section id="faq" aria-labelledby="faq-title" className="lp-section">
      <div className="lp-container grid gap-10 lg:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 xl:gap-x-20">
        <SectionHeading
          id="faq-title"
          eyebrow={faqIntro.eyebrow}
          title={
            <>
              {lead} <GradientText italic>{accent}</GradientText>
            </>
          }
          description={faqIntro.description}
          className="lg:col-start-1 lg:row-start-1"
        />

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {/* Each item sits in a plain wrapper: the wrapper takes the reveal's
              transition, so the item's own hover and open transitions survive. */}
          <RevealGroup className={styles.list}>
            {faqs.map((faq, index) => (
              <div key={faq.question}>
                <details name="faq" open={index === 0} className={styles.item}>
                  <summary className={styles.summary}>
                    <span aria-hidden className={styles.index}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.question}>{faq.question}</span>
                    <span aria-hidden className={styles.toggle}>
                      <Icon name="plus" strokeWidth={2} className={styles.toggleIcon} />
                    </span>
                  </summary>
                  <div className={styles.answer}>
                    <p>{faq.answer}</p>
                  </div>
                </details>
              </div>
            ))}
          </RevealGroup>
        </div>

        <Reveal delay={0.08} className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <ContactCard />
        </Reveal>
      </div>
    </section>
  );
}
