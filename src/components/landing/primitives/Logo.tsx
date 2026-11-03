import { cn } from '@/lib/utils';

/**
 * The "R" mark: a slanted stem-and-bowl with the leg cut free, in the violet
 * gradient. `uid` keeps gradient ids unique when the mark appears twice on a
 * page (nav and footer).
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
      <g transform="translate(3.4 0) skewX(-8)">
        <path
          fillRule="evenodd"
          fill={`url(#${main})`}
          d="M6 4h11.5c4.7 0 8 3.1 8 7.6s-3.3 7.6-8 7.6h-5.1V28H6Zm6.4 5.2V14H17c1.7 0 2.6-1 2.6-2.4S18.7 9.2 17 9.2Z"
        />
        <path fill={`url(#${leg})`} d="M15.4 21.4h6.7L27 28h-6.7Z" />
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
