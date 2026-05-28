import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { placeOutboundCall } from "@/integrations/vapi";
import { env, outreachVapiReady } from "@/lib/env";

// Places a single outbound AI sales call to a number you specify — meant for
// testing the voice loop end-to-end without needing campaigns or the Inngest
// dispatcher. Admin-gated. Uses a throwaway "Test calls" campaign + prospect.

const Body = z.object({ phone: z.string().min(8).max(20) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const phone = parsed.data.phone.trim();

  if (!outreachVapiReady()) {
    return NextResponse.json(
      {
        error: "vapi_not_configured",
        detail: "Set VAPI_API_KEY, VAPI_OUTREACH_ASSISTANT_ID, and VAPI_OUTREACH_PHONE_NUMBER_ID in .env, then restart the app.",
      },
      { status: 400 },
    );
  }

  // Reuse (or create) a dedicated test campaign so the rep has a pitch + goal.
  let campaign = await prisma.outreachCampaign.findFirst({ where: { name: "Test calls" } });
  if (!campaign) {
    campaign = await prisma.outreachCampaign.create({
      data: {
        name: "Test calls",
        status: "draft",
        goal: "This is a test call. Introduce the product, give a short natural pitch, and ask if the line sounds clear.",
        pitch: `${env.OUTREACH_COMPANY_NAME} is an AI phone receptionist that answers every call, books appointments, and follows up so a business never misses a customer.`,
        offer: "First 14 days free.",
        repName: "Alex",
      },
    });
  }

  // Reuse (or create) a prospect for this number so the call has context.
  const prospect = await prisma.prospect.upsert({
    where: { source_externalId: { source: "manual", externalId: `test:${phone}` } },
    create: {
      source: "manual",
      externalId: `test:${phone}`,
      businessName: "Test Business",
      category: "day_spa",
      categoryGroup: "wellness",
      phone,
      status: "new",
    },
    update: { phone },
  });

  const call = await prisma.outreachCall.create({
    data: {
      prospectId: prospect.id,
      campaignId: campaign.id,
      direction: "outbound",
      status: "in_progress",
      fromNumber: "test",
      toNumber: phone,
      startedAt: new Date(),
    },
  });

  try {
    const placed = await placeOutboundCall({
      assistantId: env.VAPI_OUTREACH_ASSISTANT_ID,
      phoneNumberId: env.VAPI_OUTREACH_PHONE_NUMBER_ID,
      customer: { number: phone },
      metadata: { outreachCallId: call.id, prospectId: prospect.id, campaignId: campaign.id },
    });
    await prisma.outreachCall.update({ where: { id: call.id }, data: { vapiCallId: placed.id } });
    return NextResponse.json({ ok: true, callId: call.id });
  } catch (err) {
    await prisma.outreachCall.update({ where: { id: call.id }, data: { status: "failed" } });
    return NextResponse.json(
      { error: "call_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
