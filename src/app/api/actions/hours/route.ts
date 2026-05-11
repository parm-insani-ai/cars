import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  hours: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    closed: z.boolean(),
    openMin: z.number().int().min(0).max(1440),
    closeMin: z.number().int().min(0).max(1440),
  })),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await prisma.$transaction(async tx => {
    await tx.businessHours.deleteMany({ where: { businessId: user.businessId } });
    for (const h of parsed.data.hours) {
      if (h.closed) continue;
      await tx.businessHours.create({
        data: {
          businessId: user.businessId,
          dayOfWeek: h.dayOfWeek,
          openMin: h.openMin,
          closeMin: h.closeMin,
        },
      });
    }
  });
  return NextResponse.json({ ok: true });
}
