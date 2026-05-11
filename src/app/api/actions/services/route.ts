import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    name: z.string().min(1),
    category: z.string().nullable().optional(),
    durationMin: z.number().int().positive(),
    priceUsd: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
    providerKind: z.string().nullable().optional(),
  }),
  z.object({ op: z.literal("toggle"), id: z.string(), active: z.boolean() }),
  z.object({ op: z.literal("delete"), id: z.string() }),
]);

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const b = parsed.data;
  if (b.op === "create") {
    await prisma.service.create({
      data: {
        businessId: user.businessId,
        name: b.name,
        category: b.category ?? null,
        durationMin: b.durationMin,
        priceUsd: b.priceUsd ?? null,
        description: b.description ?? null,
        providerKind: b.providerKind ?? null,
      },
    });
  } else if (b.op === "toggle") {
    const svc = await prisma.service.findFirst({ where: { id: b.id, businessId: user.businessId } });
    if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.service.update({ where: { id: svc.id }, data: { active: b.active } });
  } else if (b.op === "delete") {
    const svc = await prisma.service.findFirst({ where: { id: b.id, businessId: user.businessId } });
    if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.service.delete({ where: { id: svc.id } });
  }
  return NextResponse.json({ ok: true });
}
