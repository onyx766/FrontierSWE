import { NextResponse } from 'next/server';
import { answerFromKnowledge, knowledgeBase } from '@/data/assistant';
import { profile } from '@/data/profile';
import { projects } from '@/data/projects';
import { services, smallTasks } from '@/data/services';
import type { AssistantAnswer, AssistantSource } from '@/lib/types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASK RYAN'S AI  —  BACKEND
 * ─────────────────────────────────────────────────────────────────────────────
 * Three modes, selected by ASSISTANT_PROVIDER:
 *
 *   mock (default)  Keyword-matched knowledge base in src/data/assistant.ts.
 *                   Works with no configuration and no API key.
 *   anthropic       Claude, via the official @anthropic-ai/sdk.
 *   openai          OpenAI Chat Completions.
 *
 * Or set ASSISTANT_RAG_ENDPOINT to delegate to your own retrieval service;
 * that takes precedence over the provider setting.
 *
 * Every path falls back to the local knowledge base on failure, so the feature
 * degrades to "useful" rather than "broken" in front of a visitor.
 *
 * The context passed to a model is assembled from the same `src/data/*` files
 * the site renders, so the assistant cannot contradict the pages — and when you
 * build a real RAG index later, that is the corpus to embed.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QUESTION_LENGTH = 500;

/* ──────────────────────────── Rate limiting ──────────────────────────────── */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

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

/* ──────────────────────────────── Context ────────────────────────────────── */

/** The site's own content, flattened into a compact grounding document. */
function buildContext(): string {
  const lines: string[] = [
    `PROFILE: ${profile.name} — ${profile.role}. ${profile.tagline}`,
    `EXPERIENCE: ${profile.yearsExperience} years.`,
    `AVAILABILITY: ${profile.availability.label}. ${profile.availability.detail}`,
    '',
    'CANONICAL ANSWERS:',
    ...knowledgeBase.map((entry) => `- [${entry.id}] ${entry.answer}`),
    '',
    'SERVICES:',
    ...services.map(
      (service) => `- ${service.title} (${service.typicalScope}): ${service.summary}`,
    ),
    '',
    'SMALL TASKS:',
    ...smallTasks.map((task) => `- ${task.title} (${task.turnaround}): ${task.description}`),
    '',
    'PROJECTS:',
    ...projects.map(
      (project) =>
        `- ${project.name} [/projects/${project.slug}] — ${project.summary} Role: ${project.role}. Stack: ${project.technologies.join(', ')}.${
          project.placeholder ? ' NOTE: this case study is placeholder content.' : ''
        }`,
    ),
  ];

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You answer questions about ${profile.name}, a ${profile.role}, for visitors to his portfolio — most of them founders or hiring managers deciding whether to get in touch.

Rules:
- Answer only from the CONTEXT below. If the context does not cover it, say so plainly and suggest the start-project form.
- Never invent employers, clients, user numbers, revenue, or metrics. Several case studies are explicitly placeholder content — if asked for specifics they do not contain, say they are placeholders.
- Be concrete and technical. Two to four sentences. No bullet lists, no headings, no marketing language.
- Where it is genuinely relevant, mention that small one-off tasks are welcome.
- Write in the third person about ${profile.name}. Never claim to be him.`;

/* ─────────────────────────────── Providers ───────────────────────────────── */

/** Pick useful links for an answer by reusing the keyword matcher. */
function sourcesFor(question: string): AssistantSource[] {
  return answerFromKnowledge(question).sources;
}

async function answerWithRagEndpoint(question: string): Promise<AssistantAnswer> {
  const endpoint = process.env.ASSISTANT_RAG_ENDPOINT!;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.ASSISTANT_RAG_TOKEN
        ? { Authorization: `Bearer ${process.env.ASSISTANT_RAG_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`RAG endpoint responded ${response.status}`);

  const data = (await response.json()) as { answer?: string; sources?: AssistantSource[] };
  if (!data.answer) throw new Error('RAG endpoint returned no answer');

  return {
    answer: data.answer,
    sources: data.sources ?? sourcesFor(question),
    mock: false,
  };
}

async function answerWithClaude(question: string): Promise<AssistantAnswer> {
  // Imported dynamically so the SDK is never loaded for visitors using the
  // mock provider, and so a missing key fails here rather than at module load.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
    // Deliberately small: the system prompt asks for two to four sentences, and
    // a chat bubble in the corner of a portfolio should not produce an essay.
    max_tokens: 1024,
    // A short grounded answer over a tiny corpus is not a reasoning-heavy task.
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `CONTEXT\n${buildContext()}\n\nQUESTION\n${question}`,
      },
    ],
  });

  // A safety decline is very unlikely for this content, but check before
  // reading the body. The local knowledge base is a better fallback here than
  // a server-side model fallback would be: it is instant and always on-topic.
  if (response.stop_reason === 'refusal') {
    return answerFromKnowledge(question);
  }

  const text = response.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Claude returned no text content');

  return { answer: text, sources: sourcesFor(question), mock: false };
}

async function answerWithOpenAI(question: string): Promise<AssistantAnswer> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `CONTEXT\n${buildContext()}\n\nQUESTION\n${question}` },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned no content');

  return { answer: text, sources: sourcesFor(question), mock: false };
}

/* ───────────────────────────────── Route ─────────────────────────────────── */

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      {
        answer: 'That is a lot of questions at once — give it a moment and try again.',
        sources: [],
        mock: true,
      } satisfies AssistantAnswer,
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const question =
    typeof body === 'object' && body !== null && 'question' in body
      ? String((body as { question: unknown }).question ?? '')
      : '';

  const trimmed = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (trimmed.length < 2) {
    return NextResponse.json({ message: 'Ask a question.' }, { status: 400 });
  }

  const provider = (process.env.ASSISTANT_PROVIDER ?? 'mock').toLowerCase();
  const hasRag = Boolean(process.env.ASSISTANT_RAG_ENDPOINT);

  try {
    if (hasRag) {
      return NextResponse.json(await answerWithRagEndpoint(trimmed));
    }
    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(await answerWithClaude(trimmed));
    }
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return NextResponse.json(await answerWithOpenAI(trimmed));
    }
  } catch (error) {
    // Log for the operator, then degrade to the local knowledge base rather
    // than showing the visitor an error.
    console.error('[assistant] provider failed, falling back to knowledge base', error);
  }

  return NextResponse.json(answerFromKnowledge(trimmed));
}
