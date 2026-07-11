import { inngest } from "../client";
import { runOutreachDispatch } from "@/outreach/dispatch";

// Inngest-scheduled version of the dispatcher. In dev, Inngest fires this
// every minute. In production, if you don't have Inngest Cloud connected,
// point cron-job.org at /api/cron/outreach-dispatch instead — same logic.

export const outreachDispatcher = inngest.createFunction(
  { id: "outreach-dispatcher", name: "Outbound sales campaign dispatcher" },
  { cron: "*/1 * * * *" },
  async () => runOutreachDispatch(),
);
