# Revline

AI appointment and opportunity engine for car dealerships. Prevents sellable opportunities from leaking out of a dealership; measured in incremental sold cars.

See `docs/01-prd-mvp.md` for product scope, `docs/02-tech-stack.md` for architecture.

## What's in here

End-to-end web application:

- **Auth** — cookie-based dev session with rep/manager picker (`/login`). WorkOS-ready surface (`requireUser`, `requireRole`).
- **Sidebar nav + topbar** — every page lives behind auth.
- **Rep work surface** — feed, lead detail with AI draft composer + appointment booker, missed-call cards, service-drive cards.
- **Data** — `/leads` (search + status filter), `/customers` with consent toggles + history, `/inventory` grid with body type / condition filters, `/appointments` (today / 7-day) with status transitions.
- **Manager / ops** — `/manager` live leakage monitor with one-click reassignment, `/reports` (funnel, SLA, attribution, source mix, rep scoreboard), `/onboarding` checklist, `/settings` integration status, `/demo` simulator that fires synthetic webhooks.
- **AI** — Anthropic SDK, Sonnet 4.6 for drafting, Haiku 4.5 for classification, manual agentic loop with tool use anchored to real Prisma rows, prompt caching on the per-dealer voice prefix, every run writes an `AiEval`.
- **Workflows (Inngest)** — lead cadence, missed-call recovery (15-min SLA + 10-min escalation), service-drive opportunity, daily reactivation cron, hourly appointment confirmation cron, 6pm manager digest.
- **Webhooks** — leads (ADF XML or JSON), phone (call events with optional transcript → Haiku summarization), service ROs, inbound SMS (intent classification → status transitions + opt-out enforcement).
- **Adapters** — `CrmAdapter` / `PhoneAdapter` / `InventoryAdapter` / `SmsAdapter` / `EmailAdapter` interfaces, with Twilio + SendGrid wrappers and mock fallbacks.
- **Tests** — vitest unit tests for scoring + equity logic.

Production build passes (`npm run build`). 7/7 unit tests pass.

## Run it locally

Prereqs: Node 20+, Docker (for Postgres), an Anthropic API key.

**macOS / Linux / WSL / Git Bash:**
```bash
./scripts/setup.sh
# add ANTHROPIC_API_KEY to .env.local
npm run dev
```

**Windows PowerShell:**
```powershell
# If your execution policy blocks scripts, run once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup.ps1
# add ANTHROPIC_API_KEY to .env.local
npm run dev
```

If you don't have Docker, set `DATABASE_URL` in `.env.local` to any Postgres
(Neon, Supabase, local) and run the manual flow:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

(optional) Inngest dev — runs the durable workflows:

```bash
npx inngest-cli@latest dev
```

Open `http://localhost:3000`. The login screen lists the seeded users — pick a sales rep to land on the rep feed, or the sales manager for the dashboard.

### Seed contents (`Demo Motors`)

- One sales manager, three reps
- Seven inventory units (mixed new/used, sedan/suv/truck/EV)
- Three leads in different states (fresh CarGurus, 90-min-old website, 5-day-old reactivation candidate)
- One missed sales call with a drafted callback SMS
- One service-drive customer with $13.5K positive equity → ranked opportunity + matched RAV4
- One sold appointment for KPI texture

### Demo simulator

`/demo` has four cards that POST against the real webhook endpoints:

- New CarGurus lead (with optional vehicle of interest)
- Missed sales call
- Service RO opened (with payoff + value figures that produce a real opportunity)
- Inbound SMS reply (classifies intent and updates the lead status)

Use it to walk a dealer through the live system without waiting for real events.

## Structure

```
src/
  middleware.ts          Auth gate for every non-public route
  lib/
    prisma.ts            Prisma singleton
    auth.ts              getCurrentUser / requireUser / requireRole
    env.ts               env var helpers
  app/
    layout.tsx           Sidebar + topbar shell
    login/               Login picker (dev SSO)
    page.tsx             Redirect → rep feed or manager based on role
    rep/                 Action feed, lead detail
    leads/               Searchable leads list
    customers/           Searchable customers + consent
    inventory/           In-stock grid with filters
    appointments/        Today / 7-day with status transitions
    service/             Service-drive opportunities
    manager/             Live leakage monitor + reassignment
    reports/             KPI dashboard (funnel, SLA, attribution, sources, rep scoreboard)
    onboarding/          Setup checklist
    demo/                Webhook-firing simulator
    settings/            Integration status + AI voice
    api/
      auth/              login / logout
      webhooks/          leads | phone | service | sms | inngest
      actions/           send-message | book-appointment | task | appointment-status
                          customer-consent | reassign-task
  ai/
    client.ts            Model selection (Sonnet 4.6 draft, Haiku 4.5 classify)
    system-prompt.ts     Stable per-dealer cached prefix
    tools.ts             get_inventory_matches | get_customer_history | get_rep_availability
    run.ts               Manual agentic loop with prompt caching + AiEval logging
    drafts.ts            First response | follow-up | missed-call | service-to-sales
    classify.ts          Call summarization | reply intent
  domain/
    leads.ts             Ingest + assignment
    scoring.ts           Lead hotness, equity readiness, expected gross
    scoring.test.ts      Vitest unit tests
    opportunities.ts     Service-to-sales pipeline
    feed.ts              Rep + manager feed ranking
  inngest/
    client.ts            Event taxonomy
    functions/
      lead-cadence.ts            Instant response + nudges (1h/24h/3d)
      missed-call-recovery.ts    Draft + 15-min SLA + 10-min escalation
      service-opp.ts             Score + match + draft pitch
      reactivation.ts            Daily cron — dead leads 30-90d ago
      appointment-confirmation.ts Hourly cron — day-before reminders
      daily-digest.ts            6pm rooftop-local manager digest
  integrations/
    adapters.ts          Adapter interfaces
    twilio.ts | sendgrid.ts | mock.ts
    adf.ts               ADF/XML lead parser
  components/
    Sidebar.tsx | Topbar.tsx | FeedCard.tsx
    SendComposer.tsx | AppointmentBooker.tsx | ReassignButton.tsx

prisma/
  schema.prisma          Multi-tenant data model
  seed.ts                Demo Motors

docker-compose.yml       Postgres for dev
scripts/setup.sh         One-shot setup
```

