import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { listIntegrations } from "@/lib/integrations";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const business = await prisma.business.findUnique({ where: { id: user.businessId } });
  if (!business) return <div>Business not found.</div>;

  const integrations = listIntegrations();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Connect your phone provider and messaging, and configure how your agent identifies your business.</p>
      </div>

      {/* Business details ------------------------------------------------- */}
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

      {/* Integrations ---------------------------------------------------- */}
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

              {/* Always-visible setup hints */}
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

      {/* Environment file help -------------------------------------------- */}
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
PUBLIC_BASE_URL="https://your-app.example.com"
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM_NUMBER="+14155557701"`}
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
      "Sign up at vapi.ai and create a Vapi account.",
      "From the dashboard, grab your API key and a webhook signing secret.",
      "Buy a phone number through Vapi (or import one from Twilio).",
      "Set VAPI_API_KEY, VAPI_WEBHOOK_SECRET, and PUBLIC_BASE_URL in .env.",
      "Add the phone number to this business above and restart the app.",
    ],
    twilio: [
      "Sign in at console.twilio.com.",
      "Copy your Account SID and Auth Token from the dashboard.",
      "Buy or claim an SMS-capable phone number.",
      "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in .env.",
    ],
    google_calendar: [
      "Open Google Cloud Console and create an OAuth 2.0 Client (Web).",
      "Add http://localhost:3000/api/auth/callback/google as an authorized redirect.",
      "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.",
      "(Full Calendar sync UI is on the roadmap — for now this just unlocks the adapter.)",
    ],
    inngest: [
      "Sign up at inngest.com and create a new application.",
      "Copy the Event Key and Signing Key from the project settings.",
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
