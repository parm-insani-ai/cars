import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { packFor } from "@/packs";

// Fires when a call ends. Schedules follow-ups based on outcome:
// - booked: schedule pre-appointment reminder
// - no_action / hung_up / voicemail: schedule a first-call follow-up
//   (vertical decides whether to do this at all)
// - message_taken / transferred: nothing further from us; humans take it
//
// Each follow-up becomes a FollowUp row, then a separate worker dispatches.
export const postCallFollowup = inngest.createFunction(
  { id: "post-call-followup", name: "Post-call follow-up scheduler" },
  { event: "call/ended" },
  async ({ event, step }) => {
    const { callSessionId } = event.data;
    const session = await step.run("load-session", () =>
      prisma.callSession.findUnique({
        where: { id: callSessionId },
        include: { business: true, customer: true },
      }),
    );
    if (!session) return { skipped: "no_session" };
    const pack = packFor(session.business.vertical);

    if (session.outcome === "booked" && session.bookedApptId) {
      const appt = await prisma.appointment.findUnique({ where: { id: session.bookedApptId } });
      if (appt) {
        const remindAt = new Date(appt.scheduledAt.getTime() - pack.followUpPolicy.preApptReminderHoursBefore * 3600_000);
        if (remindAt > new Date()) {
          await prisma.followUp.create({
            data: {
              businessId: session.businessId,
              customerId: session.customerId,
              apptId: appt.id,
              callSessionId: session.id,
              kind: "pre_appt_reminder",
              channel: "sms",
              scheduledFor: remindAt,
              status: "scheduled",
            },
          });
        }
      }
      return { scheduled: "pre_appt_reminder" };
    }

    if (session.outcome === "no_action" || session.outcome === "hung_up") {
      const hours = pack.followUpPolicy.firstCallFollowupHoursAfter;
      if (hours == null) return { skipped: "vertical_no_first_call_followup" };
      if (!session.customerId) return { skipped: "anonymous_caller" };
      await prisma.followUp.create({
        data: {
          businessId: session.businessId,
          customerId: session.customerId,
          callSessionId: session.id,
          kind: "post_call_followup",
          channel: "sms",
          scheduledFor: new Date(Date.now() + hours * 3600_000),
          status: "scheduled",
        },
      });
      return { scheduled: "post_call_followup" };
    }

    if (session.outcome === "voicemail") {
      // Customer didn't connect to a human — schedule a callback fast.
      await prisma.followUp.create({
        data: {
          businessId: session.businessId,
          customerId: session.customerId,
          callSessionId: session.id,
          kind: "missed_call_callback",
          channel: "voice",
          scheduledFor: new Date(Date.now() + pack.followUpPolicy.missedCallCallbackMinutesAfter * 60_000),
          status: "scheduled",
        },
      });
      return { scheduled: "missed_call_callback" };
    }

    return { outcome: session.outcome, skipped: true };
  },
);
