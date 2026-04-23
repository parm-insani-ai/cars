import { prisma } from "@/lib/prisma";
import type { Task } from "@prisma/client";

// Rep action feed: ranked list, capped at N. Ranking objective is
// "maximize appointments set this week" — a hand-rolled score blending
// priority, SLA breach imminence, and (implicit) expected dollar value.
export type FeedCard = {
  taskId: string;
  kind: Task["kind"];
  title: string;
  body: string | null;
  priority: number;
  slaMsRemaining: number | null;
  expectedGross: number;
  leadId: string | null;
  opportunityId: string | null;
  status: Task["status"];
  createdAt: Date;
};

export async function getRepFeed(
  rooftopId: string,
  userId: string,
  limit = 15,
): Promise<FeedCard[]> {
  const tasks = await prisma.task.findMany({
    where: { rooftopId, userId, status: "open" },
    include: {
      lead: { include: { interestVehicle: true } },
    },
    orderBy: [{ priority: "desc" }, { slaAt: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  const now = Date.now();
  return tasks.map((t) => {
    const slaMs = t.slaAt ? t.slaAt.getTime() - now : null;
    const gross = t.lead?.expectedGross ?? 0;
    return {
      taskId: t.id,
      kind: t.kind,
      title: t.title,
      body: t.body,
      priority: t.priority,
      slaMsRemaining: slaMs,
      expectedGross: gross,
      leadId: t.leadId,
      opportunityId: t.opportunityId,
      status: t.status,
      createdAt: t.createdAt,
    };
  });
}

// Manager view: same data, unscoped by rep, with SLA state flagged.
export async function getManagerFeed(rooftopId: string, limit = 50): Promise<FeedCard[]> {
  const tasks = await prisma.task.findMany({
    where: { rooftopId, status: { in: ["open", "escalated"] } },
    include: { lead: true },
    orderBy: [{ slaAt: "asc" }, { priority: "desc" }],
    take: limit,
  });

  const now = Date.now();
  return tasks.map((t) => ({
    taskId: t.id,
    kind: t.kind,
    title: t.title,
    body: t.body,
    priority: t.priority,
    slaMsRemaining: t.slaAt ? t.slaAt.getTime() - now : null,
    expectedGross: t.lead?.expectedGross ?? 0,
    leadId: t.leadId,
    opportunityId: t.opportunityId,
    status: t.status,
    createdAt: t.createdAt,
  }));
}
