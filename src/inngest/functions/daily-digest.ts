import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { smsAdapter } from "@/integrations/sms";

// Hourly: send each business its end-of-day digest at the configured local
// hour, exactly once per day. We track this via an idempotent check on
// AiEval rows (a poor man's run log) — good enough for MVP.

export const dailyDigest = inngest.createFunction(
  { id: "daily-digest", name: "End-of-day digest" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const businesses = await step.run("digest-eligible", () =>
      prisma.business.findMany({
        where: { digestEnabled: true, digestRecipientPhone: { not: null } },
      }),
    );

    let sent = 0;
    for (const b of businesses) {
      // Is it the configured local hour, in this business's timezone?
      const h = Number(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: b.timezone }).format(new Date()),
      );
      if (h !== b.digestHourLocal) continue;

      // Has a digest already gone out today (idempotent guard)?
      const todayStart = startOfDay(new Date());
      const alreadySent = await prisma.aiEval.findFirst({
        where: { businessId: b.id, task: "daily_digest", createdAt: { gte: todayStart } },
      });
      if (alreadySent) continue;

      const summary = await composeDigest(b.id);
      if (!summary) continue;

      // Send via SMS.
      if (b.digestRecipientPhone) {
        await smsAdapter().send({
          fromNumber: b.smsFromNumber ?? b.phoneNumber ?? undefined,
          to: b.digestRecipientPhone,
          body: summary,
        }).catch(err => console.error("digest sms failed", err));
      }

      // Idempotency marker.
      await prisma.aiEval.create({
        data: {
          businessId: b.id,
          task: "daily_digest",
          input: { trigger: "cron" } as any,
          output: { body: summary } as any,
          model: "template",
          latencyMs: 0,
        },
      });
      sent++;
    }
    return { digestsSent: sent, businesses: businesses.length };
  },
);

async function composeDigest(businessId: string): Promise<string | null> {
  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (!biz) return null;
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [callsTotal, callsByOutcome, apptsToday, completedToday, soldNoShow, smsToday, upcomingTomorrow] = await Promise.all([
    prisma.callSession.count({ where: { businessId, startedAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.callSession.groupBy({
      by: ["outcome"],
      where: { businessId, startedAt: { gte: todayStart, lte: todayEnd } },
      _count: true,
    }),
    prisma.appointment.count({ where: { businessId, scheduledAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({ where: { businessId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: "completed" } }),
    prisma.appointment.count({ where: { businessId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: { in: ["no_show", "canceled"] } } }),
    prisma.smsMessage.count({ where: { thread: { businessId }, role: "agent", createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({
      where: {
        businessId,
        scheduledAt: { gt: todayEnd, lte: new Date(todayEnd.getTime() + 24 * 3600 * 1000) },
        status: { in: ["pending", "confirmed", "reminded"] },
      },
    }),
  ]);

  const booked = callsByOutcome.find(r => r.outcome === "booked")?._count ?? 0;
  const transferred = callsByOutcome.find(r => r.outcome === "transferred")?._count ?? 0;
  const messages = callsByOutcome.find(r => r.outcome === "message_taken")?._count ?? 0;

  const lines = [
    `${biz.name} — daily recap`,
    `Calls: ${callsTotal} (${booked} booked, ${transferred} to staff, ${messages} message${messages === 1 ? "" : "s"})`,
    `Text replies sent: ${smsToday}`,
    `Appointments today: ${apptsToday} (${completedToday} completed${soldNoShow ? `, ${soldNoShow} no-show/canceled` : ""})`,
    `Tomorrow: ${upcomingTomorrow} appointment${upcomingTomorrow === 1 ? "" : "s"} on the schedule.`,
  ];
  return lines.join("\n");
}
