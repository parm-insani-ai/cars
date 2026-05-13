import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { listIntegrations } from "@/lib/integrations";
import { SettingsForm } from "./SettingsForm";
import { DepositSettings } from "./DepositSettings";
import { DigestSettings } from "./DigestSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams?: { google?: string } }) {
  const user = await requireUser();
  const business = await prisma.business.findUnique({ where: { id: user.businessId } });
  if (!business) return <div>Business not found.</div>;

  const integrations = listIntegrations();
  const googleStatus = searchParams?.google;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Connect your phone provider, payments, and calendar. Configure how the agent identifies your business.</p>
      </div>

      {googleStatus === "connected" && (
        <div className="card p-4 bg-lane-cool/5 border-lane-cool/30">
          <p className="text-sm"><strong>Google Calendar connected.</strong> The agent will sync new bookings here and avoid double-booking against your existing events.</p>
        </div>
      )}

      {/* Business details */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Your business</h2>
          <p className="text-xs text-ink-muted">Used by the agent and on outbound messages.</p>
        </div>
        <SettingsForm
          businessName={business.name}
          phoneNumber={business.phoneNumber}
          smsFromNumber={business.smsFromNumber}
          timezone={business.timezone}
        />
      </section>

      {/* Deposits */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Deposits</h2>
          <p className="text-xs text-ink-muted">The single biggest no-show preventer. The agent texts a payment link mid-call.</p>
        </div>
        <DepositSettings
          enabled={business.depositsEnabled}
          defaultDepositCents={business.defaultDepositCents}
          stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
        />
      </section>

      {/* End-of-day digest */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">End-of-day text recap</h2>
          <p className="text-xs text-ink-muted">A short text every evening with the day's calls, bookings, and tomorrow's schedule.</p>
        </div>
        <DigestSettings
          enabled={business.digestEnabled}
          recipientPhone={business.digestRecipientPhone}
          recipientEmail={business.digestRecipientEmail}
          hourLocal={business.digestHourLocal}
          timezone={business.timezone}
        />
      </section>

      {/* Google Calendar connect */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Google Calendar</h2>
          <p className="text-xs text-ink-muted">Connect your Google account so the agent's bookings sync both ways.</p>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {business.googleRefreshToken ? (
              <>
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-ink-muted">Calendar id: {business.googleCalendarId ?? "primary"}</p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">Not connected to Google.</p>
            )}
          </div>
          {process.env.GOOGLE_OAUTH_CLIENT_ID
            ? <a className="btn-primary" href="/api/auth/google/start">{business.googleRefreshToken ? "Reconnect" : "Connect Google"}</a>
            : <span className="text-xs text-ink-muted">Set GOOGLE_OAUTH_CLIENT_ID in .env first.</span>}
        </div>
      </section>

      {/* Integrations */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Integrations</h2>
          <p className="text-xs text-ink-muted">
            Each integration is wired through environment variables for security. To connect or disconnect one, edit{" "}
            <code className="font-mono text-ink">.env</code> and restart the app.
          </p>
        </div>
        <div className="space-y-3">
          {integrations.map(i => (
            <div key={i.key} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{i.name}</h3>
                    {i.required && <span className="chip-muted">Required</span>}
                    <StatusChip connected={i.connected} />
                  </div>
                  <p className="text-sm text-ink-muted mt-1">{i.detail}</p>
                </div>
                {i.helpUrl && (
                  <a className="btn-secondary flex-none" href={i.helpUrl} target="_blank" rel="noreferrer">
                    Open dashboard ↗
                  </a>
                )}
              </div>

              {!i.connected && (
                <div className="mt-4 rounded-lg bg-surface-sub border border-surface-border p-3">
                  <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-2">How to connect</div>
                  <ConnectInstructions provider={i.key} />
                  <div className="mt-3 text-xs">
                    <span className="text-ink-muted">Environment variables this integration reads:</span>
                    <ul className="font-mono text-[12px] mt-1 space-y-0.5 text-ink">
                      {i.envVars.map(v => <li key={v}>· {v}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Env help */}
      <section className="card p-5 space-y-2">
        <h3 className="font-semibold">Where do environment variables go?</h3>
        <p className="text-sm text-ink-muted">
          In the project folder there's a file called <code className="font-mono">.env</code>. Open it in any text editor and add the values you want to connect.
          After saving, stop and restart the dev server (Ctrl-C then <code className="font-mono">npm run dev</code>).
        </p>
        <pre className="bg-surface-sub border border-surface-border rounded-lg p-3 text-[12px] font-mono overflow-x-auto">
{`# Example .env values
ANTHROPIC_API_KEY="sk-ant-..."
VAPI_API_KEY="vapi_..."
VAPI_WEBHOOK_SECRET="whsec_..."
VAPI_OUTBOUND_PHONE_NUMBER_ID="pn_..."   # required for outbound campaigns
PUBLIC_BASE_URL="https://your-app.example.com"
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM_NUMBER="+14155557701"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GOOGLE_OAUTH_CLIENT_ID="..."
GOOGLE_OAUTH_CLIENT_SECRET="..."`}
        </pre>
      </section>
    </div>
  );
}

function StatusChip({ connected }: { connected: boolean }) {
  return connected
    ? <span className="chip-cool inline-flex items-center gap-1">● Connected</span>
    : <span className="chip-muted inline-flex items-center gap-1">○ Not connected</span>;
}

function ConnectInstructions({ provider }: { provider: string }) {
  const steps: Record<string, string[]> = {
    anthropic: [
      "Sign in at console.anthropic.com and create an API key.",
      "Add at least $5 in credits under Billing.",
      "Paste the key as ANTHROPIC_API_KEY in your .env file.",
    ],
    vapi: [
      "Sign up at vapi.ai and create an account.",
      "From the dashboard, grab your API key and a webhook signing secret.",
      "Buy a phone number through Vapi (or import one from Twilio).",
      "Set VAPI_API_KEY, VAPI_WEBHOOK_SECRET, PUBLIC_BASE_URL in .env.",
      "For outbound campaigns: also set VAPI_OUTBOUND_PHONE_NUMBER_ID to the Vapi phone-number id you'll dial FROM.",
      "Add the inbound number to this business above and restart the app.",
    ],
    twilio: [
      "Sign in at console.twilio.com.",
      "Copy your Account SID and Auth Token from the dashboard.",
      "Buy or claim an SMS-capable phone number.",
      "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env.",
      "For two-way SMS: point your Twilio number's 'A message comes in' webhook at /api/webhooks/sms (HTTP POST).",
    ],
    google_calendar: [
      "Open Google Cloud Console and create an OAuth 2.0 Client (Web).",
      "Add PUBLIC_BASE_URL/api/auth/google/callback as an authorized redirect URI.",
      "Enable the Google Calendar API on the project.",
      "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET in .env.",
      "Restart and click 'Connect Google' on this Settings page.",
    ],
    stripe: [
      "Sign in at dashboard.stripe.com (Test mode is fine to start).",
      "Copy the Secret Key from Developers → API keys.",
      "Create an endpoint at Developers → Webhooks pointing to PUBLIC_BASE_URL/api/webhooks/stripe; copy its signing secret.",
      "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env, restart the app.",
      "Enable deposits in the Deposits section above and set a default amount.",
    ],
    inngest: [
      "Sign up at inngest.com and create a new application.",
      "Copy the Event Key and Signing Key from project settings.",
      "Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY in .env.",
      "Without these the workflows run in local dev mode, which is fine for now.",
    ],
  };
  const list = steps[provider] ?? ["Refer to the provider's documentation."];
  return (
    <ol className="list-decimal list-inside text-sm text-ink space-y-1">
      {list.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  );
}
