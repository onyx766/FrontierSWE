'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import {
  LIMITS,
  STEP_FIELDS,
  emptyInquiry,
  errorsForStep,
  hasErrors,
  validateInquiry,
} from '@/lib/inquiry';
import {
  BUDGET_RANGES,
  NEED_TYPES,
  TIMELINES,
  type InquiryFieldErrors,
  type InquiryPayload,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import styles from './ProjectForm.module.css';

const STEPS = [
  { label: 'What you need', hint: 'Pick the closest match' },
  { label: 'The project', hint: 'Details, budget, timeline' },
  { label: 'Contact', hint: 'Where to reply' },
] as const;

const NEED_ICONS: Record<(typeof NEED_TYPES)[number], Parameters<typeof Icon>[0]['name']> = {
  'AI / LLM System': 'cpu',
  'SaaS Product': 'layers',
  'Backend / API': 'server',
  'Existing Bug': 'bug',
  'AI Integration': 'sparkles',
  'Realtime System': 'bolt',
  'Database / Performance': 'database',
  MVP: 'rocket',
  Other: 'message',
};

type Status =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'failed'; message: string };

/**
 * The "Start a Project" enquiry, in three steps. Each step is validated on
 * its own before moving on, with the same rules the API applies
 * (src/lib/inquiry.ts), so the form and the server reject exactly the same
 * things. Server-side field errors send the visitor back to the step they
 * belong to.
 */
