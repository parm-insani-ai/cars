import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

// Daily cron: find dead/lost leads from 30-90 days ago that we never sold,
// turn each into a reactivation task. The drafter runs lazily when the rep
// opens the card (via the lead detail page's existing recommendation flow).
export const reactivationDaily = inngest.createFunction(
  { id: "reactivation-daily", name: "Daily reactivation sweep" },
  { cron: "TZ=America/Los_Angeles 0 7 * * *" },
  async ({ step }) => {
    const candidates = await step.run("find-candidates", async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const until = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return prisma.lead.findMany({
        where: {
          status: { in: ["lost", "dead"] },
          createdAt: { gte: since, lte: until },
        },
        take: 500,
      });
    });

    let created = 0;
    for (const lead of candidates) {
      const has = await prisma.task.findFirst({
        where: { leadId: lead.id, kind: "reactivation", status: "open" },
      });
      if (has) continue;
      const repId = lead.assignedRepId ?? (await fallbackRep(lead.rooftopId));
      if (!repId) continue;

      await prisma.task.create({
        data: {
          rooftopId: lead.rooftopId,
          userId: repId,
          kind: "reactivation",
          leadId: lead.id,
          title: `Reactivation candidate (${Math.round((Date.now() - new Date(lead.createdAt).getTime()) / (24 * 60 * 60 * 1000))}d ago)`,
          body: "Cold lead. Try a new angle: trade-in pitch or fresh inventory drop.",
          priority: 0.35,
        },
      });
      created++;
    }

    return { candidates: candidates.length, tasksCreated: created };
  },
);

async function fallbackRep(rooftopId: string) {
  const r = await prisma.user.findFirst({ where: { rooftopId, role: "rep", active: true } });
  return r?.id ?? null;
}
