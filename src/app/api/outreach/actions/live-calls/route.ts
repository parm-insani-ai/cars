import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Small polling endpoint for the GTM overview's "on the line right now" panel.
// Returns every outreach call currently in progress, freshest first.
//
// Kept intentionally cheap — the widget polls this every ~4 seconds. Only
// pulls the columns the client actually renders so payload stays tiny.

export const runtime = "nodejs";
// Force per-request evaluation. Without this Next.js tries to statically
// prerender the route at build time because GET() takes no arguments — but
// the function calls prisma.findMany(), which needs a live DB connection.
// Build fails with "Error occurred prerendering page /api/outreach/actions/
// live-calls" every time. Marking dynamic tells Next this endpoint is a
// per-request runtime handler, not a static asset.
export const dynamic = "force-dynamic";

export async function GET() {
  // Only show truly-live calls. Vapi caps calls at ~10 minutes, so anything
  // still marked in_progress after 15 minutes is a zombie — the end-of-call
  // webhook never landed (or landed but the update failed) and it's been
  // stuck for hours or days. Filtering by startedAt keeps the widget honest
  // even when the DB has stale rows; a background sweep still cleans them up.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const live = await prisma.outreachCall.findMany({
    where: { status: "in_progress", startedAt: { gte: cutoff } },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      startedAt: true,
      toNumber: true,
      prospect: { select: { id: true, businessName: true, city: true } },
      campaign: { select: { name: true } },
    },
  });

  // Best-effort reaper: any older in_progress row is safely dead. Mark them
  // failed with a note so the operator can see WHY they stopped. Fire-and-
  // forget so it doesn't slow the poll.
  prisma.outreachCall.updateMany({
    where: { status: "in_progress", startedAt: { lt: cutoff } },
    data: { status: "failed", endedAt: new Date(), summary: "Stale call — end-of-call webhook never received." },
  }).catch(err => console.error("[live-calls] reaper failed:", err));

  // Also reap the OutreachTargets that were left in "calling" — they'll block
  // reopening a campaign otherwise, and if the call is dead the target should
  // be back to "pending" so the dispatcher retries.
  prisma.outreachTarget.updateMany({
    where: { status: "calling", lastAttemptAt: { lt: cutoff } },
    data: { status: "pending" },
  }).catch(err => console.error("[live-calls] target reaper failed:", err));

  return NextResponse.json(
    {
      live: live.map(c => ({
        id: c.id,
        prospectId: c.prospect.id,
        businessName: c.prospect.businessName,
        city: c.prospect.city,
        toNumber: c.toNumber,
        campaignName: c.campaign?.name ?? null,
        startedAt: c.startedAt.toISOString(),
      })),
    },
    // Prevent any layer from caching the response — this list must be fresh
    // every poll or the widget's "elapsed" counter drifts.
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
