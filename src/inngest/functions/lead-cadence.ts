import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { draftFirstResponse, draftFollowup } from "@/ai/drafts";

// Orchestrates the multi-step lead cadence. For each step we draft a message
// but DO NOT autosend — we create/update a task so the rep can hit send.
// Steps stop when the lead is engaged or goes dead.
export const leadCadence = inngest.createFunction(
  { id: "lead-cadence", name: "Lead cadence (first response + nudges)" },
  { event: "lead/created" },
  async ({ event, step }) => {
    const { leadId } = event.data;

    // Step 1: draft the first response immediately.
    const firstDraft = await step.run("draft-first-response", async () => {
      const result = await draftFirstResponse(leadId);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
      const task = await prisma.task.findFirst({
        where: { leadId, kind: "first_response", status: "open" },
      });
      if (task && result.finalText) {
        await prisma.recommendation.create({
          data: {
            rooftopId: lead.rooftopId,
            taskId: task.id,
            userId: task.userId,
            leadId,
            draftChannel: "sms",
            draftBody: result.finalText,
            model: "claude-sonnet-4-6",
            rationale: "First-response draft (new lead).",
          },
        });
      }
      return { text: result.finalText };
    });

    // Steps 2..4: wait-then-nudge cadence.
    const nudgeDelays: Array<{ step: string; ms: number; attempt: number }> = [
      { step: "wait-1h", ms: 60 * 60 * 1000, attempt: 2 },
      { step: "wait-24h", ms: 24 * 60 * 60 * 1000, attempt: 3 },
      { step: "wait-3d", ms: 3 * 24 * 60 * 60 * 1000, attempt: 4 },
    ];

    for (const { step: stepName, ms, attempt } of nudgeDelays) {
      await step.sleep(stepName, ms);

      const lead = await step.run(`check-${stepName}`, () =>
        prisma.lead.findUnique({ where: { id: leadId } }),
      );
      if (!lead) return { stopped: "lead_deleted" };
      if (["appointment_set", "appointment_shown", "sold", "lost", "dead"].includes(lead.status)) {
        return { stopped: lead.status };
      }

      await step.run(`draft-nudge-${attempt}`, async () => {
        const result = await draftFollowup(leadId, attempt);
        if (!result.finalText) return;
        await prisma.task.create({
          data: {
            rooftopId: lead.rooftopId,
            userId: lead.assignedRepId ?? (await fallbackRep(lead.rooftopId)),
            kind: "followup",
            leadId,
            title: `Follow-up #${attempt}`,
            body: `Drafted a fresh angle — review and send.`,
            priority: Math.max(0.25, lead.score * 0.8),
          },
        });
        await prisma.recommendation.create({
          data: {
            rooftopId: lead.rooftopId,
            userId: lead.assignedRepId ?? (await fallbackRep(lead.rooftopId)),
            leadId,
            draftChannel: "sms",
            draftBody: result.finalText,
            model: "claude-sonnet-4-6",
            rationale: `Follow-up attempt ${attempt}.`,
          },
        });
      });
    }

    return { completed: true, firstDraft };
  },
);

async function fallbackRep(rooftopId: string): Promise<string> {
  const r = await prisma.user.findFirst({ where: { rooftopId, role: "rep", active: true } });
  if (!r) throw new Error("No active rep available to assign follow-up");
  return r.id;
}
