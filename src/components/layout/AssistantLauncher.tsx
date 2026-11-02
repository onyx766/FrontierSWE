'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { AssistantPanel } from '@/components/sections/AssistantPanel';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { EASE_OUT_EXPO } from '@/lib/motion';

/**
 * Persistent launcher for the portfolio assistant. The panel itself is only
 * mounted while open, so no assistant code runs — and no listeners exist — for
 * visitors who never open it.
 */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current || !(event.target instanceof Node)) return;
      if (panelRef.current.contains(event.target)) return;
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
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-label="Ask Ryan's AI"
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
              className="mb-3 h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] origin-bottom-right border border-line-strong bg-void shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]"
            >
              <AssistantPanel onClose={() => setOpen(false)} />
            </motion.div>
          ) : null}
        </AnimatePresence>

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
