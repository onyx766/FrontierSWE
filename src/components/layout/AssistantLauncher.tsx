'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { cn } from '@/lib/utils';

/**
 * The assistant panel is code-split and loaded only when a visitor opens it.
 * It sits in the root layout, so bundling it statically would put the whole
 * assistant — and the knowledge base it falls back to — into the first load of
 * every page for a feature most visitors never touch.
 */
const AssistantPanel = dynamic(
  () => import('@/components/sections/AssistantPanel').then((module) => module.AssistantPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <MonoLabel size="sm" tone="faint">
          Loading assistant…
        </MonoLabel>
      </div>
    ),
  },
);

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Keeps the panel in the DOM after first open so the exit transition can run.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end">
      <div className="pointer-events-auto p-4 md:p-6">
        {mounted ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Ask Ryan's AI"
            aria-hidden={!open}
            // `hidden` would block the transition, so visibility is used
            // instead and pointer events are disabled while closed.
            className={cn(
              'mb-3 h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] origin-bottom-right border border-line-strong bg-void',
              'shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
              open
                ? 'translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none invisible translate-y-2 scale-[0.985] opacity-0',
            )}
          >
            {open ? <AssistantPanel onClose={() => setOpen(false)} /> : null}
          </div>
        ) : null}

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="ml-auto flex items-center gap-2.5 border border-line-strong bg-panel/90 px-4 py-3 backdrop-blur-md transition-colors hover:border-accent/50 hover:bg-elevated"
        >
          <StatusDot state="ok" pulse={!open} />
          <MonoLabel tone={open ? 'muted' : 'accent'}>
            {open ? 'Close' : "Ask Ryan's AI"}
          </MonoLabel>
        </button>
      </div>
    </div>
  );
}
