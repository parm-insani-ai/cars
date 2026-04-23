import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  leadId: z.string(),
  userId: z.string(),
  scheduledAt: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { leadId, userId, scheduledAt, notes } = parsed.data;

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  const appt = await prisma.appointment.create({
    data: {
      rooftopId: lead.rooftopId,
      leadId,
      customerId: lead.customerId,
      repId: userId,
      vehicleId: lead.interestVehicleId,
      scheduledAt: new Date(scheduledAt),
      status: "set",
      notes,
      source: "ai",
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "appointment_set" },
  });

  // Tag the customer as Revline-influenced so attribution works later.
  await prisma.customer.update({
    where: { id: lead.customerId },
    data: { tags: { push: "revline_influenced" } },
  });

  return NextResponse.json({ ok: true, appointmentId: appt.id });
}
