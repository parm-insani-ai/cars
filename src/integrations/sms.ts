import { env } from "@/lib/env";

export interface SmsAdapter {
  readonly provider: "twilio" | "mock";
  send(args: { fromNumber?: string; to: string; body: string }): Promise<{ externalId: string; sentAt: Date }>;
}

const mockSms: SmsAdapter = {
  provider: "mock",
  async send({ to, body }) {
    console.log(`[mock sms] to=${to} body=${body}`);
    return { externalId: `mock_sms_${Date.now()}`, sentAt: new Date() };
  },
};

const twilioSms: SmsAdapter = {
  provider: "twilio",
  async send({ fromNumber, to, body }) {
    const twilio = (await import("twilio")).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      to,
      body,
      from: fromNumber ?? env.TWILIO_FROM_NUMBER,
    });
    return { externalId: msg.sid, sentAt: new Date() };
  },
};

export function smsAdapter(): SmsAdapter {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) return mockSms;
  return twilioSms;
}
