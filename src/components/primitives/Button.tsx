import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'border-accent/60 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent active:bg-accent/25',
  secondary:
    'border-line-strong bg-transparent text-primary hover:border-muted hover:bg-elevated',
  ghost: 'border-transparent bg-transparent text-muted hover:text-primary',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-2 text-[0.625rem]',
  md: 'px-5 py-3 text-[0.6875rem]',
  lg: 'px-6 py-4 text-xs',
};

const BASE =
  'group relative inline-flex items-center justify-center gap-2.5 border font-mono uppercase tracking-[0.18em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Renders the bracket affordance, e.g. [ START A PROJECT ]. */
  brackets?: boolean;
}

function Inner({ children, brackets }: { children: ReactNode; brackets?: boolean }) {
  if (!brackets) return <>{children}</>;
  return (
    <>
      <span aria-hidden className="text-current opacity-40">
        [
      </span>
      {children}
      <span aria-hidden className="text-current opacity-40">
        ]
      </span>
    </>
  );
}

interface ActionLinkProps extends CommonProps {
  href: string;
  external?: boolean;
}

export function ActionLink({
  href,
  children,
  variant = 'secondary',
  size = 'md',
  className,
  brackets = true,
  external = false,
}: ActionLinkProps) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={classes}>
        <Inner brackets={brackets}>{children}</Inner>
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      <Inner brackets={brackets}>{children}</Inner>
    </Link>
  );
}

interface ActionButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {}

export function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  brackets = true,
  type = 'button',
  ...rest
}: ActionButtonProps) {
  return (
    <button type={type} className={cn(BASE, VARIANT[variant], SIZE[size], className)} {...rest}>
      <Inner brackets={brackets}>{children}</Inner>
    </button>
  );
}