## Flows (how the wiring fires)

### New lead → appointment
1. `POST /api/webhooks/leads` (ADF email or provider JSON)
2. `ingestLead` — dedupe customer (phone, then email), assign rep round-robin by lowest open-task load, score hotness
3. Inngest `lead/created` → `lead-cadence` workflow → first-response draft (Sonnet 4.6 + tool use)
4. Recommendation written to a task with 5-min SLA on the rep's feed
5. Rep reviews on `/rep/lead/[id]`, hits "Approve & send" → `POST /api/actions/send-message` → TCPA check → Twilio (or mock) → message + lead status updated
6. Customer replies → `POST /api/webhooks/sms` → Haiku classifies intent → if proposed time, opens "confirm appointment" task; if opt-out, revokes consent + marks lead lost
7. Rep books on the lead detail page → appointment + customer tagged `revline_influenced`
8. Inngest hourly cron sends day-before confirmation tasks

### Missed sales call
1. Phone provider `POST /api/webhooks/phone`
2. Call logged; transcript (if any) summarized via Haiku
3. If `outcome=missed, direction=inbound, department=sales` → Inngest `call/missed`
4. Workflow drafts callback SMS (Sonnet 4.6) → 15-min SLA task + recommendation
5. After 10 min still open → task escalated + manager alert

### Service drive
1. DMS/CRM `POST /api/webhooks/service` (RO created)
2. `processServiceDrive` scores equity (ownership age, mileage, equity $, recent service spend)
3. If ≥ 0.35 with matching inventory → opportunity + 4-hour-expiring rep task
4. AI drafts in-person talk track + SMS follow-up (rep sees both side-by-side)

### Reactivation
- Daily cron at 7am (rooftop time): scan leads created 30-90 days ago in `lost` or `dead`, create reactivation tasks at low priority. Drafted lazily when the rep opens the card.

## AI layer notes

- **Prompt caching** — the per-dealer voice + SOP prefix is the cached portion (`cache_control: { type: "ephemeral" }` on the system block). Tools render before system, so one breakpoint caches tools + system together. Per-request facts go in the user message, after the breakpoint.
- **Tool use** — the model cannot invent inventory, prices, or customer facts. Every drafter forces a tool call against real Prisma rows: `get_inventory_matches` / `get_customer_history` / `get_rep_availability`.
- **Human in the loop** — every outbound message is rep-approved in MVP. Autopilot is opt-in (`ALLOW_AUTOPILOT_SEND`).
- **Evals** — every AI run writes an `AiEval` row with input, output, tool calls, latency. Wire Braintrust at this table.

## Known gaps before a real pilot

- **WorkOS SSO** — surface is ready (`requireUser` reads a cookie). Swap for WorkOS when it's procured.
- **Postgres RLS** — every row has `rooftopId`; the policies aren't applied yet.
- **Real CRM/phone connectors** — interfaces and mocks. Pick one CRM (VinSolutions) and one phone (CallRevu/Car Wars/Dialpad) for pilot #1.
- **Webhook signature verification** — endpoints are open. Add HMAC checks per provider.
- **Real rep calendars** — `get_rep_availability` returns deterministic next-business-day slots. Wire to CRM/calendar before pilot.
- **Inbound SMS provider verification** — Twilio inbound webhook signing.
- **Eval scoring** — `AiEval` rows are written but no scorer is wired (Braintrust is the recommendation).

These are sequenced in the build plan in `docs/02-tech-stack.md`.

## Test, typecheck, build

```bash
npm test            # 7 unit tests for scoring + equity
npm run typecheck   # tsc --noEmit
npm run build       # Next.js production build (passes)
```
