import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Per-prospect admin actions: suppress (do-not-call) and re-qualify.

const Body = z.object({
  prospectId: z.string(),
  op: z.enum(["suppress", "unsuppress", "requalify"]),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { prospectId, op, note } = parsed.data;

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (op === "suppress") {
    if (prospect.phone) {
      await prisma.suppressionEntry.upsert({
        where: { phone: prospect.phone },
        create: { phone: prospect.phone, reason: "manual", note: note ?? null },
        update: { reason: "manual", note: note ?? null },
      });
    }
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { doNotCall: true, status: "do_not_call", disposition: "do_not_call" },
    });
    await prisma.outreachTarget.updateMany({
      where: { prospectId, status: { in: ["pending", "calling"] } },
      data: { status: "opted_out", outcomeNote: "Manually suppressed" },
    });
    return NextResponse.json({ ok: true });
  }

  if (op === "unsuppress") {
    if (prospect.phone) {
      await prisma.suppressionEntry.deleteMany({ where: { phone: prospect.phone } });
    }
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { doNotCall: false, status: "new", disposition: null },
    });
    return NextResponse.json({ ok: true });
  }

  // requalify
  const { qualifyProspect } = await import("@/outreach/qualify");
  await prisma.prospect.update({ where: { id: prospectId }, data: { status: "new" } });
  const result = await qualifyProspect(prospectId);
  return NextResponse.json({ ok: true, result });
}
