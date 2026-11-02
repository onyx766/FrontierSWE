'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ActionButton } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { answerFromKnowledge, suggestedQuestions } from '@/data/assistant';
import { cn } from '@/lib/utils';
import type { AssistantAnswer } from '@/lib/types';

interface Turn {
  id: string;
  question: string;
  answer: AssistantAnswer | null;
  error?: string;
}

/**
 * ASK RYAN'S AI
 *
 * The interface is complete and works with no AI backend configured: it posts
 * to /api/assistant, which falls back to the keyword-matched knowledge base in
 * src/data/assistant.ts. If the request fails entirely, it answers locally, so
 * the feature is never broken in front of a visitor.
 *
 * Replacing the mock with a real LLM or RAG backend is a server-side change
 * only — see src/app/api/assistant/route.ts. Nothing in this component needs
 * to change, including the streaming-friendly turn model.
 */
export function AssistantPanel({ onClose }: { onClose?: () => void }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const inputId = useId();
  const logRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, pending]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      counterRef.current += 1;
      const id = `turn-${counterRef.current}`;

      setTurns((previous) => [...previous, { id, question: trimmed, answer: null }]);
      setQuestion('');
      setPending(true);

      try {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed }),
        });

        if (!response.ok) throw new Error(`Assistant responded ${response.status}`);

        const data = (await response.json()) as AssistantAnswer;
        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, answer: data } : turn)),
        );
      } catch {
        // Local fallback: the knowledge base is bundled, so an offline or
        // failed request still produces a useful answer.
        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === id ? { ...turn, answer: answerFromKnowledge(trimmed) } : turn,
          ),
        );
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2.5">
          <StatusDot state="ok" />
          <MonoLabel tone="accent">Ask Ryan&rsquo;s AI</MonoLabel>
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="flex h-7 w-7 items-center justify-center border border-line text-muted transition-colors hover:border-line-strong hover:text-primary"
          >
            <span aria-hidden className="text-xs">
              ✕
            </span>
          </button>
        ) : null}
      </div>

      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Assistant conversation"
      >
        {turns.length === 0 ? (
          <div>
            <p className="text-sm leading-relaxed text-body">
              Ask about experience, the stack, the project case studies, how engagements work, or
              current availability.
            </p>
            <MonoLabel size="sm" className="mt-6 block">
              Try asking
            </MonoLabel>
            <ul className="mt-3 space-y-2">
              {suggestedQuestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="w-full border border-line bg-elevated/60 px-3 py-2.5 text-left text-xs text-body transition-colors hover:border-line-strong hover:text-primary"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-6">
            {turns.map((turn) => (
              <li key={turn.id}>
                <div className="flex gap-2.5">
                  <MonoLabel size="sm" tone="faint" className="mt-1 shrink-0">
                    You
                  </MonoLabel>
                  <p className="text-sm text-primary">{turn.question}</p>
                </div>
                <div className="mt-3 flex gap-2.5">
                  <MonoLabel size="sm" tone="accent" className="mt-1 shrink-0">
                    AI
                  </MonoLabel>
                  <div className="min-w-0">
                    {turn.answer ? (
                      <>
                        <p className="text-sm leading-relaxed text-body">{turn.answer.answer}</p>
                        {turn.answer.sources.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {turn.answer.sources.map((source) => (
                              <li key={source.href}>
                                <Link
                                  href={source.href}
                                  className="inline-flex items-center gap-1.5 border border-line px-2 py-1 font-mono text-[0.5625rem] tracking-[0.12em] text-muted uppercase transition-colors hover:border-accent/40 hover:text-accent"
                                >
                                  {source.label}
                                  <span aria-hidden>→</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {turn.answer.mock ? (
                          <MonoLabel size="sm" tone="faint" className="mt-3 block">
                            Answered from the built-in knowledge base
                          </MonoLabel>
                        ) : null}
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-muted">
                        Retrieving
                        <span aria-hidden className="animate-caret">
                          _
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="border-t border-line p-3"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask a question about Ryan&rsquo;s engineering experience
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="pl-1 font-mono text-xs text-accent">
            &gt;
          </span>
          <input
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question…"
            autoComplete="off"
            className={cn(
              'min-w-0 flex-1 bg-transparent py-2 text-sm text-primary placeholder:text-faint',
              'outline-none',
            )}
          />
          <ActionButton
            type="submit"
            variant="primary"
            size="sm"
            brackets={false}
            disabled={pending || question.trim().length === 0}
          >
            Ask
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
