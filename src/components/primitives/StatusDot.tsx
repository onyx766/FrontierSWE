import { cn } from '@/lib/utils';
import type { AvailabilityState } from '@/lib/types';

interface StatusDotProps {
  state?: AvailabilityState | 'ok' | 'warn' | 'error';
  className?: string;
  /** Adds a slow opacity blink. Suppressed under reduced motion by globals.css. */
  pulse?: boolean;
}

const COLOR: Record<string, string> = {
  available: 'bg-accent',
  ok: 'bg-accent',
  limited: 'bg-warn',
  warn: 'bg-warn',
  unavailable: 'bg-error',
  error: 'bg-error',
};

export function StatusDot({ state = 'available', className, pulse = true }: StatusDotProps) {
  const color = COLOR[state] ?? 'bg-accent';
  return (
    <span aria-hidden className={cn('relative inline-flex h-1.5 w-1.5 shrink-0', className)}>
      <span className={cn('absolute inset-0 rounded-full', color, pulse && 'animate-status-blink')} />
      <span className={cn('absolute -inset-1 rounded-full opacity-20', color)} />
    </span>
  );
}
