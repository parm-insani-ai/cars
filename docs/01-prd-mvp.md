# PRD — MVP: Dealership AI Appointment & Opportunity Engine

Working codename: **Revline**

> One-line thesis: Prevent every sellable opportunity from leaking out of a dealership, and convert that into measurably more sold cars.

---

## 1. Product summary

Revline is an AI appointment and opportunity engine for car dealerships. It plugs read-only into the CRM, website lead sources, inventory feed, and phone system, then does four things:

1. Responds to fresh leads in under 60 seconds and drives them toward an appointment via SMS/email follow-up.
2. Detects missed inbound sales calls and recovers them with a rep-driven callback workflow.
3. Ranks service-drive customers by trade/equity likelihood, matches them to inventory, and puts them in front of a rep while the car is still on the lot.
4. Gives every rep a ranked daily "who to work next" feed, with the vehicle to pitch and a drafted message.

Humans (reps) stay in the loop on every outbound message in MVP. No live call handling. No phone replacement. No CRM replacement.

Success is measured in one unit: **incremental cars sold**.

---

## 2. Problem statement

Dealerships already pay for leads, calls, and foot traffic. They lose most of them.

- **Lead response is too slow.** Industry data consistently shows >50% of internet leads never get a response within the first hour. Conversion drops ~10x after the first 5 minutes.
- **Inbound sales calls leak.** 20–40% of inbound sales calls go unanswered or are mis-routed. Most are never called back the same day.
- **The service drive is a goldmine nobody mines.** A large share of service customers are in positive equity and are prime upgrade candidates. Almost none are contacted by sales while their car is in service.
- **Reps have no prioritization.** CRM task lists are stale, overloaded, and blind to inventory, equity, and recent intent signals.
- **Managers are blind to leakage in real time.** They see yesterday's report tomorrow.

This is a revenue leak problem, not a software problem. Every plugged leak is a sold car.

---

## 3. Target users

**Buyer:** Dealer Principal or GM (single rooftop to start; large dealer groups after pilot).

**Primary users:**
- Sales reps (front line, highest adoption risk)
- BDC / Internet sales manager (heaviest daily user)
- Sales manager / GSM (dashboards, escalations)

