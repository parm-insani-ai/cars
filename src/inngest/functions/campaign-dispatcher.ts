import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { vapiAvailable, placeOutboundCall } from "@/integrations/vapi";

// Walks running campaigns every minute, sends out the next batch of outbound
// calls, respecting per-campaign quiet hours and rate per minute. When Vapi
// isn't configured, marks targets as "skipped" with a clear note so the UI
// doesn't lie about progress.

export const campaignDispatcher = inngest.createFunction(
  { id: "campaign-dispatcher", name: "Outbound campaign dispatcher" },
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const campaigns = await step.run("active-campaigns", () =>
      prisma.campaign.findMany({
        where: { status: "running" },
        include: { business: true },
      }),
    );

    let totalCalls = 0;
    let totalSkipped = 0;
    for (const c of campaigns) {
      // Quiet-hour check, in business timezone.
      if (isQuietHour(c.business.timezone, c.quietStartHour, c.quietEndHour)) continue;

      const targets = await prisma.campaignTarget.findMany({
        where: { campaignId: c.id, status: "pending" },
        include: { customer: true },
        take: c.ratePerMinute,
      });
      if (targets.length === 0) {
        // Auto-complete when nothing is pending.
        await prisma.campaign.update({ where: { id: c.id }, data: { status: "completed", completedAt: new Date() } });
        continue;
      }

      for (const t of targets) {
        if (!t.customer.phone) {
          await prisma.campaignTarget.update({
            where: { id: t.id },
            data: { status: "skipped", outcomeNote: "no phone on file", lastAttemptAt: new Date() },
          });
          totalSkipped++;
          continue;
        }
        if (!vapiAvailable() || !c.business.vapiAssistantId) {
          // Without Vapi we can't actually call. Skip with explanation.
          await prisma.campaignTarget.update({
            where: { id: t.id },
            data: {
              status: "skipped",
              outcomeNote: !vapiAvailable() ? "Vapi not configured" : "Business has no assistant id",
              lastAttemptAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          totalSkipped++;
          continue;
        }

        try {
          // Note: phoneNumberId is the Vapi phone number id, NOT the E.164 number.
          // We don't currently track this on Business; in a real deployment add
          // Business.vapiPhoneNumberId and use that here.
          await placeOutboundCall({
            assistantId: c.business.vapiAssistantId,
            phoneNumberId: process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID ?? "",
            customer: {
              number: t.customer.phone,
              name: `${t.customer.firstName ?? ""} ${t.customer.lastName ?? ""}`.trim() || undefined,
            },
            metadata: {
              businessId: c.businessId,
              campaignId: c.id,
              campaignTargetId: t.id,
              goal: c.goal,           // surfaced to the outbound system prompt
            },
          });
          await prisma.campaignTarget.update({
            where: { id: t.id },
            data: { status: "calling", lastAttemptAt: new Date(), attempts: { increment: 1 } },
          });
          totalCalls++;
        } catch (err) {
          await prisma.campaignTarget.update({
            where: { id: t.id },
            data: {
              status: "failed",
              outcomeNote: err instanceof Error ? err.message : String(err),
              lastAttemptAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        }
      }
    }
    return { calls: totalCalls, skipped: totalSkipped, campaigns: campaigns.length };
  },
);

function isQuietHour(tz: string, startHour: number, endHour: number): boolean {
  const now = new Date();
  // Format the hour in the business's local timezone.
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz });
  const h = Number(fmt.format(now));
  if (startHour < endHour) {
    return h >= startHour && h < endHour;
  }
  // Wraps midnight, e.g. 20–9
  return h >= startHour || h < endHour;
}
