'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ActionButton } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { Field, OptionGrid, inputClass } from '@/components/forms/Field';
import {
  LIMITS,
  emptyInquiry,
  errorsForStep,
  hasErrors,
  validateInquiry,
} from '@/lib/inquiry';
import { cn } from '@/lib/utils';
import {
  BUDGET_RANGES,
  NEED_TYPES,
  TIMELINES,
  type InquiryFieldErrors,
  type InquiryPayload,
} from '@/lib/types';

const STEPS = [
  { label: 'What you need', kicker: 'Step 01' },
  { label: 'The project', kicker: 'Step 02' },
  { label: 'Contact', kicker: 'Step 03' },
] as const;

type Status = 'idle' | 'submitting' | 'sent' | 'error';

/**
 * Three-step project enquiry.
 *
 * The first question is "what do you need built?" rather than a blank contact
 * form: it is easier to answer, it tells the visitor the work is categorised
 * and understood, and it means the first reply can be a scope instead of a
 * request for a call.
 *
 * Validation is shared with the API route (src/lib/inquiry.ts), so the client
 * and the server reject exactly the same things. Steps are validated
 * individually, so you can never be blocked by an error on a screen you cannot
 * see.
 */
export function StartProjectForm() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<InquiryPayload>(emptyInquiry);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const allErrors = useMemo(() => validateInquiry(values), [values]);
  const stepErrors: InquiryFieldErrors = touched ? errorsForStep(allErrors, step) : {};

  const set = useCallback(<K extends keyof InquiryPayload>(key: K, value: InquiryPayload[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const next = () => {
    setTouched(true);
    if (hasErrors(errorsForStep(allErrors, step))) return;
    setTouched(false);
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const back = () => {
    setTouched(false);
    setStep((current) => Math.max(0, current - 1));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (hasErrors(allErrors)) return;

    setStatus('submitting');
    setServerError(null);

    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Request failed (${response.status})`);
      }

      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setServerError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="relative border border-accent/30 bg-accent/[0.04] p-8 md:p-12">
        <span aria-hidden className="absolute top-0 left-0 h-px w-20 bg-accent" />
        <span className="flex items-center gap-2.5">
          <StatusDot state="ok" />
          <MonoLabel tone="accent">Enquiry received</MonoLabel>
        </span>
        <h2 className="text-display-sm mt-6">Thanks — that is enough to work with</h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-body">
          You described a <strong className="text-primary">{values.needType}</strong> project with a{' '}
          <strong className="text-primary">{values.timeline.toLowerCase()}</strong> timeline. The
          reply will be a concrete scope or a short list of questions — not a calendar link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="label-mono border border-line-strong px-5 py-3 text-primary transition-colors hover:border-muted"
          >
            Read case studies
          </Link>
          <button
            type="button"
            onClick={() => {
              setValues(emptyInquiry());
              setStep(0);
              setTouched(false);
              setStatus('idle');
            }}
            className="label-mono px-5 py-3 text-muted transition-colors hover:text-primary"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="border border-line bg-panel/50">
      {/* Step indicator */}
      <ol className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
        {STEPS.map((item, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li key={item.label} className={cn('bg-void px-5 py-4', active && 'bg-elevated')}>
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 shrink-0',
                    active || done ? 'bg-accent' : 'bg-line-strong',
                  )}
                />
                <MonoLabel size="sm" tone={active ? 'accent' : done ? 'muted' : 'faint'}>
                  {item.kicker}
                </MonoLabel>
              </div>
              <p
                className={cn(
                  'mt-2 text-sm',
                  active ? 'text-primary' : done ? 'text-body' : 'text-muted',
                )}
              >
                {item.label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="p-6 md:p-8">
        {step === 0 ? (
          <Field
            label="What do you need built?"
            hint="Pick the closest match. It only shapes the first reply — nothing is locked in."
            error={stepErrors.needType}
          >
            {({ describedBy, invalid }) => (
              <OptionGrid
                name="needType"
                options={NEED_TYPES}
                value={values.needType}
                onChange={(value) => set('needType', value)}
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        ) : null}

        {step === 1 ? (
          <div className="space-y-8">
            <Field
              label="Project description"
              hint="What are you building, or what is broken? The specific version is more useful than the general one."
              error={stepErrors.description}
            >
              {({ id, describedBy, invalid }) => (
                <>
                  <textarea
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    value={values.description}
                    onChange={(event) => set('description', event.target.value)}
                    rows={6}
                    maxLength={LIMITS.description.max}
                    placeholder="e.g. We have a FastAPI backend and want to add a RAG assistant over our internal docs. Retrieval quality matters more than speed."
                    className={cn(inputClass(invalid), 'resize-y')}
                  />
                  <p className="mt-2 text-right font-mono text-[0.5625rem] text-faint tabular-nums">
                    {values.description.trim().length} / {LIMITS.description.max}
                  </p>
                </>
              )}
            </Field>

            <Field
              label="Current technology stack"
              hint="Languages, frameworks, database, hosting. Write “greenfield” if there is nothing yet."
              error={stepErrors.currentStack}
              optional
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={values.currentStack}
                  onChange={(event) => set('currentStack', event.target.value)}
                  maxLength={LIMITS.stack.max}
                  placeholder="e.g. Next.js, FastAPI, PostgreSQL, deployed on AWS"
                  className={inputClass(invalid)}
                />
              )}
            </Field>

            <Field
              label="Budget range"
              hint="An honest range saves us both time. Small budgets are fine — small tasks are welcome."
              error={stepErrors.budget}
            >
              {({ describedBy, invalid }) => (
                <OptionGrid
                  name="budget"
                  options={BUDGET_RANGES}
                  value={values.budget}
                  onChange={(value) => set('budget', value)}
                  columns={3}
                  describedBy={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field label="Desired timeline" error={stepErrors.timeline}>
              {({ describedBy, invalid }) => (
                <OptionGrid
                  name="timeline"
                  options={TIMELINES}
                  value={values.timeline}
                  onChange={(value) => set('timeline', value)}
                  columns={3}
                  describedBy={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-8">
            <Field label="Name" error={stepErrors.name}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={values.name}
                  onChange={(event) => set('name', event.target.value)}
                  autoComplete="name"
                  maxLength={LIMITS.name.max}
                  className={inputClass(invalid)}
                />
              )}
            </Field>

            <Field label="Email" error={stepErrors.email}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="email"
                  inputMode="email"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={values.email}
                  onChange={(event) => set('email', event.target.value)}
                  autoComplete="email"
                  maxLength={LIMITS.email.max}
                  className={inputClass(invalid)}
                />
              )}
            </Field>

            <Field label="Company" error={stepErrors.company} optional>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={values.company}
                  onChange={(event) => set('company', event.target.value)}
                  autoComplete="organization"
                  maxLength={LIMITS.company.max}
                  className={inputClass(invalid)}
                />
              )}
            </Field>

            {/* Summary so nothing is submitted unseen. */}
            <dl className="grid gap-px border border-line bg-line sm:grid-cols-2">
              {[
                { label: 'Need', value: values.needType },
                { label: 'Budget', value: values.budget },
                { label: 'Timeline', value: values.timeline },
                { label: 'Stack', value: values.currentStack || '—' },
              ].map((row) => (
                <div key={row.label} className="bg-void px-4 py-3">
                  <dt className="label-mono-sm text-faint">{row.label}</dt>
                  <dd className="mt-1.5 text-xs text-body">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-5 md:px-8">
        <div className="min-w-0">
          {status === 'error' && serverError ? (
            <p role="alert" className="font-mono text-[0.625rem] tracking-[0.1em] text-error uppercase">
              {serverError}
            </p>
          ) : (
            <MonoLabel size="sm" tone="faint">
              Step {step + 1} of {STEPS.length}
            </MonoLabel>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 ? (
            <ActionButton onClick={back} variant="ghost" brackets={false}>
              Back
            </ActionButton>
          ) : null}

          {step < STEPS.length - 1 ? (
            <ActionButton onClick={next} variant="secondary">
              Continue
            </ActionButton>
          ) : (
            <ActionButton
              type="submit"
              variant="primary"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Sending…' : 'Send enquiry'}
            </ActionButton>
          )}
        </div>
      </div>
    </form>
  );
}
