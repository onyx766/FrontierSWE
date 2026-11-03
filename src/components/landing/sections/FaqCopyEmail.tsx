'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { cn } from '@/lib/utils';

const subscribeNever = () => () => {};

/**
 * Copies the email address. Rendered only once hydrated: without JavaScript
 * there is nothing to copy with, and the mailto link beside it already works.
 * `useSyncExternalStore` reports false on the server and during hydration,
 * so the markup always matches.
 */
export function FaqCopyEmail({ email }: { email: string }) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!hydrated) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      return; // Clipboard blocked or unavailable: the mailto link still works.
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <span aria-hidden className="h-5 w-px shrink-0 bg-lp-line" />
      <button
        type="button"
        onClick={copy}
        aria-label="Copy email address"
        className={cn(
          'group/copy relative ml-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[0.65rem] transition-[background-color,color] duration-300',
          copied
            ? 'bg-lp-green/10 text-green-700'
            : 'text-lp-body [@media(hover:hover)_and_(pointer:fine)]:hover:bg-lp-tint [@media(hover:hover)_and_(pointer:fine)]:hover:text-lp-violet-700',
        )}
      >
        <Icon
          name={copied ? 'check' : 'copy'}
          className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/copy:-rotate-12"
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-lp-ink px-2.5 py-1 text-[0.6875rem] font-semibold whitespace-nowrap text-white transition-[opacity,translate] duration-300',
            copied ? 'opacity-100' : 'translate-y-1 opacity-0',
          )}
        >
          Copied
        </span>
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Email address copied' : ''}
      </span>
    </>
  );
}
