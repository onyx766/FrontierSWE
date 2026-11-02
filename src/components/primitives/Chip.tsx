import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'accent' | 'warn' | 'outline';
  size?: 'sm' | 'md';
}

/** Technology / status chip. Square, hairline, mono. */
export function Chip({ children, className, tone = 'default', size = 'md' }: ChipProps) {
  const toneClass = {
    default: 'border-line bg-elevated text-body',
    accent: 'border-accent/40 bg-accent/10 text-accent',
    warn: 'border-warn/40 bg-warn/10 text-warn',
    outline: 'border-line text-muted',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border font-mono uppercase tracking-[0.12em] whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.5625rem]' : 'px-2 py-1 text-[0.625rem]',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Marks data that is still placeholder content. Visible on purpose: it should
 * be impossible to ship invented detail by accident.
 */
export function PlaceholderChip({ className }: { className?: string }) {
  return (
    <Chip tone="warn" size="sm" className={className}>
      Placeholder
    </Chip>
  );
}
