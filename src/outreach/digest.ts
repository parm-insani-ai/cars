import { prisma } from "@/lib/prisma";
import { smsAdapter } from "@/integrations/sms";
import { env } from "@/lib/env";

// Assembles the "yesterday's outreach" morning SMS the operator gets to see
// campaign progress without having to open the laptop. Kept intentionally
// terse — a phone lock-screen preview should convey the whole story.

const HALIFAX_TZ = "America/Halifax";

export type DailyDigest = {
  windowLabel: string;
  totalCalls: number;
  answered: number;
  voicemail: number;
  notInterested: number;
  callbacks: number;
  demosBooked: number;
  failed: number;
  topProspect: string | null;
};

// Compute stats for the last N hours (default 24) up to "now". Runs in the
// user's Halifax timezone so "yesterday" means yesterday from their
// perspective, not from UTC's.
export async function computeDailyDigest(hoursBack = 24): Promise<DailyDigest> {
  const now = new Date();
  const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  const calls = await prisma.outreachCall.findMany({
    where: { startedAt: { gte: since } },
    select: {
      status: true,
      disposition: true,
      durationSec: true,
      prospect: { select: { businessName: true } },
    },
  });

  const count = (predicate: (c: typeof calls[number]) => boolean) => calls.filter(predicate).length;

  const answered = count(c => c.disposition === "demo_booked" || c.disposition === "not_interested" || c.disposition === "callback_requested" || (!!c.durationSec && c.durationSec > 15));
  const voicemail = count(c => c.disposition === "voicemail");
  const notInterested = count(c => c.disposition === "not_interested");
  const callbacks = count(c => c.disposition === "callback_requested");
  const demosBooked = count(c => c.disposition === "demo_booked");
  const failed = count(c => c.status === "failed");

  // "Top" prospect = longest-conversation call, as a directional proxy for
  // "most engaged." Not perfect (someone can be engaged AND declining), but
  // more useful than "most recent."
  const topCall = calls
    .filter(c => (c.durationSec ?? 0) > 30)
    .sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))[0];
  const topProspect = topCall?.prospect.businessName ?? null;

  const windowLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: HALIFAX_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(since);

  return {
    windowLabel,
    totalCalls: calls.length,
    answered,
    voicemail,
    notInterested,
    callbacks,
    demosBooked,
    failed,
    topProspect,
  };
}

// Render the digest as a compact SMS body — target under 320 chars so it
// stays inside a single message on most carriers even with the URL.
export function renderDigestSms(d: DailyDigest, dashboardUrl: string): string {
  const lines = [
    `insani outreach — ${d.windowLabel}`,
    `${d.totalCalls} calls · ${d.answered} answered · ${d.demosBooked} demos`,
  ];
  const extras: string[] = [];
  if (d.callbacks > 0) extras.push(`${d.callbacks} callbacks`);
  if (d.voicemail > 0) extras.push(`${d.voicemail} voicemails`);
  if (d.notInterested > 0) extras.push(`${d.notInterested} not interested`);
  if (d.failed > 0) extras.push(`${d.failed} failed`);
  if (extras.length > 0) lines.push(extras.join(" · "));
  if (d.topProspect) lines.push(`Top engaged: ${d.topProspect}`);
  lines.push(dashboardUrl);
  return lines.join("\n");
}

// Send the digest to the operator's phone. Returns what was sent (or the
// skip reason) so the cron endpoint can log it.
export async function sendDailyDigest(): Promise<{ sent: boolean; body?: string; reason?: string }> {
  if (!env.OPERATOR_NOTIFICATION_PHONE) {
    return { sent: false, reason: "OPERATOR_NOTIFICATION_PHONE not set" };
  }
  const digest = await computeDailyDigest(24);
  if (digest.totalCalls === 0) {
    return { sent: false, reason: "no calls in the last 24h — skipping to avoid empty digests" };
  }
  const base = (process.env.PUBLIC_BASE_URL ?? "https://insani.ai").replace(/\/$/, "");
  const body = renderDigestSms(digest, `${base}/outreach`);
  const adapter = smsAdapter();
  await adapter.send({ to: env.OPERATOR_NOTIFICATION_PHONE, body });
  return { sent: true, body };
}
