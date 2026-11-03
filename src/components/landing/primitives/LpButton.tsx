import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { Magnetic } from './Magnetic';

export type LpButtonVariant = 'dark' | 'outline' | 'gradient' | 'light' | 'ghost-dark';
export type LpButtonSize = 'sm' | 'md' | 'lg';

interface LpButtonProps {
  href: string;
  children: ReactNode;
  variant?: LpButtonVariant;
  size?: LpButtonSize;
  /** Trailing arrow. `arrow-up-right` swings to point forward on hover. */
  icon?: 'arrow-right' | 'arrow-up-right' | null;
  /** Leading content, e.g. an <Icon />. */
  leading?: ReactNode;
  /** Follows the cursor slightly while hovered. */
  magnetic?: boolean;
  /** Opens in a new tab (for off-site links). */
  external?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * The landing page's pill button, rendered as a link. Styles are the
 * `.lp-btn*` component classes in globals.css. In-page anchors (`#…`) and
 * mailto links render a plain <a>; app routes use next/link.
 */
export function LpButton({
  href,
  children,
  variant = 'dark',
  size = 'md',
  icon = 'arrow-right',
  leading,
  magnetic = false,
  external = false,
  className,
  ariaLabel,
}: LpButtonProps) {
  const classes = cn('lp-btn', `lp-btn-${variant}`, className);
  const content = (
    <>
      {leading}
      <span>{children}</span>
      {icon ? (
        <span data-icon={icon} className="lp-btn-icon inline-flex">
          <Icon name={icon} className="size-full" strokeWidth={2} />
        </span>
      ) : null}
    </>
  );

  const plain = external || href.startsWith('#') || href.startsWith('mailto:');
  const link = plain ? (
    <a
      href={href}
      className={classes}
      data-size={size}
      aria-label={ariaLabel}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {content}
    </a>
  ) : (
    <Link href={href} className={classes} data-size={size} aria-label={ariaLabel}>
      {content}
    </Link>
  );

  return magnetic ? <Magnetic>{link}</Magnetic> : link;
}
