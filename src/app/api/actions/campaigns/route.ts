import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { subDays } from "date-fns";

const CreateOrPreviewBody = z.object({
  name: z.string(),
  goal: z.string(),
  lapsedDays: z.number().int().min(0).max(3650),
  requireSmsConsent: z.boolean(),
  quietStartHour: z.number().int().min(0).max(23),
  quietEndHour: z.number().int().min(0).max(23),
  ratePerMinute: z.number().int().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const url = new URL(req.url);
  const op = url.searchParams.get("op");

  if (op === "preview" || op === "create") {
    const parsed = CreateOrPreviewBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const b = parsed.data;

    const since = subDays(new Date(), b.lapsedDays);
    // Eligible customers: have a phone, optionally have sms consent, and either
    // no appointments OR last appointment older than `since`.
    const customers = await prisma.customer.findMany({
      where: {
        businessId: user.businessId,
        phone: { not: null },
        ...(b.requireSmsConsent ? { smsConsent: true } : {}),
        OR: [
          { appointments: { none: {} } },
          { appointments: { every: { scheduledAt: { lt: since } } } },
        ],
      },
      select: { id: true },
      take: 5000,
    });

    if (op === "preview") {
      return NextResponse.json({ count: customers.length });
    }

    // op === "create"
    if (!b.name.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
    const campaign = await prisma.campaign.create({
      data: {
        businessId: user.businessId,
        name: b.name,
        goal: b.goal,
        quietStartHour: b.quietStartHour,
        quietEndHour: b.quietEndHour,
        ratePerMinute: b.ratePerMinute,
        filterDef: { lapsedDays: b.lapsedDays, requireSmsConsent: b.requireSmsConsent } as any,
        status: "draft",
      },
    });
    if (customers.length > 0) {
      await prisma.campaignTarget.createMany({
        data: customers.map(c => ({ campaignId: campaign.id, customerId: c.id })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({ campaignId: campaign.id });
  }

  if (op === "start" || op === "pause" || op === "cancel") {
    const { campaignId } = await req.json() as { campaignId: string };
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, businessId: user.businessId } });
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const newStatus = op === "start" ? "running" : op === "pause" ? "paused" : "canceled";
    await prisma.campaign.update({
      where: { id: c.id },
      data: { status: newStatus, startsAt: op === "start" && !c.startsAt ? new Date() : c.startsAt },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_op" }, { status: 400 });
}
