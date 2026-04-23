import { env } from "@/lib/env";
import type { EmailAdapter } from "./adapters";
import { mockEmail } from "./mock";

export function emailAdapter(): EmailAdapter {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) return mockEmail;
  return sendgridEmail;
}

const sendgridEmail: EmailAdapter = {
  provider: "sendgrid",
  async send({ to, subject, body }) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
    const id = res.headers.get("x-message-id") ?? `sg_${Date.now()}`;
    return { externalId: id, sentAt: new Date() };
  },
};
