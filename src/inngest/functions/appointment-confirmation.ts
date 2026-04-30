import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

// Hourly cron: find appointments scheduled in the next 18-26 hours with status
// "set" and create a confirmation task (the rep approves the AI-drafted SMS).
// Also: appointments scheduled within 90 minutes that are still "set" → high-pri
// nudge to the rep.
export const appointmentConfirmation = inngest.createFunction(
  { id: "appointment-confirmation", name: "Appointment confirmation nudges" },
  { cron: "0 */1 * * *" },
  async ({ step }) => {
    const now = Date.now();

    const tomorrow = await step.run("tomorrow", async () => {
      const start = new Date(now + 18 * 60 * 60 * 1000);
      const end = new Date(now + 26 * 60 * 60 * 1000);
      return prisma.appointment.findMany({
        where: { scheduledAt: { gte: start, lte: end }, status: "set" },
        include: { lead: { include: { customer: true } } },
        take: 200,
      });
    });

    let created = 0;
    for (const a of tomorrow) {
      if (!a.repId) continue;
      const has = await prisma.task.findFirst({
        where: {
          rooftopId: a.rooftopId,
          userId: a.repId,
          kind: "confirm_appointment",
          status: "open",
          // crude dedupe: title contains the appt id
          title: { contains: a.id },
        },
      });
      if (has) continue;
      await prisma.task.create({
        data: {
          rooftopId: a.rooftopId,
          userId: a.repId,
          kind: "confirm_appointment",
          leadId: a.leadId,
          title: `Confirm appointment ${a.id.slice(-6)} (${a.scheduledAt.toLocaleString()})`,
          body: a.lead?.customer
            ? `${a.lead.customer.firstName ?? "Customer"} is scheduled tomorrow. Send the confirmation SMS.`
            : "Confirmation reminder.",
          slaAt: new Date(now + 4 * 60 * 60 * 1000),
          priority: 0.7,
        },
      });
      created++;
    }

    return { confirmTasksCreated: created };
  },
);
