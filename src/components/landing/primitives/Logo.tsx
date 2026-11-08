import { cn } from '@/lib/utils';

/**
 * The "O" mark: a skewed ring broken at the lower right, where the shorter arc
 * picks up the lighter end of the violet gradient. `uid` keeps gradient ids
 * unique when the mark appears twice on a page (nav and footer).
 */
export function LogoMark({ uid, className }: { uid: string; className?: string }) {
  const main = `lp-logo-${uid}-main`;
  const leg = `lp-logo-${uid}-leg`;
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden focusable="false" className={className}>
      <defs>
        <linearGradient id={main} x1="4" y1="3" x2="26" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f2ee8" />
          <stop offset="0.55" stopColor="#6d4aff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={leg} x1="16" y1="21" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {/* The skew gives the ring the same slant the wordmark carries. */}
      <g transform="translate(2 0) skewX(-8)" fill="none" strokeWidth="5.2">
        {/* pathLength 100 makes each dash a plain percentage of the ring. */}
        <circle
          cx="16"
          cy="16"
          r="10"
          pathLength="100"
          stroke={`url(#${main})`}
          strokeDasharray="73.6 26.4"
          transform="rotate(70 16 16)"
        />
        <circle
          cx="16"
          cy="16"
          r="10"
          pathLength="100"
          stroke={`url(#${leg})`}
          strokeDasharray="20.8 79.2"
          transform="rotate(345 16 16)"
        />
      </g>
    </svg>
  );
}

/** Mark plus wordmark. The mark turns once on hover of the enclosing `.group`. */
export function Logo({
  uid,
  name,
  className,
  tone = 'light',
}: {
  uid: string;
  name: string;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="inline-flex [perspective:400px]">
        <LogoMark
          uid={uid}
          className="size-8 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:[transform:rotateY(360deg)]"
        />
      </span>
      <span
        className={cn(
          'text-[1.3rem] leading-none font-bold tracking-[-0.03em]',
          tone === 'light' ? 'text-lp-ink' : 'text-white',
        )}
      >
        {name}
      </span>
    </span>
  );
}
