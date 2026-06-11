import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Returns the live in-progress CallSession for the business, if any. Polled
// every few seconds by the home page's LiveCallStrip so owners can see when
// a caller is on the line and click straight into the live transcript.

export async function GET() {
  const user = await requireUser();

  // Only sessions started in the last hour are eligible — guards against
  // stale rows from calls that never got an end-of-call-report.
  const recentCutoff = new Date(Date.now() - 60 * 60 * 1000);

  const live = await prisma.callSession.findFirst({
    where: {
      businessId: user.businessId,
      outcome: "in_progress",
      endedAt: null,
      startedAt: { gte: recentCutoff },
    },
    include: { customer: true },
    orderBy: { startedAt: "desc" },
  });

  if (!live) return NextResponse.json({ live: null });

  const name = live.customer
    ? `${live.customer.firstName ?? ""} ${live.customer.lastName ?? ""}`.trim() || live.fromNumber
    : live.fromNumber;

  return NextResponse.json({
    live: {
      id: live.id,
      direction: live.direction,
      name,
      fromNumber: live.fromNumber,
      startedAt: live.startedAt.toISOString(),
    },
  });
}
