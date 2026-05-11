import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), title: z.string().min(1), body: z.string().min(1), tags: z.array(z.string()) }),
  z.object({ op: z.literal("delete"), id: z.string() }),
]);

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const b = parsed.data;
  if (b.op === "create") {
    await prisma.knowledgeArticle.create({
      data: { businessId: user.businessId, title: b.title, body: b.body, tags: b.tags },
    });
  } else if (b.op === "delete") {
    const a = await prisma.knowledgeArticle.findFirst({ where: { id: b.id, businessId: user.businessId } });
    if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.knowledgeArticle.delete({ where: { id: a.id } });
  }
  return NextResponse.json({ ok: true });
}
