# Onyx // Engineering Network

An AI Engineering Mission Control portfolio: the homepage is an interactive map of a
distributed system, and each node is a real route into an engineering area.

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Framer Motion

---

## Running it

```bash
npm install
cp .env.example .env.local   # optional — everything works without it
npm run dev                  # http://localhost:3000
```

```bash
npm run build && npm start   # production
npm run typecheck            # tsc --noEmit
```

Nothing in `.env` is required. With no configuration the AI assistant answers from a local
knowledge base and the enquiry form validates and logs server-side.

---

## Replace the placeholder content

Everything on the site comes from `src/data/`. No copy lives in components, so making the
site yours means editing one folder. Placeholders are deliberately visible — they render a
yellow `PLACEHOLDER` chip on the page, so none of it can ship by accident.

| Edit this | For |
|---|---|
| `src/data/profile.ts` | **Start here.** Name, role, tagline, availability, email, GitHub, LinkedIn, résumé |
| `src/data/projects.ts` | The five case studies: set `placeholder: false` once each is real |
| `src/data/experience.ts` | Timeline (generic descriptors now — no employers were invented), capability matrix, principles |
| `src/data/services.ts` | 12 services, the small-tasks band, engagement models, FAQ |
| `src/data/domains.ts` | The six network domains, their capabilities and sub-architectures |
| `src/data/assistant.ts` | What the AI assistant knows |
| `src/data/site.ts` | Site name, navigation, footer |
| `src/data/feed.ts` | Vocabulary of the live system feed |

**What was deliberately not invented:** no employers, clients, user counts, revenue figures,
or performance metrics. Every case-study metric is `—` and flagged as a placeholder. The
engineering content describes systems of the kind in your stack and is safe to keep as a
starting point, but the outcomes and numbers are yours to fill in.

### Checklist before going live

- [ ] `src/data/profile.ts` — real email and links, `contact.placeholder: false`
- [ ] `src/data/projects.ts` — real case studies, `placeholder: false`, real `metrics`
- [ ] `src/data/experience.ts` — real roles, `placeholder: false`
- [ ] Screenshots in `/public`, referenced from each project's `caseStudy.media`
- [ ] `NEXT_PUBLIC_SITE_URL` set (canonical URLs, sitemap, OG images depend on it)
- [ ] `INQUIRY_WEBHOOK_URL` set — **otherwise enquiries are only logged and are lost**
- [ ] Replace `public/icon.svg` if you want a different mark

---

## Routes

| Route | Rendering | Notes |
|---|---|---|
| `/` | Static | Hero, interactive topology, live feed, featured case studies |
| `/system/[domain]` | Static ×6 | Where a topology node click lands |
| `/projects` | Static | Domain-filtered index |
| `/projects/[slug]` | Static ×5 | 12-section case study + traceable architecture diagram |
| `/services` | Static | 12 services + the small-tasks band |
| `/experience` | Static | Timeline + capability matrix |
| `/about` | Static | How I work, principles |
| `/start-project` | Static | Three-step enquiry |
| `/api/inquiry` | Dynamic | Validates, rate-limits, forwards |
| `/api/assistant` | Dynamic | Mock, Claude, OpenAI or your own RAG service |
| `/sitemap.xml`, `/robots.txt`, `/opengraph-image` | Static | Generated from the data files |

28 routes, all but the two API handlers prerendered.

---

## How the topology works

Four decoupled layers, in `src/components/system/`:

1. **Data** — `src/data/domains.ts` holds nodes (polar position, parallax depth) and links
   (kind, weight, curvature). No coordinates live in components.
2. **Layout** — `topologyLayout.ts` is pure and deterministic, so the same geometry is
   produced on the server and the client. Two projections: `radial` (desktop, 1000×620) and
   `spine` (mobile, 360×940 — a vertical trunk, not a shrunken radial).
3. **Render** — one SVG. Every node is a real `<a href>`, so the diagram is in the initial
   HTML, works with JavaScript disabled, and is navigable by keyboard.
4. **Animate** — `PacketLayer.tsx` animates packets with CSS `offset-path` /
   `offset-distance`, which the compositor handles; **no JavaScript runs per frame.**

