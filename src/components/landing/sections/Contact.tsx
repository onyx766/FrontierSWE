import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import { Icon } from '@/components/landing/primitives/Icon';
import { LogoMark } from '@/components/landing/primitives/Logo';
import { Eyebrow, GradientText } from '@/components/landing/primitives/SectionHeading';
import { contact, socialLinks } from '@/data/landing';
import { profile } from '@/data/profile';
import { cn } from '@/lib/utils';
import styles from './Contact.module.css';
import { FaqCopyEmail } from './FaqCopyEmail';
import { ProjectForm } from './ProjectForm';

/**
 * Where every "Start a Project" lands: the three-step enquiry form, with a
 * direct email line beside it. Without JavaScript the form cannot submit, so
 * the email link stays the always-working route.
 */
export function Contact() {
  const mail = socialLinks.find((link) => link.href.startsWith('mailto:'));
  const email = mail ? mail.href.slice('mailto:'.length) : profile.contact.email;
  const elsewhere = socialLinks.filter((link) => link.external);
  const [lead, ...rest] = contact.title.split(' ');

  return (
    <section id="contact" aria-labelledby="contact-title" className="lp-section">
      <div aria-hidden className={styles.glow} />
      <div className="lp-container grid items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <Reveal className="lg:sticky lg:top-28">
          <Eyebrow>{contact.eyebrow}</Eyebrow>
          <h2 id="contact-title" className="lp-h2 mt-4">
            {lead} <GradientText italic>{rest.join(' ')}</GradientText>
          </h2>
          <p className="lp-lead mt-5 max-w-md">{contact.description}</p>
          <p className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-sm font-medium text-emerald-800">
            <span aria-hidden className="relative inline-flex size-2">
              <span className="absolute inset-0 rounded-full bg-lp-green animate-lp-pulse-ring" />
              <span className="relative inline-flex size-2 rounded-full bg-lp-green" />
            </span>
            {profile.availability.label}
          </p>

          <div className={cn('mt-7', styles.mailField)}>
            <a href={`mailto:${email}`} className={styles.mail}>
              <span aria-hidden className={styles.mailIcon}>
                <Icon name="mail" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-lp-muted">Prefer email?</span>
                <span className="block truncate text-base font-semibold text-lp-ink">{email}</span>
              </span>
            </a>
            <FaqCopyEmail email={email} />
          </div>

          {elsewhere.length ? (
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {elsewhere.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn('lp-chip h-9 gap-2 px-3.5 text-sm', styles.social)}
                  >
                    <Icon name={link.icon} className={cn(styles.socialIcon, 'size-4')} />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7 flex items-start gap-4 rounded-2xl border border-lp-line bg-white/70 p-5">
            <span aria-hidden className={styles.ring}>
              <span className={styles.ringDash} />
              <span className={styles.ringCore}>
                <LogoMark uid="contact" className="size-6" />
              </span>
            </span>
            <div>
              <p className="text-sm font-semibold text-lp-ink">A useful first message includes</p>
              <RevealGroup as="ul" role="list" className="mt-2.5 space-y-1.5">
                {contact.checklist.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-lp-body">
                    <Icon name="check" className="size-3.5 text-lp-violet-700" strokeWidth={2.5} />
                    {item}
                  </li>
                ))}
              </RevealGroup>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ProjectForm email={email} />
        </Reveal>
      </div>
    </section>
  );
}
