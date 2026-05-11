import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { packFor } from "@/packs";

// Hourly: appointments that ended 30 min ago and were never marked arrived /
// completed get flipped to no_show and a recovery follow-up scheduled.
export const noShowDetection = inngest.createFunction(
  { id: "no-show-detection", name: "Detect no-shows and queue recovery" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const candidates = await step.run("find", () =>
      prisma.appointment.findMany({
        where: {
          status: { in: ["confirmed", "reminded", "pending"] },
          scheduledAt: { lt: cutoff },
        },
        include: { business: true },
        take: 200,
      }),
    );

    let flagged = 0;
    for (const a of candidates) {
      const scheduledAt = new Date(a.scheduledAt);
      const apptEnd = new Date(scheduledAt.getTime() + a.durationMin * 60_000);
      if (apptEnd > new Date()) continue; // not yet over

      const pack = packFor(a.business.vertical);
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: a.id }, data: { status: "no_show" } });
        if (a.customerId) {
          await tx.followUp.create({
            data: {
              businessId: a.businessId,
              customerId: a.customerId,
              apptId: a.id,
              kind: "no_show_recovery",
              channel: "sms",
              scheduledFor: new Date(Date.now() + pack.followUpPolicy.noShowRecoveryMinutesAfter * 60_000),
              status: "scheduled",
            },
          });
        }
      });
      flagged++;
    }
    return { flagged, scanned: candidates.length };
  },
);
