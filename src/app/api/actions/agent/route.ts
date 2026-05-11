import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  greeting: z.string().min(1),
  personality: z.string().min(1),
  voiceProvider: z.string().min(1),
  voiceId: z.string().min(1),
  language: z.string().min(1),
  canBook: z.boolean(),
  canReschedule: z.boolean(),
  canCancel: z.boolean(),
  canTransfer: z.boolean(),
  transferTo: z.string().nullable(),
  smsFooter: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await prisma.agentConfig.update({
    where: { businessId: user.businessId },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
