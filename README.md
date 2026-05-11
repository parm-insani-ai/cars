# Frontdesk

Voice AI phone receptionist for small businesses. Answers calls, books appointments, handles follow-ups. Built for three verticals: **dealerships, service shops, and wellness** (med spas, salons, dental, chiro, fitness).

Working name. Rename to taste.

## How it works

```
[Phone caller] ──→ Twilio number (held by Vapi)
                    │
                    ▼
              [Vapi voice runtime]
              · STT (Deepgram)
              · TTS (ElevenLabs / others)
              · Turn-taking, voicemail detection, recording
                    │  POST /api/voice/llm  (OpenAI-compatible chat)
                    ▼
              [Our Next.js app]
              · Anthropic Claude as the brain
              · Per-business system prompt (cached)
              · Tool calls against our Prisma database
                    │
                    ▼
              [Postgres]  ←→  [Inngest]  (follow-up scheduler)
```

**What Vapi does:** all of the audio pipeline — speech recognition, turn-taking, interruption handling, text-to-speech, voicemail detection, recording, the actual phone connection.

**What we do:** the brain. Claude Sonnet 4.6 powers a per-business assistant. We give it a stable system prompt (greeting, personality, hours, services, providers, knowledge base, vertical rules) and a tool kit it must use to check the calendar, look up customers, and actually book appointments. Every drafted action is anchored to real database rows — the agent cannot invent a service, a price, or an open slot.

**What we own:**
- The conversation logic (one Anthropic call per turn, with prompt caching on the per-business prefix)
- The toolset and tool execution (real Prisma writes for bookings, reschedules, cancellations, messages)
- The admin app (call review, transcript playback, appointment management, knowledge base editing)
- The follow-up engine (pre-appointment reminders, no-show recovery, missed-call callbacks)
- The vertical packs that pre-configure agents for dealership / service shop / wellness businesses

## What's in the repo

### Voice layer
- `src/ai/run.ts` — one turn of the agent. Loads per-business config + knowledge + services + providers, builds the cached system prompt, calls Claude with tools, logs everything.
- `src/ai/system-prompt.ts` — per-business system prompt builder with vertical rules.
- `src/ai/tools.ts` — tool schemas + execution: `list_services`, `check_availability`, `lookup_customer`, `book_appointment`, `find_upcoming_appointments`, `reschedule_appointment`, `cancel_appointment`, `take_message`, `transfer_to_human`, `end_call`, plus `lookup_vehicle` for dealership pack.
- `src/ai/openai-translate.ts` — Anthropic ↔ OpenAI translation so Vapi can call our LLM endpoint.
- `src/integrations/vapi.ts` — Vapi API client, webhook signature verification, outbound-call dispatch.

### Endpoints
- `POST /api/voice/llm` — Vapi calls this for every turn. We return an OpenAI-shaped response Vapi pipes into TTS.
- `POST /api/voice/webhook` — Vapi lifecycle webhook (assistant-request, tool-calls, status-update, end-of-call-report). Verifies HMAC signature when `VAPI_WEBHOOK_SECRET` is set.
- `POST /api/voice/simulate` — text-mode call simulator for the `/demo` page. Drives the same brain + tools without telephony.
- `POST /api/inngest` — durable workflow endpoint.

### Workflows (Inngest)
- `post-call-followup` — after every call, schedule the right follow-up based on outcome (pre-appointment reminder if booked, no-show recovery if applicable, post-call SMS if no booking).
- `followup-dispatcher` — every minute, scan due FollowUp rows and dispatch via SMS adapter (Twilio in production, mock in dev).
- `no-show-detection` — every 15 minutes, flag missed appointments and queue recovery follow-ups.

### Domain
- `src/domain/booking.ts` — slot finder (intersects business hours + provider shifts, removes appointment conflicts), customer upsert, appointment create with double-book protection. Unit-tested.
- `src/packs/*` — three vertical packs (dealership, service-shop, wellness): default agent personality, service catalog, providers + shifts, knowledge base.

### Admin UI
- `/calls` — list of every call with outcome filter
- `/calls/[id]` — transcript, tool calls (input/output), recording playback, AI summary, outcome
- `/appointments` — today / 7-day with status transitions (confirm, arrived, no-show, completed)
- `/customers` — search + detail with consent toggles, prior appointments and calls
- `/services` — full CRUD for what the agent can book
- `/providers` — list of staff/resources and their shifts
- `/hours` — set business hours per day of week
- `/knowledge` — knowledge base editor — the agent reads these to answer FAQs
- `/agent` — voice agent config: greeting, personality, voice provider/id, allowed actions (book/reschedule/cancel/transfer), transfer number, SMS footer
- `/follow-ups` — scheduled/sent/failed/skipped outbound follow-ups
- `/reports` — calls by outcome, booking rate, no-show rate, follow-up status, platform cost
- `/demo` — text-mode conversation with your own agent

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
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass   # if blocked
.\scripts\setup.ps1
# add ANTHROPIC_API_KEY to .env.local
npm run dev
```

Or without Docker, point `DATABASE_URL` at any Postgres and run:
```bash
npx prisma generate && npx prisma db push && npm run db:seed && npm run dev
```

Open `http://localhost:3000`. The login picker lists one user per seeded business:
- **Demo Motors** (dealership)
- **Eastside Auto Care** (service shop)
- **Cedar Wellness Studio** (wellness)

Each business is fully configured (agent greeting, personality, services, providers, shifts, hours, knowledge base) so you can:
1. Open `/demo` and have a text conversation with the agent
2. Open `/calls/[id]` afterwards to see the transcript, tool calls, AI summary
3. Open `/appointments` to see anything the agent booked

## Wiring Vapi for real calls

```bash
# .env.local
VAPI_API_KEY=...
VAPI_WEBHOOK_SECRET=...
PUBLIC_BASE_URL=https://your-app.example.com
```

On each business, set `phoneNumber` to a Vapi-purchased number. Vapi sends every incoming call to `POST /api/voice/webhook`; we return an assistant config that points back at `POST /api/voice/llm` with the right metadata. The LLM streams responses; tool calls are dispatched on the same webhook, executed against our DB, and returned to Vapi inline.

Without `VAPI_API_KEY`, voice runs in mock mode — outbound voice follow-ups are skipped with a clear status; the simulator still works end-to-end through the same code path.

## Test, typecheck, build

```bash
npm test            # unit tests (booking slot finder)
npm run typecheck   # tsc --noEmit
npm run build       # Next.js production build
```

## Known gaps before a paying customer

- WorkOS SSO — surface is ready; only the dev cookie picker exists.
- Real Vapi assistant provisioning UI — currently you set `phoneNumber` and `vapiAssistantId` directly on the Business row.
- Google Calendar / Cal.com adapter — interface is in `src/integrations/calendar.ts`, only mock is wired.
- Outbound voice callback workflow — placeholder; needs Vapi outbound number + assistant id mapping per business.
- Recording playback inside the call detail view shows a native `<audio>` element when a URL is set; we don't yet pull recordings into our own storage.
- Postgres row-level security — every row has `businessId`; policies aren't applied yet.
- Webhook IP allowlisting (in addition to signature verification).
- Eval scoring on `AiEval` rows — Braintrust hookup is the recommended next step.
