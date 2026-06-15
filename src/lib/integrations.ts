// Read-only checks for which third-party integrations are configured.
// Pulls from env, never from request — safe to call from server components.

export type IntegrationStatus = {
  key: "anthropic" | "vapi" | "twilio" | "google_calendar" | "stripe" | "inngest";
  name: string;
  required: boolean;
  connected: boolean;
  detail: string;
  envVars: string[];
  helpUrl?: string;
};

export function listIntegrations(): IntegrationStatus[] {
  return [
    {
      key: "anthropic",
      name: "Anthropic (AI brain)",
      required: true,
      connected: Boolean(process.env.ANTHROPIC_API_KEY),
      detail: process.env.ANTHROPIC_API_KEY
        ? "Connected. The voice agent will use Claude for every call."
        : "Required. Without this, the agent can't think or talk.",
      envVars: ["ANTHROPIC_API_KEY"],
      helpUrl: "https://console.anthropic.com",
    },
    {
      key: "vapi",
      name: "Vapi (phone calls)",
      required: false,
      connected: Boolean(process.env.VAPI_API_KEY),
      detail: process.env.VAPI_API_KEY
        ? "Connected. Real phone calls will route through Vapi."
        : "Without it, you can only use the Try-the-agent simulator (no live phone calls).",
      envVars: ["VAPI_API_KEY", "VAPI_WEBHOOK_SECRET", "PUBLIC_BASE_URL", "VAPI_OUTBOUND_PHONE_NUMBER_ID"],
      helpUrl: "https://vapi.ai",
    },
    {
      key: "twilio",
      name: "Twilio (text messages)",
      required: false,
      connected: Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER,
      ),
      detail: process.env.TWILIO_ACCOUNT_SID
        ? "Connected. Reminder texts, deposit links, and two-way SMS conversations will go through Twilio."
        : "Without it, text reminders are logged to the console only and the two-way SMS webhook is inactive.",
      envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
      helpUrl: "https://www.twilio.com/console",
    },
    {
      key: "google_calendar",
      name: "Google Calendar (two-way sync)",
      required: false,
      connected: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
      detail: process.env.GOOGLE_OAUTH_CLIENT_ID
        ? "OAuth configured. Click 'Connect Google' below to authorize this business's calendar."
        : "Without it, appointments live in insani only. Connect to sync with Google Calendar — the agent will avoid double-booking automatically.",
      envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "PUBLIC_BASE_URL"],
      helpUrl: "https://console.cloud.google.com",
    },
    {
      key: "stripe",
      name: "Stripe (deposits & cards on file)",
      required: false,
      connected: Boolean(process.env.STRIPE_SECRET_KEY),
      detail: process.env.STRIPE_SECRET_KEY
        ? "Connected. The agent can text a deposit link mid-call to lock the appointment."
        : "Without it, the agent can still book, but you can't collect deposits — which is the single biggest no-show preventer.",
      envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      helpUrl: "https://dashboard.stripe.com",
    },
    {
      key: "inngest",
      name: "Inngest (background tasks)",
      required: false,
      connected: Boolean(process.env.INNGEST_EVENT_KEY),
      detail: process.env.INNGEST_EVENT_KEY
        ? "Connected to Inngest Cloud."
        : "Without it, reminders, follow-ups, and campaigns run in dev mode only.",
      envVars: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
      helpUrl: "https://www.inngest.com",
    },
  ];
}

export function setupComplete(): boolean {
  // "Setup complete" = the required integration (Anthropic) is connected.
  return listIntegrations().filter(i => i.required).every(i => i.connected);
}
