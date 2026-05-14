export const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ?? "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL ?? "",
  ALLOW_AUTOPILOT_SEND: process.env.ALLOW_AUTOPILOT_SEND === "true",

  // --- GTM / outbound sales engine (internal tooling) ------------------
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY ?? "",
  // The AI sales rep dials prospects through its own Vapi assistant + number,
  // kept separate from the per-business receptionist assistants.
  VAPI_OUTREACH_ASSISTANT_ID: process.env.VAPI_OUTREACH_ASSISTANT_ID ?? "",
  VAPI_OUTREACH_PHONE_NUMBER_ID: process.env.VAPI_OUTREACH_PHONE_NUMBER_ID ?? "",
  // Branding for the pitch — what the AI rep calls "us".
  OUTREACH_COMPANY_NAME: process.env.OUTREACH_COMPANY_NAME || "Frontdesk",
};

export function requireAnthropic(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — the AI layer cannot run.");
  }
  return env.ANTHROPIC_API_KEY;
}

// True when the outreach engine can place real outbound sales calls. Without
// it, the dispatcher runs in mock mode and marks targets skipped with a note.
export function outreachVapiReady(): boolean {
  return Boolean(
    process.env.VAPI_API_KEY &&
    env.VAPI_OUTREACH_ASSISTANT_ID &&
    env.VAPI_OUTREACH_PHONE_NUMBER_ID,
  );
}
