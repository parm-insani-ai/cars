export const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ?? "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL ?? "",
  ALLOW_AUTOPILOT_SEND: process.env.ALLOW_AUTOPILOT_SEND === "true",
};

export function requireAnthropic(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — the AI layer cannot run.");
  }
  return env.ANTHROPIC_API_KEY;
}
