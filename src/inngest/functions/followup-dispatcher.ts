import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { smsAdapter } from "@/integrations/sms";
import { format } from "date-fns";

// Every minute, scan scheduled FollowUp rows that are due. Send SMS via the
// SMS adapter (Twilio when configured, mock otherwise). Voice follow-ups
// (outbound callbacks) are placed via Vapi.
export const followUpDispatcher = inngest.createFunction(
  { id: "followup-dispatcher", name: "Dispatch scheduled follow-ups" },
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const due = await step.run("load-due", () =>
      prisma.followUp.findMany({
        where: { status: "scheduled", scheduledFor: { lte: new Date() } },
        include: { business: { include: { agentConfig: true } } },
        take: 100,
      }),
    );

    let sent = 0;
    let failed = 0;
    for (const f of due) {
      try {
        if (f.channel === "sms") {
          const customer = f.customerId
            ? await prisma.customer.findUnique({ where: { id: f.customerId } })
            : null;
          if (!customer?.phone || !customer.smsConsent) {
            await prisma.followUp.update({ where: { id: f.id }, data: { status: "skipped", errorMessage: "no_phone_or_consent" } });
            continue;
          }
          const body = await renderBody(f.kind, f.businessId, f.apptId, f.callSessionId, customer);
          if (!body) {
            await prisma.followUp.update({ where: { id: f.id }, data: { status: "skipped", errorMessage: "no_body" } });
            continue;
          }
          const footer = f.business.agentConfig?.smsFooter ?? "";
          const fullBody = footer ? `${body}\n${footer}` : body;
          await smsAdapter().send({
            fromNumber: f.business.smsFromNumber ?? f.business.phoneNumber ?? undefined,
            to: customer.phone,
            body: fullBody,
          });
          await prisma.followUp.update({
            where: { id: f.id },
            data: { status: "sent", sentAt: new Date() },
          });
          sent++;
          continue;
        }

        if (f.channel === "voice") {
          // Voice follow-ups require Vapi; skip with a clear status if Vapi isn't configured.
          if (!process.env.VAPI_API_KEY) {
            await prisma.followUp.update({ where: { id: f.id }, data: { status: "skipped", errorMessage: "vapi_not_configured" } });
            continue;
          }
          // TODO: place outbound call via vapi.placeOutboundCall when phone number + assistant ids are wired.
          await prisma.followUp.update({ where: { id: f.id }, data: { status: "skipped", errorMessage: "voice_followup_not_implemented" } });
          continue;
        }
      } catch (err) {
        failed++;
        await prisma.followUp.update({
          where: { id: f.id },
          data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
        });
      }
    }
    return { sent, failed, total: due.length };
  },
);

async function renderBody(
  kind: string,
  businessId: string,
  apptId: string | null,
  _callSessionId: string | null,
  customer: { firstName: string | null },
): Promise<string | null> {
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz) return null;

  if (kind === "pre_appt_reminder" && apptId) {
    const appt = await prisma.appointment.findUnique({ where: { id: apptId }, include: { service: true, provider: true } });
    if (!appt) return null;
    const when = format(appt.scheduledAt, "EEEE MMM d 'at' h:mm a");
    const who = appt.provider ? ` with ${appt.provider.name}` : "";
    return `Reminder from ${biz.name}: ${appt.service.name}${who} ${when}. Reply C to confirm or R to reschedule.`;
  }

  if (kind === "post_call_followup") {
    const greeting = customer.firstName ? `Hi ${customer.firstName},` : "Hi there,";
    return `${greeting} thanks for calling ${biz.name} earlier today. Did you want me to help you get on the schedule? Reply with a time and I'll find an opening.`;
  }

  if (kind === "no_show_recovery") {
    const greeting = customer.firstName ? `Hi ${customer.firstName},` : "Hi there,";
    return `${greeting} we missed you for your appointment at ${biz.name}. Want to reschedule? Reply with a good day/time.`;
  }

  if (kind === "missed_call_callback") {
    return `Hi, this is ${biz.name} — we just missed your call. Reply here with how we can help and we'll get you taken care of, or call us back any time.`;
  }

  return null;
}
