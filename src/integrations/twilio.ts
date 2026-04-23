import { env } from "@/lib/env";
import type { SmsAdapter } from "./adapters";
import { mockSms } from "./mock";

// Lazy — only instantiates the Twilio client if credentials are present.
export function smsAdapter(): SmsAdapter {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    return mockSms;
  }
  return twilioSms;
}

const twilioSms: SmsAdapter = {
  provider: "twilio",
  async send({ to, body }) {
    const twilio = (await import("twilio")).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({ to, body, from: env.TWILIO_FROM_NUMBER });
    return { externalId: msg.sid, sentAt: new Date() };
  },
};
