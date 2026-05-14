import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { qualifyProspect } from "@/outreach/qualify";

// Scores freshly-sourced prospects for fit before they're ever dialed. Runs on
// a short cron so the prospect list doesn't sit full of un-triaged `new` rows,
// and also reacts immediately when a sourcing run finishes.

const BATCH = 25;

export const outreachQualifier = inngest.createFunction(
  { id: "outreach-qualifier", name: "Outreach prospect qualifier" },
  [{ cron: "*/5 * * * *" }, { event: "outreach/prospects.sourced" }],
  async ({ event, step }) => {
    // When triggered by a sourcing run, prefer that exact set; otherwise sweep.
    const ids: string[] = event?.data?.prospectIds ?? [];

    const prospects = await step.run("pick-prospects", () =>
      prisma.prospect.findMany({
        where: ids.length ? { id: { in: ids }, status: "new" } : { status: "new" },
        select: { id: true },
        take: BATCH,
        orderBy: { createdAt: "asc" },
      }),
    );

    let qualified = 0;
    let disqualified = 0;
    for (const p of prospects) {
      const r = await step.run(`qualify-${p.id}`, () => qualifyProspect(p.id));
      if (r?.qualified) qualified++;
      else if (r) disqualified++;
    }
    return { scanned: prospects.length, qualified, disqualified };
  },
);
