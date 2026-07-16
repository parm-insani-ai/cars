import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Small polling endpoint for the GTM overview's "on the line right now" panel.
// Returns every outreach call currently in progress, freshest first.
//
// Kept intentionally cheap — the widget polls this every ~4 seconds. Only
// pulls the columns the client actually renders so payload stays tiny.

export const runtime = "nodejs";

export async function GET() {
  const live = await prisma.outreachCall.findMany({
    where: { status: "in_progress" },
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
