import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  taskId: z.string(),
  action: z.enum(["dismiss", "snooze", "done", "escalate"]),
  snoozeMinutes: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { taskId, action, snoozeMinutes } = parsed.data;

  let status: "dismissed" | "snoozed" | "done" | "escalated" = "done";
  if (action === "dismiss") status = "dismissed";
  else if (action === "snooze") status = "snoozed";
  else if (action === "escalate") status = "escalated";

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(action === "snooze" && snoozeMinutes
        ? { dueAt: new Date(Date.now() + snoozeMinutes * 60_000) }
        : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
