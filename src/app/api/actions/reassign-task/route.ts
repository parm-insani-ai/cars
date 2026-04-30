import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const Body = z.object({
  taskId: z.string(),
  toUserId: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await requireRole(["sales_manager", "gm", "admin"]);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { taskId, toUserId } = parsed.data;

  const task = await prisma.task.findFirst({
    where: { id: taskId, rooftopId: user.rooftopId },
  });
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const target = await prisma.user.findFirst({
    where: { id: toUserId, rooftopId: user.rooftopId },
  });
  if (!target) return NextResponse.json({ error: "no_target" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data: { userId: target.id, status: "open" } });
    if (task.leadId) {
      await tx.lead.update({ where: { id: task.leadId }, data: { assignedRepId: target.id } });
    }
  });

  return NextResponse.json({ ok: true });
}
