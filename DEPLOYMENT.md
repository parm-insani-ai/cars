# Deploying Insani AI to production

Walk this top-to-bottom the first time. After that it's `git push` and Vercel handles redeploys.

The target architecture:

```
insani.ai (custom domain)
   │
   ▼
 Vercel  ──────────►  Neon (Postgres)
   │
   │  webhooks
   ▼
 Vapi  ◄── Twilio (Halifax 902 number)
   │
   ▼
 Anthropic (Claude)
```

You'll need accounts for: Vercel, Neon, GitHub (for the repo), and the existing Anthropic / Twilio / Vapi accounts you already have.

---

## 1. Database — Neon (10 min)

1. **neon.tech** → sign up → create a project named `insani-ai`. Region: `us-east-2` (Ohio) is the closest to Halifax with low latency.
2. After it spins up, open **Connection Details** → copy the **pooled connection string** (it ends in `-pooler.eastus2.aws.neon.tech/neondb?sslmode=require`).
3. From your local machine, point the schema at it once to create tables:
   ```powershell
   $env:DATABASE_URL="paste-pooled-neon-url"
   npx prisma db push
   npm run db:seed
   ```
   The seed creates the demo data + the **Operator (GTM admin)** user you use to log in.
4. Verify in Neon → **Tables** that all the `Prospect`, `OutreachCampaign`, etc. tables exist.

---

## 2. Push the repo to GitHub (if it isn't already)

Vercel deploys from a Git repo. Make sure your branch is pushed:
```bash
git push origin claude/ai-sales-outreach-engine-8kqsR
```

---

## 3. Vercel project (15 min)

1. **vercel.com** → sign in with GitHub → **Add New → Project** → import the `cars` repo.
2. Framework Preset: **Next.js** (auto-detected).
3. **Root Directory**: leave as default.
4. Branch: pick the branch you're deploying from.
5. **Environment Variables** — add these in the Vercel UI. *All required unless noted.*

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon pooled URL from step 1 |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `VAPI_API_KEY` | your **private** Vapi key |
| `VAPI_OUTREACH_ASSISTANT_ID` | the UUID from `npm run outreach:setup-vapi` |
| `VAPI_OUTREACH_PHONE_NUMBER_ID` | the UUID Vapi gave the imported Twilio number |
| `VAPI_WEBHOOK_SECRET` | a random string you generate (e.g. `openssl rand -hex 32`) |
| `PUBLIC_BASE_URL` | `https://insani.ai` (after the domain is connected — for now, the `*.vercel.app` URL) |
| `OUTREACH_COMPANY_NAME` | `Insani AI` |
| `OPERATOR_NOTIFICATION_PHONE` | your cell in `+1902…` format — SMS goes here when Ava books a demo |
| `TWILIO_ACCOUNT_SID` | from Twilio console homepage |
| `TWILIO_AUTH_TOKEN` | from Twilio console homepage |
| `TWILIO_FROM_NUMBER` | your Halifax 902 number in `+1902…` |
| `GOOGLE_PLACES_API_KEY` | (optional) for live prospect sourcing |
| `INNGEST_EVENT_KEY` | (optional) connects to Inngest Cloud for auto-dialer |
| `INNGEST_SIGNING_KEY` | (optional) Inngest signing key |

6. Click **Deploy**. First build takes 2–5 minutes.

---

## 4. Custom domain — insani.ai

1. Vercel project → **Settings → Domains** → **Add** → enter `insani.ai`.
2. Vercel shows DNS records to add. In **Cloudflare** (where your DNS lives) → DNS → add the records exactly as shown.
3. After ~5 min, SSL is auto-issued. `https://insani.ai` resolves to Vercel.
4. **Update `PUBLIC_BASE_URL`** in Vercel env vars to `https://insani.ai` (no trailing slash), then **redeploy** (Settings → Deployments → ⋯ → Redeploy).

---

## 5. Re-point the Vapi assistant at the live URL

From your local machine (or any machine with `.env` set up):
```powershell
$env:VAPI_API_KEY="..."
$env:PUBLIC_BASE_URL="https://insani.ai"
$env:VAPI_OUTREACH_ASSISTANT_ID="..."
npm run outreach:setup-vapi
```
This updates the assistant so Vapi hits `https://insani.ai/api/outreach/llm/chat/completions` and `…/webhook` instead of an ngrok URL.

Also paste your `VAPI_WEBHOOK_SECRET` from Vercel env vars into Vapi's assistant **Server URL → Secret** field so signature verification works in production.

---

## 6. Inngest Cloud (1 hour, optional but needed for auto-dialer)

The campaign dispatcher (the cron that actually places campaign calls) is an Inngest function. Without Inngest running, you can only fire one-off calls via the "Call my phone" button.

1. **inngest.com** → sign up → create app → name `insani-ai`.
2. Copy the **Event Key** and **Signing Key** into Vercel env vars as `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`. Redeploy.
3. In Inngest → Apps → register the URL `https://insani.ai/api/inngest`. Inngest will discover your functions (`outreach-dispatcher`, `outreach-qualifier`, etc.).
4. Now campaigns set to **running** will auto-dial within their rate limits.

---

## 7. Monitoring (recommended)

- **UptimeRobot** (free) → monitor `https://insani.ai/api/health` every 5 min. Tell it to email/SMS you on failure.
- **Sentry** (free tier) → install `@sentry/nextjs`, paste your DSN as an env var. Captures every runtime error.

---

## 8. Smoke test the production deploy

1. `https://insani.ai` loads → log in as **Operator (GTM admin)**.
2. `https://insani.ai/api/health` returns `{"ok": true}`.
3. **Try the rep** simulator works.
4. **Call my phone** with your verified cell → Ava actually calls and converses.
5. Book a demo on the call → check the **Booked demos** page and confirm you got an SMS notification on your phone.

If all five pass, you're live.

---

## Operating notes

- **`.env` is local-only.** Production env vars live in Vercel. Never commit `.env`.
- **Database migrations**: when the schema changes, run `npx prisma db push` against the prod `DATABASE_URL` once before deploying.
- **Vapi assistant updates**: re-run `npm run outreach:setup-vapi` whenever you change the first message or want to re-point URLs. The script PATCHes the existing assistant in place.
- **Cost guardrails**: campaigns have `ratePerMinute` and `maxAttempts` caps. Set them conservatively until you trust the volume.
- **Compliance**: keep the AI disclosure in the first message. Keep the suppression list (`/api/outreach/actions/prospects` → `suppress`) used aggressively. Get a CRTC compliance review before any real campaign.

---

## Rolling back

- Vercel → Deployments → find the last good deployment → **Promote to Production**. Live again in ~10 seconds.
- Database: Neon has point-in-time recovery on paid plans. On free, take periodic dumps with `pg_dump`.
