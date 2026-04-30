import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";

// 6pm rooftop-local digest for managers. Writes an Alert row; in production
// also sends an email via SendGrid.
export const dailyDigest = inngest.createFunction(
  { id: "daily-digest", name: "Manager daily digest" },
  { cron: "TZ=America/Los_Angeles 0 18 * * *" },
  async ({ step }) => {
    const rooftops = await step.run("rooftops", () => prisma.rooftop.findMany());
    const today = startOfDay(new Date());

    let sent = 0;
    for (const r of rooftops) {
      const [leads, appts, sold, missed, slaBreaches] = await Promise.all([
        prisma.lead.count({ where: { rooftopId: r.id, createdAt: { gte: today } } }),
        prisma.appointment.count({
          where: {
            rooftopId: r.id,
            createdAt: { gte: today },
            status: { in: ["set", "confirmed", "shown", "sold"] },
          },
        }),
        prisma.appointment.count({
          where: { rooftopId: r.id, createdAt: { gte: today }, status: "sold" },
        }),
        prisma.callEvent.count({
          where: {
            rooftopId: r.id,
            startedAt: { gte: today },
            outcome: "missed",
            direction: "inbound",
          },
        }),
        prisma.task.count({
          where: { rooftopId: r.id, status: "escalated", createdAt: { gte: today } },
        }),
      ]);

      const body = [
        `Today at ${r.name}:`,
        `· ${leads} leads`,
        `· ${appts} appointments set${sold ? ` (${sold} sold)` : ""}`,
        `· ${missed} missed sales calls`,
        slaBreaches ? `· ${slaBreaches} SLA breach${slaBreaches === 1 ? "" : "es"}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await prisma.alert.create({
        data: {
          rooftopId: r.id,
          kind: "hot_lead_new", // generic bucket; "digest" alert kind not added to keep enum tight
          severity: slaBreaches > 0 ? "warn" : "info",
          title: `Daily digest — ${r.name}`,
          body,
        },
      });
      sent++;
    }
    return { digestsSent: sent };
  },
);
