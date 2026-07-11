import { prisma } from "@/lib/prisma";
import { placeOutboundCall } from "@/integrations/vapi";
import { env, outreachVapiReady } from "@/lib/env";

// The actual dispatcher logic. Shared by the Inngest scheduled function and
// the plain HTTP endpoint at /api/cron/outreach-dispatch so a customer without
// Inngest Cloud connected can still run campaigns via cron-job.org.

export async function runOutreachDispatch(): Promise<{ calls: number; skipped: number; campaigns: number }> {
  const campaigns = await prisma.outreachCampaign.findMany({ where: { status: "running" } });

  let totalCalls = 0;
  let totalSkipped = 0;
  const ready = outreachVapiReady();

  for (const c of campaigns) {
    const targets = await prisma.outreachTarget.findMany({
      where: {
        campaignId: c.id,
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      include: { prospect: true },
      take: c.ratePerMinute,
    });

    if (targets.length === 0) {
      // Auto-complete only when nothing is pending AND nothing is mid-call.
      const live = await prisma.outreachTarget.count({
        where: { campaignId: c.id, status: { in: ["pending", "calling"] } },
      });
      if (live === 0) {
        await prisma.outreachCampaign.update({
          where: { id: c.id },
          data: { status: "completed", completedAt: new Date() },
        });
      }
      continue;
    }

    for (const t of targets) {
      const p = t.prospect;

      if (p.doNotCall) {
        await skip(t.id, "opted_out", "Prospect is on the do-not-call list");
        totalSkipped++;
        continue;
      }
      if (p.phone) {
        const suppressed = await prisma.suppressionEntry.findUnique({ where: { phone: p.phone } });
        if (suppressed) {
          await prisma.prospect.update({
            where: { id: p.id },
            data: { doNotCall: true, status: "do_not_call" },
          });
          await skip(t.id, "opted_out", `Number suppressed (${suppressed.reason})`);
          totalSkipped++;
          continue;
        }
      }
      if (!p.phone) {
        await skip(t.id, "skipped", "No phone number on file");
        totalSkipped++;
        continue;
      }
      if (isQuietHour(p.timezone, c.quietStartHour, c.quietEndHour)) {
        continue;
      }
      if (t.attempts >= c.maxAttempts) {
        await prisma.outreachTarget.update({
          where: { id: t.id },
          data: { status: "failed", outcomeNote: `Reached ${c.maxAttempts} attempts with no contact` },
        });
        totalSkipped++;
        continue;
      }
      if (!ready) {
        await prisma.outreachTarget.update({
          where: { id: t.id },
          data: {
            status: "skipped",
            outcomeNote: "Outreach Vapi assistant not configured (mock mode)",
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        totalSkipped++;
        continue;
      }

      try {
        const call = await prisma.outreachCall.create({
          data: {
            prospectId: p.id,
            campaignId: c.id,
            targetId: t.id,
            direction: "outbound",
            status: "in_progress",
            fromNumber: c.callerId ?? "outreach",
            toNumber: p.phone,
            startedAt: new Date(),
          },
        });
        const placed = await placeOutboundCall({
          assistantId: env.VAPI_OUTREACH_ASSISTANT_ID,
          phoneNumberId: env.VAPI_OUTREACH_PHONE_NUMBER_ID,
          customer: { number: p.phone, name: p.businessName },
          metadata: {
            outreachCallId: call.id,
            prospectId: p.id,
            campaignId: c.id,
            targetId: t.id,
          },
        });
        await prisma.outreachCall.update({
          where: { id: call.id },
          data: { vapiCallId: placed.id },
        });
        await prisma.outreachTarget.update({
          where: { id: t.id },
          data: { status: "calling", lastAttemptAt: new Date(), attempts: { increment: 1 } },
        });
        await prisma.prospect.update({
          where: { id: p.id },
          data: {
            status: p.status === "converted" ? p.status : "contacted",
            attempts: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
        totalCalls++;
      } catch (err) {
        await prisma.outreachTarget.update({
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
}

async function skip(targetId: string, status: "skipped" | "opted_out", note: string) {
  await prisma.outreachTarget.update({
    where: { id: targetId },
    data: { status, outcomeNote: note, lastAttemptAt: new Date() },
  });
}

// Inclusive of start hour, exclusive of end hour, evaluated in `tz`.
function isQuietHour(tz: string, startHour: number, endHour: number): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz });
  const h = Number(fmt.format(new Date()));
  if (startHour < endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}
