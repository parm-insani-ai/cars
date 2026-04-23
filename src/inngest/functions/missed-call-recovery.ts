import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { draftMissedCallSms } from "@/ai/drafts";

// Missed call → within 2 min we draft a callback SMS and open a task with
// a 15-min SLA. If not worked in 10 min, we escalate to the manager.
export const missedCallRecovery = inngest.createFunction(
  { id: "missed-call-recovery", name: "Missed-call recovery" },
  { event: "call/missed" },
  async ({ event, step }) => {
    const { callId } = event.data;

    // Draft the callback SMS.
    const drafted = await step.run("draft-callback", async () => {
      const result = await draftMissedCallSms(callId);
      return result.finalText;
    });

    // Create the task (SLA: 15 min).
    const task = await step.run("create-task", async () => {
      const call = await prisma.callEvent.findUniqueOrThrow({ where: { id: callId } });

      const rep =
        (call.repId && (await prisma.user.findUnique({ where: { id: call.repId } }))) ||
        (await prisma.user.findFirst({
          where: { rooftopId: call.rooftopId, role: "rep", active: true },
        }));
      if (!rep) return null;

      const slaAt = new Date(Date.now() + 15 * 60 * 1000);
      const t = await prisma.task.create({
        data: {
          rooftopId: call.rooftopId,
          userId: rep.id,
          kind: "missed_call_recovery",
          title: `Missed ${call.department ?? "sales"} call — ${call.fromNumber}`,
          body: `Caller ${call.fromNumber} at ${call.startedAt.toLocaleTimeString()}. Draft ready.`,
          slaAt,
          priority: 0.85, // high — hot missed call
        },
      });

      if (drafted) {
        await prisma.recommendation.create({
          data: {
            rooftopId: call.rooftopId,
            taskId: t.id,
            userId: rep.id,
            draftChannel: "sms",
            draftBody: drafted,
            model: "claude-sonnet-4-6",
            rationale: "Missed-call callback.",
          },
        });
      }
      return t;
    });

    if (!task) return { skipped: "no_rep_available" };

    // Wait 10 min, escalate if still open.
    await step.sleep("wait-sla", 10 * 60 * 1000);

    await step.run("maybe-escalate", async () => {
      const fresh = await prisma.task.findUnique({ where: { id: task.id } });
      if (!fresh) return;
      if (fresh.status !== "open") return;
      await prisma.task.update({ where: { id: fresh.id }, data: { status: "escalated" } });
      await prisma.alert.create({
        data: {
          rooftopId: fresh.rooftopId,
          kind: "missed_call_escalation",
          severity: "warn",
          title: "Missed-call SLA breach",
          body: fresh.title,
          entityRef: `task:${fresh.id}`,
        },
      });
    });

    return { taskId: task.id };
  },
);
