// Read-only checks for which third-party integrations are configured.
// Pulls from env, never from request — safe to call from server components.

export type IntegrationStatus = {
  key: "anthropic" | "vapi" | "twilio" | "google_calendar" | "inngest";
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
        : "Optional. Without it, you can only use the Try-the-agent simulator (no live phone calls).",
      envVars: ["VAPI_API_KEY", "VAPI_WEBHOOK_SECRET", "PUBLIC_BASE_URL"],
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
        ? "Connected. Reminder texts and confirmations will go out via SMS."
        : "Optional. Without it, text reminders are logged to the console only.",
      envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
      helpUrl: "https://www.twilio.com/console",
    },
    {
      key: "google_calendar",
      name: "Google Calendar (sync)",
      required: false,
      connected: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
      detail: process.env.GOOGLE_OAUTH_CLIENT_ID
        ? "Connected (stub — full sync coming soon)."
        : "Optional. Without it, appointments live in Frontdesk only.",
      envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
      helpUrl: "https://console.cloud.google.com",
    },
    {
      key: "inngest",
      name: "Inngest (background tasks)",
      required: false,
      connected: Boolean(process.env.INNGEST_EVENT_KEY),
      detail: process.env.INNGEST_EVENT_KEY
        ? "Connected to Inngest Cloud."
        : "Optional. Without it, reminders and follow-ups run in dev mode only.",
      envVars: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
      helpUrl: "https://www.inngest.com",
    },
  ];
}

export function setupComplete(): boolean {
  // "Setup complete" = the required integration (Anthropic) is connected.
  // Optional integrations don't block the pill from clearing.
  return listIntegrations().filter(i => i.required).every(i => i.connected);
}