Both projections are rendered and toggled with CSS breakpoints rather than a JS media
query — that avoids a hydration mismatch and any layout shift, and a `display: none`
subtree runs no animations, so the hidden one is free.

`useEventBus.ts` is a single seeded timer that drives both the node pulses and the live
feed, so a row in the feed corresponds to the link that just flashed. It runs only while
the section is on screen **and** the tab is visible (`useActiveWhenVisible.ts`).

Pointer parallax (`useStage.ts`) writes two CSS custom properties inside one
`requestAnimationFrame` and never re-renders React — nodes read them in `calc()`.

---

## Design system

See the `@theme` block at the top of `src/app/globals.css`.

**One accent — signal green `#3DD68C`.** Everything else is grayscale. The accent is
earned, not decorative: status dots, the active node, packet trails, the primary CTA, the
`✓` in the feed.

> **Accent budget:** no more than ~5 accent elements visible in a single viewport. This is
> the single rule that keeps the site reading as engineering software rather than as a
> cyberpunk theme. It is not enforced by code — enforce it in review.

Four motion primitives and nothing else: **packet** (composited CSS), **pulse**,
**reveal**, **trace**. All of it stops under `prefers-reduced-motion`, which falls back to
a static end state — links drawn, nodes lit, feed as a plain list. No information is ever
animation-dependent.

---

## The AI assistant

`ASSISTANT_PROVIDER` in `.env.local` selects the backend:

- **`mock`** (default) — keyword-matched retrieval over `src/data/assistant.ts`. No key, no
  network, works out of the box.
- **`anthropic`** — Claude via the official `@anthropic-ai/sdk`. Set `ANTHROPIC_API_KEY`.
- **`openai`** — Chat Completions. Set `OPENAI_API_KEY`.
- **`ASSISTANT_RAG_ENDPOINT`** — your own retrieval service; takes precedence over the
  above. Receives `{ question }`, should return `{ answer, sources }`.

Every path falls back to the local knowledge base on failure, so a visitor never sees an
error. Model context is assembled from the same `src/data/*` files the pages render, so the
assistant cannot contradict the site — and that is the corpus to embed when you build a
real RAG index.

If you intend to stay on the mock provider, `npm uninstall @anthropic-ai/sdk` — it is only
imported dynamically inside the route handler and nothing else depends on it.

---

## Performance notes

- First-load JS: ~179 KB gzipped on static pages, of which ~154 KB is the Next 16 + React 19
  framework floor. App code is ~25 KB.
- Framer Motion is **not** in the global bundle. Scroll reveals use one
  IntersectionObserver plus a CSS transition (`primitives/Reveal.tsx`); Framer Motion loads
  only on project pages, for the request-trace animation. That is worth ~45 KB gzipped on
  every other route.
- The assistant panel is `next/dynamic` with `ssr: false` — its code loads when a visitor
  opens it, not before.
- All architecture previews on cards are pure server-rendered SVG: a card grid costs no
  client JavaScript.
- Fonts are self-hosted via the `geist` package — no build-time or runtime font fetch, and
  `size-adjust` metrics prevent layout shift.
- The topology SVG sits in a fixed `aspect-ratio` box, so it cannot shift layout as it loads.

### Accessibility

Keyboard-navigable topology (real anchors with visible focus), skip link, semantic
headings, labelled form fields with associated errors, `aria-live` on the assistant log,
44px+ touch targets in the mobile projection, and reduced-motion support throughout.

---

## Structure

```
src/
├─ app/                    routes, API handlers, sitemap/robots/OG
├─ components/
│  ├─ primitives/          Panel, MonoLabel, StatusDot, Chip, Button, Reveal, …
│  ├─ system/              the visualization engine (layout, packets, feed, diagrams)
│  ├─ sections/            page sections (Hero, ProjectCard, CTABand, AssistantPanel, …)
│  ├─ forms/               enquiry form and accessible field wrappers
│  └─ layout/              Nav, Footer, AssistantLauncher
├─ data/                   ← ALL CONTENT LIVES HERE
├─ lib/                    types, geometry, seo, validation, seeded RNG
└─ hooks/                  reduced motion, visibility gating
```

`src/lib/types.ts` is the single type system; `src/lib/geometry.ts` and
`src/components/system/*Layout.ts` are pure functions with no React or DOM dependency.
