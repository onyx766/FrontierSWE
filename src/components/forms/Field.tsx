'use client';

import { useId, type ReactNode } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/**
 * Accessible field wrapper: one label, one description, one error, correctly
 * associated by id. Written as a render prop so every control type gets the
 * same wiring without duplicating it.
 */
export function Field({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="label-mono text-body">
          {label}
        </label>
        {optional ? (
          <MonoLabel size="sm" tone="faint">
            Optional
          </MonoLabel>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-faint">
          {hint}
        </p>
      ) : null}

      <div className="mt-3">{children({ id, describedBy, invalid: Boolean(error) })}</div>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 font-mono text-[0.625rem] tracking-[0.1em] text-error uppercase">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = (invalid: boolean) =>
  cn(
    'w-full border bg-panel px-4 py-3 text-sm text-primary transition-colors',
    'placeholder:text-faint focus:outline-none',
    invalid
      ? 'border-error/60 focus:border-error'
      : 'border-line hover:border-line-strong focus:border-accent',
  );

/** Square radio-card group, matching the diagram language of the site. */
export function OptionGrid<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 3,
  describedBy,
  invalid,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  columns?: 2 | 3;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn('grid gap-px bg-line', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'flex items-center gap-3 px-4 py-4 text-left transition-colors',
              selected ? 'bg-accent/10 text-accent' : 'bg-void text-body hover:bg-elevated',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 shrink-0 border transition-colors',
                selected ? 'border-accent bg-accent' : 'border-line-strong',
              )}
            />
            <span className="font-mono text-[0.6875rem] tracking-[0.1em] uppercase">{option}</span>
          </button>
        );
      })}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
