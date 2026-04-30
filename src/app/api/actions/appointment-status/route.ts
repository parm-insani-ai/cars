import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  apptId: z.string(),
  status: z.enum(["set", "confirmed", "shown", "no_show", "canceled", "sold"]),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const appt = await prisma.appointment.findFirst({
    where: { id: parsed.data.apptId, rooftopId: user.rooftopId },
  });
  if (!appt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: parsed.data.status },
  });

  // Promote lead status if relevant.
  if (appt.leadId) {
    const newLeadStatus =
      parsed.data.status === "shown"
        ? "appointment_shown"
        : parsed.data.status === "sold"
          ? "sold"
          : parsed.data.status === "canceled" || parsed.data.status === "no_show"
            ? "engaged"
            : null;
    if (newLeadStatus) {
      await prisma.lead.update({
        where: { id: appt.leadId },
        data: { status: newLeadStatus },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
