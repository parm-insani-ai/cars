# Onboarding a business to the AI receptionist

How to take a customer business from "signed up" to "answering real phone calls" with the Frontdesk AI receptionist. ~30 minutes of work per business, mostly clicking.

## What you'll set up

```
                 (caller dials)
                       │
                       ▼
              Twilio phone number
                       │
                       ▼
                Vapi (telephony)
                       │
                       │  assistant-request (per call)
                       ▼
   POST https://insani.ai/api/voice/webhook
                       │
                       │  returns the assistant config
                       │  (greeting, voice, tools, LLM URL)
                       ▼
            Vapi runs the call
                       │
                       │  POST https://insani.ai/api/voice/llm/chat/completions
                       ▼
              Your brain (Claude)
                       │
                       │  reads/writes via tool calls
                       ▼
                Your Postgres
```

The receptionist is **fully dynamic** — there's no per-business Vapi assistant to provision. When a call comes in, Vapi pings the webhook with the dialed number, the app looks up the business by that number, and returns a custom-tailored assistant config (greeting, voice, personality, tools). One Vapi number per business is all you need.

## Steps

### 1. Create the Business in the admin app (5 min)

Log in to the admin app as **Operator (GTM admin)**. (For now this is done via DB seed — the multi-business signup flow comes later.)

For each new customer:

- Add the **Business** row with `vertical`, `timezone` (e.g. `America/Halifax`), `name`.
- Add an **AgentConfig**: greeting, personality, voice provider/voiceId, allowed actions (`canBook`, `canReschedule`, `canCancel`, `canTransfer`), and a `transferTo` number if calls should ever ring through to a human.
- Add **BusinessHours** for every open day.
- Add **Services** (name, duration, price, description).
- Add **Providers** with their **ProviderShifts**.
- Add **KnowledgeArticles** for FAQs the receptionist should know — pricing details, parking, prep instructions, anything that comes up on calls.

The admin UI for all of this is at `/services`, `/providers`, `/hours`, `/knowledge`, `/agent`. Have the business owner walk through it with you.

### 2. Buy a Twilio number (5 min)

Twilio console → **Phone Numbers → Buy a number** → Country: Canada, Voice capability, search the area code closest to the business. Buy. Note the number in E.164 (`+1902…`).

> First time: completing Twilio's regulatory bundle for Canadian local numbers takes 1–5 days. Plan ahead — for a business in production, register the **Business Profile** in Twilio's Trust Hub so caller ID propagates and calls don't get spam-filtered. Without it, callbacks may not ring through.

### 3. Import the number into Vapi (3 min)

Vapi dashboard → **Phone Numbers → Import → Twilio**:
- Twilio Account SID (`AC…`)
- Twilio Auth Token
- The phone number (`+1902…`)

Vapi gives the imported number a **Phone Number ID** (UUID). Note it.

### 4. Tell Vapi where to send calls (2 min)

Click the imported number in Vapi → **Server URL** field → set to:
```
https://insani.ai/api/voice/webhook
```
Save. Now every incoming call to this Twilio number triggers a webhook POST to your app's receptionist webhook.

> Do NOT also set an Assistant on the Vapi number. We use the dynamic `assistant-request` flow — Vapi calls our webhook, we return the assistant config in the response.

### 5. Link the number to the business (1 min)

In your admin DB:
```sql
UPDATE "Business" SET "phoneNumber" = '+19025551234' WHERE id = '<businessId>';
```
Or via Prisma Studio: `npx prisma studio` → Business → set `phoneNumber`. This is the key the webhook uses to look up which business config to use.

### 6. Smoke test (5 min)

Open **/calls** in the admin app. Then call the new Twilio number from your phone.

You should hear the configured greeting in the configured voice. The call appears in `/calls` in real-time. Try:
- Asking what services they offer → she should call `list_services` and read them.
- Booking an appointment → she should call `check_availability`, propose times, confirm, call `book_appointment`. The appointment shows up in `/appointments`.
- Asking something from the knowledge base → she should answer from it.
- Asking for a human → she should `transfer_to_human` if `canTransfer` is on, otherwise `take_message`.

After the call ends, the **AI summary** and **outcome classification** appear on `/calls/[id]` within ~10 seconds, with the full transcript and recording.

### 7. Hand over to the business

What the business owner can do without your help:
- `/appointments` — see and edit upcoming bookings, mark no-shows, etc.
- `/calls` — listen to recordings, read transcripts, see AI summaries.
- `/customers` — manage their book of customers.
- `/knowledge` — edit the FAQ Ava reads from (changes take effect on the next call — the system prompt is rebuilt per call).
- `/agent` — adjust greeting, personality, allowed actions.
- `/hours`, `/services`, `/providers` — keep their data current.

## What makes Ava a great receptionist

The system prompt (in `src/ai/system-prompt.ts`) is tuned around three caller experiences:

1. **HEARD** — caller feels understood. Ava asks one thing at a time, uses returning-customer names, mirrors what they said.
2. **HELPED** — Ava actually does the thing (books, reschedules, transfers, takes a message) or honestly explains what happens next.
3. **CONFIDENT** — caller trusts the business more after the call than before.

Anti-patterns the prompt explicitly forbids:
- Inventing prices, times, services, or policies.
- Proposing a time without first calling `check_availability`.
- Booking without reading the time and phone back to the caller.
- Pretending to be a human when asked.
- Apologizing repeatedly instead of acting.

The brevity rule ("one or two short sentences per turn") keeps calls feeling natural and not robotic.

## Ongoing per-business tuning

- **Greeting** in `AgentConfig.greeting` — the very first thing every caller hears. Worth iterating on with the business owner.
- **Personality** in `AgentConfig.personality` — gets woven into the system prompt. "Warm and chatty" reads differently than "professional and direct."
- **Knowledge base** at `/knowledge` — the most underused lever. The richer this is (parking, payment options, holiday hours, prep, common questions), the fewer messages Ava has to take.
- **Vertical pack** (in `src/packs/`) — the per-vertical rules (e.g. dealership-specific guidance for test drives). Edit there to apply to all businesses in that vertical.

## Failure modes worth knowing about

- **No phone number on Business.phoneNumber** → the webhook returns `no_business_for_number` and the caller hears Vapi's default error. Always set this after importing.
- **No AgentConfig** → `no_agent_config` error. Seed one before going live.
- **Caller ID flagged as spam** → unverified Twilio numbers get filtered by Canadian carriers. Register Trust Hub before relying on the line.
- **PUBLIC_BASE_URL stale** → if the app's base URL changes (e.g. you switch domains), the assistant-request still returns the old URL for `model.url`. Update env, redeploy.
- **VAPI_WEBHOOK_SECRET mismatch** → if set in env but not on the Vapi number's server URL config, all webhook requests get 401. Either set both or clear both.

## After go-live

- **Review the first 20 calls personally.** Listen to recordings, read transcripts, note anywhere Ava sounded canned or fumbled. Iterate the greeting + personality + knowledge base.
- **Watch the `/reports` page** for outcome distribution. A high `no_action` rate usually means knowledge gaps or unclear scope.
- **Set up the follow-up dispatcher** (Inngest cron — already built) so reminder texts and no-show recovery actually fire.
