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
 * TO RECEIVE ENQUIRIES, set either or both:
 *   RESEND_API_KEY + INQUIRY_NOTIFY_EMAIL  — an email to your inbox (Resend)
 *   INQUIRY_WEBHOOK_URL                    — a webhook (Slack, Discord, Zapier, …)
 *
 * With neither set, development logs the enquiry and reports success;
 * production returns 503 so the visitor is told to email instead.
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

/** Thrown when there is nowhere to send an enquiry, so it is not silently lost. */
class NotConfiguredError extends Error {}

function enquiryText(payload: InquiryPayload): string {
  return [
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
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function enquiryHtml(payload: InquiryPayload): string {
  const rows: [string, string][] = [
    ['Need', payload.needType],
    ['Budget', payload.budget],
    ['Timeline', payload.timeline],
    ['Stack', payload.currentStack || '—'],
    ['From', `${payload.name} <${payload.email}>`],
    ['Company', payload.company || '—'],
  ];
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#6f6b8a;font-size:13px;white-space:nowrap">${label}</td>` +
        `<td style="padding:6px 0;color:#0e0c22;font-size:14px">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px">
<h2 style="margin:0 0 16px;color:#0e0c22;font-size:20px">New project enquiry</h2>
<table style="border-collapse:collapse;margin-bottom:18px">${cells}</table>
<div style="padding:14px 16px;border-radius:12px;background:#f4f2fc;color:#2a2742;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(payload.description)}</div>
<p style="margin-top:18px;color:#6f6b8a;font-size:12px">Reply to this email to answer ${escapeHtml(payload.name)} directly.</p>
</div>`;
}

/**
 * Email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email),
 * called with fetch so no SDK is needed. Reply-To is the visitor, so replying
 * from the inbox answers them directly.
 */
async function sendEmail(payload: InquiryPayload, apiKey: string, to: string): Promise<void> {
  // Resend's shared test sender needs no domain setup, but can only deliver to
  // the address that owns the Resend account. Use your own verified domain to
  // send anywhere: INQUIRY_FROM="Portfolio <hello@yourdomain.com>".
  const from = process.env.INQUIRY_FROM || 'Portfolio <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: payload.email,
      subject: `New project enquiry: ${payload.needType} — ${payload.name}`,
      text: enquiryText(payload),
      html: enquiryHtml(payload),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}

async function postWebhook(payload: InquiryPayload, webhook: string): Promise<void> {
  const text = enquiryText(payload);
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `text` suits Slack and Discord; `inquiry` carries the structured data
    // for a custom endpoint. Harmless extra keys either way.
    body: JSON.stringify({ text, content: text, inquiry: payload }),
  });
  if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
}

async function deliver(payload: InquiryPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFY_EMAIL;
  const webhook = process.env.INQUIRY_WEBHOOK_URL;

  const jobs: Promise<void>[] = [];
  if (apiKey && to) jobs.push(sendEmail(payload, apiKey, to));
  if (webhook) jobs.push(postWebhook(payload, webhook));

  if (jobs.length === 0) {
    if (to && !apiKey) console.warn('[inquiry] INQUIRY_NOTIFY_EMAIL is set but RESEND_API_KEY is not.');
    // In development, logging is enough. In production, telling a visitor
    // "sent" when nothing was sent would lose their enquiry, so fail instead.
    if (process.env.NODE_ENV === 'production') throw new NotConfiguredError();
    console.info('[inquiry] received (no delivery destination configured)', {
      needType: payload.needType,
      email: payload.email,
    });
    return;
  }

  // Succeed if any destination took it: one working channel is enough.
  const results = await Promise.allSettled(jobs);
  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) console.error('[inquiry] delivery failed', failure.reason);
  if (failures.length === results.length) throw new Error('Every delivery destination failed');
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
    if (error instanceof NotConfiguredError) {
      console.error('[inquiry] no delivery destination configured: enquiry not sent');
      return NextResponse.json(
        { message: 'The form is not accepting enquiries right now. Please email instead.' },
        { status: 503 },
      );
    }
    console.error('[inquiry] delivery failed', error);
    return NextResponse.json(
      { message: 'Could not deliver the enquiry. Please email instead.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
