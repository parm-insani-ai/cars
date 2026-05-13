import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  enabled: z.boolean(),
  defaultDepositCents: z.number().int().min(0).nullable(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await prisma.business.update({
    where: { id: user.businessId },
    data: { depositsEnabled: parsed.data.enabled, defaultDepositCents: parsed.data.defaultDepositCents },
  });
  return NextResponse.json({ ok: true });
}
