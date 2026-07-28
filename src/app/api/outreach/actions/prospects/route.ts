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

const PurgeBody = z.object({
  op: z.literal("purge-category"),
  category: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = await req.json();

  // Bulk purge — deletes every prospect in a given category along with their
  // calls, turns, tool calls, and targets. Removes their targets from every
  // campaign so no dispatcher tick can pick them back up. Meant for cleanup
  // when an operator decides a whole vertical isn't worth pursuing.
  const purge = PurgeBody.safeParse(raw);
  if (purge.success) {
    const category = purge.data.category;
    const prospects = await prisma.prospect.findMany({ where: { category }, select: { id: true } });
    const prospectIds = prospects.map(p => p.id);
    if (prospectIds.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

    // Cascade manually — schema has no onDelete: Cascade.
    const callIds = (await prisma.outreachCall.findMany({
      where: { prospectId: { in: prospectIds } },
      select: { id: true },
    })).map(c => c.id);

    await prisma.$transaction([
      prisma.outreachToolCall.deleteMany({ where: { callId: { in: callIds } } }),
      prisma.outreachTurn.deleteMany({ where: { callId: { in: callIds } } }),
      prisma.outreachCall.deleteMany({ where: { prospectId: { in: prospectIds } } }),
      prisma.outreachTarget.deleteMany({ where: { prospectId: { in: prospectIds } } }),
      prisma.prospect.deleteMany({ where: { id: { in: prospectIds } } }),
    ]);

    return NextResponse.json({ ok: true, deleted: prospectIds.length, category });
  }

  const parsed = Body.safeParse(raw);
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