**Secondary users:**
- Service advisors (only pass-through; we watch their ROs, we don't change their workflow)
- GM (weekly ROI report)

We are NOT building for: F&I managers, accounting, service schedulers, parts, marketing agencies.

---

## 4. Jobs to be done

- *When a new lead hits the CRM, respond personally in under a minute so the customer picks us.*
- *When I start my shift, tell me the 10 customers most likely to set an appointment today and what to say.*
- *When a sales call is missed, make sure someone reaches back before the customer calls the next dealer.*
- *When a service customer is ready to upgrade, alert a rep while the customer is still in the drive.*
- *When I'm about to contact a customer, tell me which specific car from our lot to pitch.*
- *At the end of each day, show me exactly how many appointments and sold units we influenced.*

---

## 5. MVP scope (what ships v1)

Four modules. One rep app. One manager dashboard. Human-approved outbound only.

### Module 1 — Lead-to-Appointment Engine
- Ingest leads from ADF email, website webhooks, and CRM new-lead events.
- Score lead (hot/warm/cold) on arrival using recency, source, vehicle of interest, prior history.
- Draft personalized first response (SMS + email) within 30 seconds.
- Rep one-click approve/send, or manager can enable "rep auto-send" after N accepted drafts without edits (opt-in, per rep).
- Multi-step AI-driven follow-up cadence until: appointment set, explicit opt-out, or N days with no response.
- Auto-book appointment when customer proposes a time and inventory is available; sync to CRM.

### Module 2 — Missed-Call Recovery Engine
- Ingest call logs from the dealership's existing phone system (read-only).
- Detect missed inbound sales calls within 2 minutes of the call ending.
- Match caller number to existing customer/lead; create one if unknown.
- Create a task on the intended rep's feed with a one-click SMS callback draft.
- Escalate to manager feed if not worked within 10 minutes.
- Summarize the voicemail transcript (if any) and attach to the task.

### Module 3 — Service-to-Sales / Equity Engine
- Ingest RO (repair order) events from CRM/DMS: customer, vehicle in for service, mileage, date.
- Estimate equity position using current payoff (if available in CRM) vs. book value (MMR/KBB feed or dealer-provided); fall back to mileage + year + model heuristic when payoff is missing.
- Score "ready-to-upgrade" likelihood from: equity position, months of ownership, mileage trend, service spend, prior lease maturity.
- Match top-ranked customers to 1–3 matching in-stock vehicles (same or adjacent segment, monthly payment similar).
- Push alert to assigned sales rep (or floor rep if none) while the vehicle is on-site.
- Draft the pitch and the SMS/in-person opener.

### Module 4 — Inventory-Aware Next-Best-Action Feed
- For every rep, one ranked feed of up to 15 cards per day.
- Card types: new lead, follow-up due, missed call, service-to-sales opp, equity opp, back-from-the-dead reactivation.
- Each card shows: customer, why this is surfaced, expected value ($ gross if sold), matched vehicle, suggested action, one-click action buttons.
- Ranking objective: maximize expected appointments set this week.

### Cross-cutting MVP features
- CRM two-way sync for: leads, customers, tasks, appointments, activities (write-back on actions we drive).
- SMS via Twilio (A2P 10DLC registered per dealership); email via SendGrid.
- TCPA consent check on every outbound SMS (pull from CRM consent flag).
- Multi-tenant with per-rooftop data isolation.
- SSO via WorkOS.
- Manager dashboard with real-time SLA and leakage view.

---

## 6. Non-MVP (explicitly postponed)

- Live in-call AI (real-time whisper/coach during calls).
- AI voice bot making outbound calls.
- Replacing the phone system or sitting in the call path.
- Website chatbot.
- F&I, desking, deal structuring, finance.
- Service scheduling replacement.
- OEM-wide cross-rooftop analytics.
- Mobile native apps (web-responsive is enough).
- Marketing attribution, ad spend optimization.
- Autopilot outbound on day one — human approval required in MVP.

---

## 7. User stories (MVP)

**Rep**
- I open the app; I see the top 10 customers to work, ranked, each with a drafted action.
- A new lead arrives; I get a browser + mobile push with a drafted SMS; I hit send and go back to what I was doing.
- I missed a call 3 minutes ago; it's already at the top of my feed with a drafted callback.
- A service customer just dropped off a car; I get an alert saying they're in positive equity and match a 2024 RAV4 on our lot, with a pitch and pricing ready.
- I click "Book appointment" and it syncs to the CRM and sends the confirmation.

**Manager**
- I see every lead from the last 30 minutes and whether it got a response inside SLA.
- I see every missed call today and whether it was recovered.
- I can reassign any opportunity to another rep in one click.
- I see a live scoreboard per rep: appointments set today, shown today, sold this week.
- I get a daily digest email at 6pm with numbers.

**BDC lead**
- I can see the AI-drafted outbound queue across all reps.
- I can override, pause, or force-send.

---

## 8. Workflows (high level, detailed in MVP design doc)

- **Lead intake:** ADF/webhook/CRM event → dedupe → score → draft response → push to rep → on approve, send via Twilio/SendGrid → log thread → trigger cadence state machine → on customer reply, re-score + draft next response → on proposed time, check inventory & rep calendar → book → CRM writeback.
- **Missed call:** phone integration pushes call event → within 2 minutes match to customer → create card in rep feed with drafted SMS → 10-minute SLA → escalate to manager if breached.
- **Service-to-sales:** RO created event → equity estimate → match to inventory → rank → if in top N, create sales-rep card with a 30-minute expiry while customer is on-site.
- **Rep action feed:** every minute, re-rank open opportunities per rep using updated signals → cap at 15 → push delta to client.

---

## 9. Success metrics

**North-star**
- Incremental cars sold per rooftop per month attributable to Revline-surfaced opportunities (CRM-tagged).

**Primary funnel**
- Appointments **set** per rep per week.
- Show rate: appointments shown / appointments set.
- Close rate: sold / shown.
- Incremental units: units tagged "Revline-influenced" vs control cohort in pilot.

**Operational SLAs (leakage metrics)**
- % new leads with first response <5 minutes. Target 95%.
- % missed sales calls with callback attempt <15 minutes. Target 90%.
- % service ROs with at least one sales contact attempt while on-site. Target 70%.
- Median time-to-first-response. Target <90 seconds.

**Adoption**
- DAU / licensed rep. Target 80%+.
- Rep-approved draft send rate (without edit). Target 60%+ (proxy for AI quality).
- % feed cards actioned same day. Target 70%+.

**Business**
- ROI: incremental gross profit per rooftop / MRR cost. Target 5x in pilot, 10x by month 3.
- Pilot → paid conversion. Target 2 of 3 pilots convert.

---

## 10. Product risks & mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| CRM data is messy and incomplete | Bad inputs → bad AI → lost trust | Start with 1 CRM (VinSolutions). Tolerate missing fields. Never show a card with broken data; drop it instead. |
| Phone system fragmentation | 20+ phone platforms; we can't integrate all | Pilot only at dealerships using one of: Car Wars, CallRevu, Dialpad, RingCentral. Build those four connectors. |
| Rep adoption / "yet another tool" | Feed ignored = product dead | Rep app is one screen. Every card tells the rep the dollar value and gives a one-click action. Limit feed to 15 cards/day. |
| TCPA / CAN-SPAM compliance on SMS/email | Fines, OEM pushback | Enforce opt-in consent from CRM on every send. Block sends without consent. Audit log every message. |
| AI hallucinating vehicle details, price, or customer context | Embarrassing, damages dealer brand | Constrain AI drafts to a structured context (real inventory row, real customer record). Human-in-the-loop send in MVP. Model gets inventory & price from a tool call, never free-form. |
| Attribution disputes ("we would have sold it anyway") | Buyer stops paying | Explicit "Revline-influenced" CRM tag on any deal where we drove the contact or appointment. Pilot cohort vs. control store comparison when possible. |
| Multi-tenant data leakage | Dealership groups compete | Row-level security in Postgres keyed on `rooftop_id`. Tenant isolation in prompts and logs. No cross-tenant embeddings. |
| OEM and state regulatory edges (e.g., EV mandates, Reynolds DMS access) | Some integrations are blocked by gatekeepers | Avoid DMS direct for MVP; go through CRM and dealer-provided exports. Deal with Reynolds via authorized integration partners only. |
| Pricing objections from dealers | Long procurement cycles | Price on outcomes (per incremental sold unit) after a 60-day success-based pilot. |

---

## 11. Guiding product principles (non-negotiable)

1. If a feature doesn't show a clear path to sold units, it's out.
2. Rep screen limit: one, with at most 15 cards/day.
3. Every AI-drafted message is anchored to real records (inventory row, customer record), not free text.
4. Human-in-the-loop in MVP. Earn autopilot later, per rep, per action type.
5. Read phones; don't route phones.
6. Never try to own the customer record. The CRM owns it. We act on it.
7. Ship the smallest thing that creates a measurable pilot win in 30 days.
