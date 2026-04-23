import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { processServiceDrive } from "@/domain/opportunities";
import { draftServicePitch } from "@/ai/drafts";

// When a service RO is created, score equity, match inventory, create an
// opportunity + rep task, and draft the pitch.
export const serviceOppOnROCreated = inngest.createFunction(
  { id: "service-opp-on-ro-created", name: "Service-drive upgrade opportunity" },
  { event: "service-ro/created" },
  async ({ event, step }) => {
    const { serviceROId } = event.data;

    const opp = await step.run("process", () => processServiceDrive(serviceROId));
    if (!opp) return { skipped: "not_upgrade_ready_or_no_match" };

    await step.run("draft-pitch", async () => {
      const result = await draftServicePitch(opp.id);
      const task = await prisma.task.findFirst({
        where: { opportunityId: opp.id, kind: "service_opp", status: "open" },
      });
      if (task && result.finalText) {
        await prisma.recommendation.create({
          data: {
            rooftopId: opp.rooftopId,
            taskId: task.id,
            userId: task.userId,
            draftChannel: "sms",
            draftBody: tryExtract(result.finalText, "sms"),
            talkTrack: tryExtract(result.finalText, "talk_track"),
            model: "claude-sonnet-4-6",
            rationale: opp.rationale ?? undefined,
          },
        });
      }
    });

    return { opportunityId: opp.id };
  },
);

function tryExtract(jsonish: string, key: "sms" | "talk_track"): string {
  const m = jsonish.match(/\{[\s\S]*\}/);
  if (!m) return jsonish;
  try {
    const o = JSON.parse(m[0]);
    return String(o[key] ?? jsonish);
  } catch {
    return jsonish;
  }
}
