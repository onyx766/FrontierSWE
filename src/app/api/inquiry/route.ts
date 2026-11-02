import { NextResponse } from 'next/server';
import { hasErrors, validateInquiry } from '@/lib/inquiry';
import type { InquiryPayload } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROJECT ENQUIRIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates with the same rules as the form (src/lib/inquiry.ts), rate-limits
 * per IP, then forwards to whichever destination is configured.
 *
 * TO RECEIVE ENQUIRIES, set one of:
 *   INQUIRY_WEBHOOK_URL   — a webhook (Slack, Discord, Zapier, your own API)
 *   INQUIRY_NOTIFY_EMAIL  — wire up your email provider in `deliver()` below
 *
 * With neither set, a submission is validated and logged and the visitor gets
 * a success response. That is deliberate for local development, but it means
 * enquiries are lost — configure a destination before going live.
 */

export const runtime = 'nodejs';

/**
 * In-memory rate limit. Resets on deploy and is per-instance, which is fine for
 * the threat here (a bored visitor, not a determined attacker). Swap for Redis
 * or Upstash if this ever needs to hold across instances.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 500) {
    for (const [existing, times] of hits) {
      if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(existing);
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

async function deliver(payload: InquiryPayload): Promise<void> {
  const webhook = process.env.INQUIRY_WEBHOOK_URL;

  if (webhook) {
    const text = [
      'New project enquiry',
      `Need:      ${payload.needType}`,
      `Budget:    ${payload.budget}`,
      `Timeline:  ${payload.timeline}`,
      `Stack:     ${payload.currentStack || '—'}`,
      `From:      ${payload.name} <${payload.email}>`,
      `Company:   ${payload.company || '—'}`,
      '',
      payload.description,
    ].join('\n');

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` suits Slack and Discord; `inquiry` carries the structured data
      // for a custom endpoint. Harmless extra keys either way.
      body: JSON.stringify({ text, content: text, inquiry: payload }),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded ${response.status}`);
    }
    return;
  }

  if (process.env.INQUIRY_NOTIFY_EMAIL) {
    // TODO: send with your email provider (Resend, Postmark, SES, …).
    // Left unimplemented rather than guessing at a provider you have not chosen.
    console.warn(
      '[inquiry] INQUIRY_NOTIFY_EMAIL is set but no email provider is implemented in deliver().',
    );
  }

  console.info('[inquiry] received (no delivery destination configured)', {
    needType: payload.needType,
    budget: payload.budget,
    timeline: payload.timeline,
    email: payload.email,
  });
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      { message: 'Too many enquiries from this address. Try again shortly.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const input = body as Partial<InquiryPayload>;
  const errors = validateInquiry(input);

  if (hasErrors(errors)) {
    return NextResponse.json(
      { message: 'Some fields need attention.', errors },
      { status: 422 },
    );
  }

  const payload: InquiryPayload = {
    needType: input.needType!,
    description: input.description!.trim(),
    currentStack: (input.currentStack ?? '').trim(),
    budget: input.budget!,
    timeline: input.timeline!,
    name: input.name!.trim(),
    email: input.email!.trim(),
    company: (input.company ?? '').trim(),
  };

  try {
    await deliver(payload);
  } catch (error) {
    console.error('[inquiry] delivery failed', error);
    return NextResponse.json(
      { message: 'Could not deliver the enquiry. Please email instead.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