export function ProjectForm({ email }: { email: string }) {
  const uid = useId();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<InquiryPayload>(emptyInquiry);
  const [touched, setTouched] = useState<boolean[]>([false, false, false]);
  const [serverErrors, setServerErrors] = useState<InquiryFieldErrors>({});
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const formRef = useRef<HTMLFormElement | null>(null);

  const allErrors = { ...validateInquiry(values), ...serverErrors };
  const visibleErrors: InquiryFieldErrors = touched[step] ? errorsForStep(allErrors, step) : {};

  const set = <K extends keyof InquiryPayload>(key: K, value: InquiryPayload[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (serverErrors[key]) {
      setServerErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  /** Moves focus to the first invalid field of a step, after React has rendered it. */
  const focusFirstError = (target: number, errors: InquiryFieldErrors) => {
    const field = (STEP_FIELDS[target] ?? []).find((name) => errors[name]);
    if (!field) return;
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    });
  };

  const markTouched = (index: number) =>
    setTouched((current) => current.map((value, i) => (i === index ? true : value)));

  const goTo = (target: number) => {
    setStep(target);
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
    });
  };

  const next = () => {
    markTouched(step);
    const errors = errorsForStep(allErrors, step);
    if (hasErrors(errors)) {
      focusFirstError(step, errors);
      return;
    }
    goTo(Math.min(STEPS.length - 1, step + 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    // Every step, not just this one: a visitor can reach here having skipped nothing,
    // but the server is the final word and we check the whole payload first.
    setTouched([true, true, true]);
    const errors = validateInquiry(values);
    const firstBad = STEP_FIELDS.findIndex((fields) => fields.some((field) => errors[field]));
    if (firstBad !== -1) {
      if (firstBad !== step) setStep(firstBad);
      focusFirstError(firstBad, errors);
      return;
    }

    setStatus({ state: 'sending' });
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        setStatus({ state: 'sent' });
        // The confirmation is shorter than the form; keep it in view.
        requestAnimationFrame(() =>
          document.getElementById(`${uid}-done`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
        );
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: InquiryFieldErrors;
      } | null;
      if (response.status === 422 && body?.errors) {
        setServerErrors(body.errors);
        const target = STEP_FIELDS.findIndex((fields) => fields.some((field) => body.errors?.[field]));
        if (target !== -1) {
          setStep(target);
          focusFirstError(target, body.errors);
        }
      }
      setStatus({ state: 'failed', message: body?.message ?? 'Something went wrong sending that.' });
    } catch {
      setStatus({ state: 'failed', message: 'Could not reach the server. Check your connection and try again.' });
    }
  };

  const reset = () => {
    setValues(emptyInquiry());
    setTouched([false, false, false]);
    setServerErrors({});
    setStatus({ state: 'idle' });
    setStep(0);
  };

  if (status.state === 'sent') {
    return (
      <div id={`${uid}-done`} className={cn(styles.panel, styles.done)} role="status">
        <span className={styles.doneBadge}>
          <Icon name="check" className="size-7" strokeWidth={2.5} />
        </span>
        <h3 className="lp-h3 mt-5 text-xl">Thanks, {values.name.split(' ')[0]} — enquiry sent.</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-lp-body">
          You will get a reply at <strong className="text-lp-ink">{values.email}</strong> with either a
          concrete scope or a short list of questions.
        </p>
        <button type="button" onClick={reset} className={cn(styles.ghost, 'mt-6')}>
          Send another enquiry
        </button>
      </div>
    );
  }

  const field = (name: keyof InquiryPayload) => ({
    id: `${uid}-${name}`,
    name,
    'aria-invalid': visibleErrors[name] ? true : undefined,
    'aria-describedby': visibleErrors[name] ? `${uid}-${name}-error` : undefined,
  });

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={styles.panel} aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="sr-only">
        Start a project
      </h3>

      {/* Step indicator: also lets a visitor go back to a step already passed. */}
      <ol className={styles.steps}>
        {STEPS.map((item, index) => {
          const state = index === step ? 'current' : index < step ? 'done' : 'todo';
          return (
            <li key={item.label} data-state={state} aria-current={index === step ? 'step' : undefined}>
              <button
                type="button"
                className={styles.stepButton}
                disabled={index > step}
                onClick={() => goTo(index)}
              >
                <span className={styles.stepDot}>
                  {state === 'done' ? (
                    <Icon name="check" className="size-3.5" strokeWidth={2.75} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[0.8rem] font-semibold">{item.label}</span>
                  <span className="hidden text-[0.72rem] text-lp-muted sm:block">{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className={styles.progress} aria-hidden>
        <span style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
      </div>

      <div className={styles.body}>
        {/* ── Step 1 ── */}
        <fieldset hidden={step !== 0} className={styles.step}>
          <legend data-step-heading tabIndex={-1} className={styles.legend}>
            What do you need built?
          </legend>
          <p className={styles.hint}>Pick the closest match. It only shapes the first reply — nothing is locked in.</p>
          <div className={styles.needGrid}>
            {NEED_TYPES.map((need) => (
              <label key={need} className={styles.need}>
                <input
                  type="radio"
                  name="needType"
                  value={need}
                  checked={values.needType === need}
                  onChange={() => set('needType', need)}
                  className="sr-only"
                />
                <span className={styles.needIcon}>
                  <Icon name={NEED_ICONS[need]} className="size-[1.15rem]" />
                </span>
                <span className="text-sm font-semibold">{need}</span>
                <span className={styles.needCheck} aria-hidden>
                  <Icon name="check" className="size-3" strokeWidth={3} />
                </span>
              </label>
            ))}
          </div>
          <ErrorText id={`${uid}-needType-error`} message={visibleErrors.needType} />
        </fieldset>

        {/* ── Step 2 ── */}
        <fieldset hidden={step !== 1} className={styles.step}>
          <legend data-step-heading tabIndex={-1} className={styles.legend}>
            Tell me about the project
          </legend>

          <Field
            label="Project description"
            htmlFor={`${uid}-description`}
            hint="What are you building, or what is broken? The specific version is more useful than the general one."
            error={visibleErrors.description}
            errorId={`${uid}-description-error`}
            aside={`${values.description.trim().length} / ${LIMITS.description.max}`}
          >
            <textarea
              {...field('description')}
              rows={5}
              maxLength={LIMITS.description.max}
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="e.g. We have a FastAPI backend and want a RAG assistant over our internal docs. Retrieval quality matters more than speed."
              className={styles.input}
            />
          </Field>

          <Field
            label="Current technology stack"
            optional
            htmlFor={`${uid}-currentStack`}
            hint="Languages, frameworks, database, hosting. Write “greenfield” if there is nothing yet."
            error={visibleErrors.currentStack}
            errorId={`${uid}-currentStack-error`}
          >
            <input
              {...field('currentStack')}
              type="text"
              maxLength={LIMITS.stack.max}
              value={values.currentStack}
              onChange={(event) => set('currentStack', event.target.value)}
              placeholder="e.g. Next.js, FastAPI, PostgreSQL, deployed on AWS"
              className={styles.input}
            />
          </Field>

          <ChoiceGroup
            label="Budget range"
            hint="An honest range saves us both time. Small budgets are fine."
            name="budget"
            options={BUDGET_RANGES}
            value={values.budget}
            onChange={(value) => set('budget', value)}
            error={visibleErrors.budget}
            errorId={`${uid}-budget-error`}
          />
          <ChoiceGroup
            label="Desired timeline"
            name="timeline"
            options={TIMELINES}
            value={values.timeline}
            onChange={(value) => set('timeline', value)}
            error={visibleErrors.timeline}
            errorId={`${uid}-timeline-error`}
          />
        </fieldset>

        {/* ── Step 3 ── */}
        <fieldset hidden={step !== 2} className={styles.step}>
          <legend data-step-heading tabIndex={-1} className={styles.legend}>
            Where should I reply?
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor={`${uid}-name`} error={visibleErrors.name} errorId={`${uid}-name-error`}>
              <input
                {...field('name')}
                type="text"
                autoComplete="name"
                maxLength={LIMITS.name.max}
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
                className={styles.input}
              />
            </Field>
            <Field label="Email" htmlFor={`${uid}-email`} error={visibleErrors.email} errorId={`${uid}-email-error`}>
              <input
                {...field('email')}
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={LIMITS.email.max}
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
                className={styles.input}
              />
            </Field>
          </div>
          <Field
            label="Company"
            optional
            htmlFor={`${uid}-company`}
            error={visibleErrors.company}
            errorId={`${uid}-company-error`}
          >
            <input
              {...field('company')}
              type="text"
              autoComplete="organization"
              maxLength={LIMITS.company.max}
              value={values.company}
              onChange={(event) => set('company', event.target.value)}
              className={styles.input}
            />
          </Field>

          <dl className={styles.summary}>
            {[
              { label: 'Need', value: values.needType, step: 0 },
              { label: 'Budget', value: values.budget, step: 1 },
              { label: 'Timeline', value: values.timeline, step: 1 },
              { label: 'Stack', value: values.currentStack.trim() || '—', step: 1 },
            ].map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <span className="truncate">{row.value}</span>
                  <button type="button" onClick={() => goTo(row.step)} className={styles.edit}>
                    Edit<span className="sr-only"> {row.label.toLowerCase()}</span>
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </fieldset>
      </div>

      <div className={styles.footer}>
        {status.state === 'failed' ? (
          <p role="alert" className={styles.failure}>
            <Icon name="x" className="size-4 shrink-0" />
            <span>
              {status.message} You can also email <a href={`mailto:${email}`}>{email}</a>.
            </span>
          </p>
        ) : (
          <p className="text-xs text-lp-muted">
            Step {step + 1} of {STEPS.length}
          </p>
        )}
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className={styles.ghost}>
              <Icon name="arrow-left" className="size-4" />
              Back
            </button>
          ) : null}
          <button type="submit" className="lp-btn lp-btn-gradient" disabled={status.state === 'sending'}>
            {step < STEPS.length - 1 ? (
              <>
                Continue
                <span data-icon="arrow-right" className="lp-btn-icon inline-flex">
                  <Icon name="arrow-right" className="size-full" strokeWidth={2} />
                </span>
              </>
            ) : status.state === 'sending' ? (
              <>
                <span className={styles.spinner} aria-hidden />
                Sending…
              </>
            ) : (
              <>
                Send enquiry
                <span data-icon="arrow-up-right" className="lp-btn-icon inline-flex">
                  <Icon name="arrow-up-right" className="size-full" strokeWidth={2} />
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function ErrorText({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className={styles.error}>
      <Icon name="x" className="size-3.5 shrink-0" strokeWidth={2.5} />
      {message}
    </p>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  optional,
  error,
  errorId,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  error: string | undefined;
  errorId: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
          {optional ? <span className="ml-1.5 font-normal text-lp-muted">(optional)</span> : null}
        </label>
        {aside ? <span className="text-xs tabular-nums text-lp-muted">{aside}</span> : null}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
      <ErrorText id={errorId} message={error} />
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  hint,
  name,
  options,
  value,
  onChange,
  error,
  errorId,
}: {
  label: string;
  hint?: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  error: string | undefined;
  errorId: string;
}) {
  return (
    <fieldset className={styles.field} aria-describedby={error ? errorId : undefined}>
      <legend className={styles.label}>{label}</legend>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      <div className={styles.chips}>
        {options.map((option) => (
          <label key={option} className={styles.chip}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      <ErrorText id={errorId} message={error} />
    </fieldset>
  );
}
