import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CornerBracketsProps {
  className?: string;
}

/**
 * The signature panel treatment: four 1px L-shaped corner brackets instead of
 * a rounded border. Reads as a technical drawing rather than a card.
 */
export function CornerBrackets({ className }: CornerBracketsProps) {
  const base = 'pointer-events-none absolute h-2.5 w-2.5 border-line-strong';
  return (
    <span aria-hidden className={cn('absolute inset-0', className)}>
      <span className={cn(base, '-top-px -left-px border-t border-l')} />
      <span className={cn(base, '-top-px -right-px border-t border-r')} />
      <span className={cn(base, '-bottom-px -left-px border-b border-l')} />
      <span className={cn(base, '-bottom-px -right-px border-b border-r')} />
    </span>
  );
}

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Surface tone. `panel` is the default card; `void` keeps the page base. */
  tone?: 'panel' | 'void' | 'elevated';
  brackets?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}

export function Panel({
  children,
  className,
  tone = 'panel',
  brackets = true,
  as: Tag = 'div',
}: PanelProps) {
  const toneClass =
    tone === 'panel' ? 'bg-panel' : tone === 'elevated' ? 'bg-elevated' : 'bg-transparent';

  return (
    <Tag className={cn('relative border border-line', toneClass, className)}>
      {brackets ? <CornerBrackets /> : null}
      {children}
    </Tag>
  );
}
