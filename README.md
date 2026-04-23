# Revline

AI appointment and opportunity engine for car dealerships. Prevents sellable opportunities from leaking out of a dealership; measured in incremental sold cars.

See `docs/01-prd-mvp.md` for the product scope and `docs/02-tech-stack.md` for the architecture.

## Structure

```
src/
  app/                 Next.js App Router (UI + API routes)
    api/
      webhooks/        Lead intake, phone events, service RO events
      actions/         Rep actions: send-message, book-appointment, task
      inngest/         Durable workflow endpoint
    rep/               Rep action feed + lead detail
    manager/           Manager leakage dashboard
    service/           Service-drive opportunity list + detail
    settings/          Integrations & AI voice config
  ai/                  Anthropic client, drafts, classification, tool use
    client.ts          Model selection (Sonnet 4.6 draft, Haiku 4.5 classify)
    system-prompt.ts   Stable per-dealer prefix (cached)
    tools.ts           get_inventory_matches, get_customer_history, get_rep_availability
    run.ts             Manual agentic loop with prompt caching + evals
    drafts.ts          Task-specific drafters
    classify.ts        Call summarization, reply intent
  domain/
    leads.ts           Lead ingest + assignment
    scoring.ts         Lead hotness, equity readiness, expected gross
    opportunities.ts   Service-to-sales pipeline
    feed.ts            Rep & manager feed ranking
  inngest/             Durable workflows
    functions/
      lead-cadence.ts          Instant response + nudges
      missed-call-recovery.ts  2-min draft, 15-min SLA, 10-min escalate
      service-opp.ts           Score + match + draft pitch
  integrations/
    adapters.ts        CrmAdapter / PhoneAdapter / InventoryAdapter / SmsAdapter / EmailAdapter
    twilio.ts, sendgrid.ts, mock.ts
    adf.ts             Minimal ADF/XML lead parser
prisma/
  schema.prisma        Full multi-tenant data model
  seed.ts              Demo rooftop with leads, calls, service ROs
```

## Running locally

Prereqs: Node 20+, Postgres 15+ (or use Neon/Supabase), an Anthropic API key.

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
# Fill in DATABASE_URL and ANTHROPIC_API_KEY at minimum.
# Twilio / SendGrid are optional — without them, send actions go through mock adapters.

# 3. Database
npx prisma generate
npx prisma db push
npm run db:seed

# 4. Dev server
npm run dev

# 5. (optional) Inngest dev — triggers workflows on webhook events
npx inngest-cli@latest dev
```

Open `http://localhost:3000`. The seed script creates:
- **Demo Motors** rooftop (LA timezone)
- One sales manager, three reps
- Seven inventory units
- Three leads in different states (fresh CarGurus, 90-min-old website, 5-day-old reactivation)
- One missed sales call with a drafted callback SMS
- One service-drive customer with $13.5K positive equity → ranked opportunity + matched vehicle

## The flows

### New lead
1. `POST /api/webhooks/leads` (ADF email or provider JSON)
2. `ingestLead` — dedupe customer, assign rep (round-robin), score hotness
3. Inngest `lead/created` fires → `leadCadence` function
4. Workflow drafts first-response SMS (Sonnet 4.6 + tool use) → rep feed card with SLA 5 min
5. Rep approves → `POST /api/actions/send-message` → Twilio + CRM writeback + task done

### Missed sales call
1. Phone provider `POST /api/webhooks/phone`
2. Call logged; if `outcome=missed, direction=inbound, department=sales` → Inngest `call/missed`
3. Workflow drafts callback SMS, creates task with 15-min SLA
4. After 10 min, if open → task escalated + manager alert

### Service drive
1. DMS/CRM `POST /api/webhooks/service` (RO created)
2. `processServiceDrive` scores equity (ownership age, mileage, equity position, recent service spend)
3. If ≥ 0.35 and matching inventory exists → opportunity + 4-hour-expiring rep task
4. AI drafts talk track + SMS follow-up (rep sees both)

## AI layer notes

- **Prompt caching** — the dealership system prompt (SOPs, voice, compliance) is the frozen prefix with `cache_control: ephemeral`. Tools render before system, so one marker caches tools + system together. Per-request customer facts go in the user message, after the breakpoint.
- **Tool use** — the model cannot invent inventory, prices, or customer facts. It must call `get_inventory_matches` / `get_customer_history` / `get_rep_availability`.
- **Human in the loop** — every outbound message is rep-approved in MVP. Autopilot is opt-in (`ALLOW_AUTOPILOT_SEND`) and gated per rep.
- **Evals** — every AI run writes an `AiEval` row (input, output, tool calls, latency). Point an offline scorer at this table in CI.

## What's faked vs real in the MVP

| Real                                                             | Faked / mocked                                                                 |
|------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Next.js app + routes                                             | Auth (no WorkOS wiring — userId passed in request bodies)                      |
| Prisma schema & ranking                                          | RLS (enable on Postgres; we set the tenant column on every row)                |
| Anthropic SDK w/ tool use + prompt caching                       | No Braintrust hookup yet (AiEval rows ready to feed it)                        |
| Inngest workflows (durable cadence, missed-call SLA, service opp)| Real CRM / phone / inventory / Twilio writes default to mock adapters          |
| ADF XML intake + JSON webhook                                    | Rep calendar — slot suggestions are deterministic next-business-day placeholders |

## Deploy

Next.js → Vercel. Postgres → Neon. Inngest → Inngest Cloud. WorkOS for SSO. See `docs/02-tech-stack.md` for the full topology and why each piece is the right pick.
