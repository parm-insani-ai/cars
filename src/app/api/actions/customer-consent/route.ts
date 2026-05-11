import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  customerId: z.string(),
  field: z.enum(["smsConsent", "emailConsent"]),
  value: z.boolean(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { customerId, field, value } = parsed.data;
  await prisma.customer.update({
    where: { id: customerId, businessId: user.businessId } as any,
    data: {
      [field]: value,
      tags: { push: `consent_${field}_${value ? "granted" : "revoked"}_${user.id}_${Date.now()}` },
    },
  });
  return NextResponse.json({ ok: true });
}
