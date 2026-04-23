# MVP Tech Stack — Opinionated, One Path

Goal: ship a pilot-ready v1 in 8–12 weeks with 2–4 engineers, tuned for a product that is 70% event-driven workflows, 20% LLM, 10% UI.

## The stack (one-line summary)

**Next.js + TypeScript + Postgres (Neon) + Prisma + Inngest + Anthropic Claude + Twilio + WorkOS, deployed on Vercel + Neon + Upstash.**

---

## Frontend

- **Next.js 14 (App Router) + TypeScript** — one framework for the rep app, manager dashboard, and marketing site.
- **Tailwind + shadcn/ui** — dealership reps use this at arm's length on a shared PC; high-contrast, dense, keyboard-friendly UI is a must.
- **TanStack Query** for server state; server actions for mutations.
- **Pusher or Ably** (or Supabase Realtime if we already use Supabase) for live feed updates, missed-call pings, new-lead toasts. Start with Pusher Channels — simplest API, proven at scale.
- **PostHog** for product analytics + session replay (invaluable for debugging rep UX).

Why: the rep app is simple and form-heavy; Next.js + shadcn lets 1 engineer own UI.

## Backend / API

- **Next.js API routes + server actions** for the BFF (auth'd user traffic).
- **Separate Node service (Hono on Fly.io or Railway)** for long-running connectors (phone log pollers, CRM adapters) that shouldn't live in Vercel's serverless.
- **Inngest** for all durable workflows: lead cadences, missed-call recovery state machines, service-opp expirations, manager escalations, nightly equity rescoring. **This is the most important single choice in the stack.** The product is a state machine soup; Inngest is built exactly for this (steps, retries, sleeps, cancellation, replays).
- **Zod** everywhere for schema validation.

Why not: avoid a Python service at MVP — one language reduces context-switch cost for a small team.

## Data

- **Postgres on Neon** — serverless Postgres with branching (per-PR DBs). Multi-tenant via `rooftop_id` on every row and Postgres **row-level security**.
- **Prisma** ORM. Accept the perf trade-off for dev speed; optimize hot queries with raw SQL later.
- **pgvector** inside the same Postgres for embeddings (call transcript chunks, prior conversation memory, vehicle descriptions). No separate vector DB for MVP.
- **Upstash Redis** for queues, rate limits, dedupe keys (e.g., "don't re-draft the same lead twice"), and short-lived caches.
- **S3 (or Cloudflare R2)** for call recordings and email blobs.

## AI

- **Anthropic Claude** as the default model provider.
  - **Sonnet 4.6** for message drafting, call summarization, service-to-sales pitch generation.
  - **Haiku 4.5** for high-volume low-latency tasks: intent classification, objection tagging, lead scoring assist, dedupe.
- **Prompt caching** on the big static context (dealership voice guidelines, inventory schema, SOPs) — this is a meaningful cost lever given how chatty the product is per dealer.
- **Tool use** for every AI draft: the model *must* call `get_inventory_matches`, `get_customer_history`, `get_rep_calendar` — never invents vehicle, price, or inventory.
- **pgvector** for lightweight retrieval over past conversations and call transcripts.
- **Evals with Braintrust** from day one: seed with 50 labeled examples per task (draft, summarize, classify) and wire to CI so prompt changes can't silently regress.
- Fallback: if the LLM call fails or times out >3s, fall back to a templated response keyed on lead source/vehicle.

## Telephony & messaging

- **Twilio** for SMS (A2P 10DLC registered per dealership) and email-to-SMS receipts.
- **SendGrid** for transactional email (lead acks, manager digests, confirmations).
- **Phone integration (read-only) adapters** — one connector per phone system. Start with the two the first two pilots use. Realistic targets:
  - **CallRevu** (API + webhooks)
  - **Car Wars** (webhooks + nightly batch)
  - **Dialpad** (API)
  - **RingCentral** (API)
  Expose them behind a single internal interface: `getCallLog`, `getRecording`, `subscribeMissedCall`. Do NOT try to generalize beyond 3 connectors at MVP.

## Integrations

- **CRM:** start with **VinSolutions** (largest footprint, tractable API via Cox Automotive). DealerSocket v2. One adapter each, behind a `CrmAdapter` interface.
- **Inventory:** HomeNet feed (industry standard), fall back to dealer-provided nightly CSV/XML.
- **Website leads:** ADF/XML parsing from lead email inbox + webhook endpoint for providers (CarGurus, AutoTrader, Cars.com) that push directly.

Rule: every integration starts as "read-only ingest + event-level writeback." Do not try to become a two-way CRM replication layer.

## Auth, identity, multi-tenant

- **WorkOS** for SSO, SCIM, and organizations (dealer groups → rooftops → users). This is the B2B choice; dealer groups will ask for SSO immediately.
- Tenancy: `org_id` = dealer group, `rooftop_id` = store. Every row has `rooftop_id`. Postgres RLS enforced. Prisma middleware sets the tenant context on every request.
- Role model: `rep`, `bdc`, `sales_manager`, `gm`, `admin`.

## Observability & ops

- **Sentry** — errors, frontend + backend.
- **Axiom** — structured logs.
- **OpenTelemetry** → Axiom/Honeycomb for tracing AI calls and workflow steps.
- **PostHog** — product analytics + feature flags + session replay on rep app.
- **Statsig or PostHog feature flags** — one rollout toggle per new AI behavior, per-rooftop.

## Dev workflow

- **GitHub + GitHub Actions.** Neon branch per PR for a disposable DB.
- **Vercel preview deploys** per PR.
- **Linear** for tickets.
- **Turbo monorepo** with `apps/web`, `apps/worker`, `packages/db`, `packages/ai`, `packages/integrations`.

---

## Why this stack (and what we're explicitly NOT doing)

1. **Inngest over homegrown queues.** The product is mostly: event arrives → wait → act → wait → act → give up / succeed. Inngest's step/sleep/retry primitives cut weeks out of MVP.
2. **Postgres + pgvector over a separate vector DB.** One store = less ops. We aren't doing 100M-vector scale at MVP.
3. **TypeScript end-to-end.** One language. Small team. Speed > theoretical best-fit.
4. **Claude over mixed providers.** Quality on drafting is the single most visible AI surface; consolidate and tune there. Add a second provider only if a specific task demands it.
5. **Read-only phone integration first.** We do not sit in the call path. Any Twilio Voice use is limited to sending SMS, not reconfiguring dealership phones.
6. **WorkOS over Clerk.** Dealer groups = B2B SSO and SCIM required fast. WorkOS bakes that in.
7. **No Python service at MVP.** If a future ML workload needs it (e.g., a trained equity model), add a Python worker then.
8. **No microservices.** Two deployables: the Next.js app and the long-running worker. That's it.

## What to explicitly fake manually before building

- **Phone integration for pilot #1:** if the dealer has a phone system we don't have a connector for yet, have them daily-export call logs; a human or script ingests them. Validate the missed-call workflow before building the connector.
- **Equity calculation:** start with a spreadsheet of payoff + book value the BDC manager already maintains. Don't integrate payoff data until pilot #2.
- **Inventory matching:** a rules engine (segment + price band + fuel type) is plenty for v1. Don't train a recommender.
- **Rep autopilot:** don't build it in MVP. Every send is human-approved.

## What to postpone

- Voice AI / live call assistance.
- Website chatbot.
- Native mobile apps (PWA is fine).
- Custom dashboards per dealer group.
- F&I, desking, deal structuring.
- DMS (Reynolds/CDK) direct integration — go through CRM only.

---

## Minimal service topology

```
[ Next.js app on Vercel ]  <--->  [ Postgres (Neon) + pgvector ]
         |                                 ^
         |                                 |
         v                                 |
   [ Inngest functions ] --- reads/writes -+
         |
   +-----+----------------------------+
   |     |           |          |     |
   v     v           v          v     v
[Twilio][SendGrid][WorkOS][CRM adapters][Phone adapters]

[ Worker (Hono on Fly) ] — long-lived pollers, webhook receivers for
   integrations that don't play well with serverless cold starts.

[ Upstash Redis ] — dedupe, rate limits, short TTL caches.
[ Anthropic API ] — called from Inngest steps via a typed client with
   tool-use, prompt caching, and eval hooks.
```

## Cost envelope (rough, MVP)

- Infra: Vercel + Neon + Upstash + Inngest + WorkOS + Sentry + PostHog ≈ $500–$1,500/mo baseline.
- Anthropic: with prompt caching and Haiku for classification, expect $2–$8 per rooftop per day in a 15-rep store at pilot volume. Budget $300/rooftop/mo; reserve 3x for spikes.
- Twilio SMS: $0.01–$0.03 per message; budget $150/rooftop/mo.
- Per-rooftop marginal AI + comms cost should stay under 10% of ASP to keep gross margins healthy.
