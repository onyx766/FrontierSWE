import {
  BUDGET_RANGES,
  NEED_TYPES,
  TIMELINES,
  type BudgetRange,
  type InquiryFieldErrors,
  type InquiryPayload,
  type NeedType,
  type Timeline,
} from '@/lib/types';

/**
 * One validator, used by both the form and the API route.
 *
 * Client-side validation is for the person filling the form in; server-side
 * validation is the one that matters. Sharing the implementation means the two
 * cannot drift apart and reject different things.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const LIMITS = {
  description: { min: 20, max: 4000 },
  stack: { max: 500 },
  name: { min: 2, max: 120 },
  email: { max: 200 },
  company: { max: 160 },
} as const;

export function emptyInquiry(): InquiryPayload {
  return {
    needType: NEED_TYPES[0],
    description: '',
    currentStack: '',
    budget: BUDGET_RANGES[5],
    timeline: TIMELINES[4],
    name: '',
    email: '',
    company: '',
  };
}

function isNeedType(value: unknown): value is NeedType {
  return typeof value === 'string' && (NEED_TYPES as readonly string[]).includes(value);
}

function isBudget(value: unknown): value is BudgetRange {
  return typeof value === 'string' && (BUDGET_RANGES as readonly string[]).includes(value);
}

function isTimeline(value: unknown): value is Timeline {
  return typeof value === 'string' && (TIMELINES as readonly string[]).includes(value);
}

export function validateInquiry(input: Partial<InquiryPayload>): InquiryFieldErrors {
  const errors: InquiryFieldErrors = {};

  if (!isNeedType(input.needType)) {
    errors.needType = 'Choose what you need built.';
  }

  const description = (input.description ?? '').trim();
  if (description.length < LIMITS.description.min) {
    errors.description = `Add a little more detail — at least ${LIMITS.description.min} characters.`;
  } else if (description.length > LIMITS.description.max) {
    errors.description = 'That is longer than the form accepts. Send the summary and we can go deeper by email.';
  }

  if ((input.currentStack ?? '').length > LIMITS.stack.max) {
    errors.currentStack = 'Keep the stack summary under 500 characters.';
  }

  if (!isBudget(input.budget)) {
    errors.budget = 'Pick a budget range — "not sure yet" is a valid answer.';
  }

  if (!isTimeline(input.timeline)) {
    errors.timeline = 'Pick a timeline.';
  }

  const name = (input.name ?? '').trim();
  if (name.length < LIMITS.name.min) {
    errors.name = 'Tell me your name.';
  } else if (name.length > LIMITS.name.max) {
    errors.name = 'That name is too long for the form.';
  }

  const email = (input.email ?? '').trim();
  if (!EMAIL_PATTERN.test(email) || email.length > LIMITS.email.max) {
    errors.email = 'A valid email address is needed for a reply.';
  }

  if ((input.company ?? '').length > LIMITS.company.max) {
    errors.company = 'Company name is too long.';
  }

  return errors;
}

export function hasErrors(errors: InquiryFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Fields belonging to each step, so a step can be validated on its own. */
export const STEP_FIELDS: readonly (readonly (keyof InquiryPayload)[])[] = [
  ['needType'],
  ['description', 'currentStack', 'budget', 'timeline'],
  ['name', 'email', 'company'],
];

export function errorsForStep(
  errors: InquiryFieldErrors,
  step: number,
): InquiryFieldErrors {
  const fields = STEP_FIELDS[step] ?? [];
  const result: InquiryFieldErrors = {};
  for (const field of fields) {
    const message = errors[field];
    if (message) result[field] = message;
  }
  return result;
}
