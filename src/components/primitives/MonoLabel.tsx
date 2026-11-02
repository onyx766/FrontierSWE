import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  size?: 'sm' | 'md';
  tone?: 'muted' | 'body' | 'accent' | 'primary' | 'faint' | 'warn';
}

/**
 * The mono / uppercase / wide-tracking metadata label. This is the connective
 * texture of the whole site — section kickers, node ids, latency readouts.
 */
export function MonoLabel({
  children,
  className,
  as: Tag = 'span',
  size = 'md',
  tone = 'muted',
}: MonoLabelProps) {
  const toneClass = {
    muted: 'text-muted',
    body: 'text-body',
    accent: 'text-accent',
    primary: 'text-primary',
    faint: 'text-faint',
    warn: 'text-warn',
  }[tone];

  return (
    <Tag className={cn(size === 'sm' ? 'label-mono-sm' : 'label-mono', toneClass, className)}>
      {children}
    </Tag>
  );
}
