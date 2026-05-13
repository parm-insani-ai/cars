import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  name: z.string().min(1).max(120),
  phoneNumber: z.string().nullable(),
  smsFromNumber: z.string().nullable(),
  timezone: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await prisma.business.update({
    where: { id: user.businessId },
    data: {
      name: parsed.data.name,
      phoneNumber: parsed.data.phoneNumber,
      smsFromNumber: parsed.data.smsFromNumber,
      timezone: parsed.data.timezone,
    },
  });
  return NextResponse.json({ ok: true });
}
