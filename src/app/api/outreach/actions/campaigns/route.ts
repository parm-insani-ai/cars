import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// Create / preview / control outreach (GTM) campaigns. Admin-gated.

const CreateOrPreviewBody = z.object({
  name: z.string(),
  goal: z.string(),
  pitch: z.string(),
  offer: z.string().optional(),
  repName: z.string().min(1).max(40),
  categoryGroups: z.array(z.enum(["home_services", "wellness", "auto_retail"])).min(1),
  minScore: z.number().int().min(0).max(100),
  quietStartHour: z.number().int().min(0).max(23),
  quietEndHour: z.number().int().min(0).max(23),
  ratePerMinute: z.number().int().min(1).max(20),
  maxAttempts: z.number().int().min(1).max(10),
});

// Prospects eligible for a campaign: qualified, in one of the chosen business
// groups, scored high enough, reachable, and not already suppressed/won/lost.
function audienceWhere(b: z.infer<typeof CreateOrPreviewBody>): Prisma.ProspectWhereInput {
  return {
    status: "qualified",
    categoryGroup: { in: b.categoryGroups },
    score: { gte: b.minScore },
    phone: { not: null },
    doNotCall: false,
  };
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const op = new URL(req.url).searchParams.get("op");

  if (op === "preview" || op === "create") {
    const parsed = CreateOrPreviewBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const b = parsed.data;

    const prospects = await prisma.prospect.findMany({
      where: audienceWhere(b),
      select: { id: true },
      take: 5000,
    });

    if (op === "preview") return NextResponse.json({ count: prospects.length });

    if (!b.name.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
    const campaign = await prisma.outreachCampaign.create({
      data: {
        name: b.name,
        goal: b.goal,
        pitch: b.pitch,
        offer: b.offer || null,
        repName: b.repName,
        quietStartHour: b.quietStartHour,
        quietEndHour: b.quietEndHour,
        ratePerMinute: b.ratePerMinute,
        maxAttempts: b.maxAttempts,
        filterDef: { categoryGroups: b.categoryGroups, minScore: b.minScore } as any,
        status: "draft",
      },
    });
    if (prospects.length > 0) {
      await prisma.outreachTarget.createMany({
        data: prospects.map(p => ({ campaignId: campaign.id, prospectId: p.id })),
        skipDuplicates: true,
      });
      await prisma.prospect.updateMany({
        where: { id: { in: prospects.map(p => p.id) }, status: "qualified" },
        data: { status: "queued" },
      });
    }
    return NextResponse.json({ campaignId: campaign.id });
  }

  if (op === "settings") {
    // Live-edit pacing/quiet-hour settings on an existing campaign. Handy
    // when a running campaign needs a wider dial window without cancelling
    // and rebuilding it from scratch.
    const body = (await req.json()) as {
      campaignId: string;
      quietStartHour?: number;
      quietEndHour?: number;
      ratePerMinute?: number;
      maxAttempts?: number;
    };
    if (!body.campaignId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const patch: Prisma.OutreachCampaignUpdateInput = {};
    if (typeof body.quietStartHour === "number" && body.quietStartHour >= 0 && body.quietStartHour <= 23) {
      patch.quietStartHour = body.quietStartHour;
    }
    if (typeof body.quietEndHour === "number" && body.quietEndHour >= 0 && body.quietEndHour <= 23) {
      patch.quietEndHour = body.quietEndHour;
    }
    if (typeof body.ratePerMinute === "number" && body.ratePerMinute >= 1 && body.ratePerMinute <= 20) {
      patch.ratePerMinute = body.ratePerMinute;
    }
    if (typeof body.maxAttempts === "number" && body.maxAttempts >= 1 && body.maxAttempts <= 10) {
      patch.maxAttempts = body.maxAttempts;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
    }
    await prisma.outreachCampaign.update({ where: { id: body.campaignId }, data: patch });
    return NextResponse.json({ ok: true });
  }

  if (op === "start" || op === "pause" || op === "cancel") {
    const { campaignId } = (await req.json()) as { campaignId: string };
    const c = await prisma.outreachCampaign.findUnique({ where: { id: campaignId } });
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const status = op === "start" ? "running" : op === "pause" ? "paused" : "canceled";

    // Reopening a canceled or completed campaign: reset every non-terminal
    // target back to "pending" so the dispatcher will pick them up again.
    // "Failed" is included here because most failures are infrastructure or
    // transient (Vapi rate-limit, DB outage, network blip) — the operator's
    // explicit "reopen" click means "try these again." Genuinely won't-retry
    // outcomes ("completed", "opted_out") stay put. We still respect the
    // per-target maxAttempts ceiling so nobody gets dialed forever.
    if (op === "start" && (c.status === "canceled" || c.status === "completed")) {
      await prisma.outreachTarget.updateMany({
        where: {
          campaignId: c.id,
          status: { in: ["skipped", "calling", "failed"] },
          attempts: { lt: c.maxAttempts },
        },
        data: { status: "pending", nextAttemptAt: null, outcomeNote: null },
      });
    }

    await prisma.outreachCampaign.update({
      where: { id: c.id },
      data: {
        status,
        startsAt: op === "start" && !c.startsAt ? new Date() : c.startsAt,
        // Reopening clears the completed timestamp so /outreach/campaigns
        // doesn't still show it as a finished run.
        completedAt: op === "start" ? null : c.completedAt,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_op" }, { status: 400 });
}
