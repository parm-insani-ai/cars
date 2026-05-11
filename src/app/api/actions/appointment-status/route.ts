import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  apptId: z.string(),
  status: z.enum(["pending", "confirmed", "reminded", "arrived", "completed", "no_show", "canceled", "rescheduled"]),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const appt = await prisma.appointment.findFirst({
    where: { id: parsed.data.apptId, businessId: user.businessId },
  });
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
