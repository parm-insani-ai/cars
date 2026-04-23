import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { smsAdapter } from "@/integrations/twilio";
import { emailAdapter } from "@/integrations/sendgrid";

const Body = z.object({
  recommendationId: z.string(),
  userId: z.string(),         // approver — in production this comes from auth
  overrideBody: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { recommendationId, userId, overrideBody } = parsed.data;

  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    include: { user: true },
  });
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!rec.leadId) return NextResponse.json({ error: "no_lead" }, { status: 400 });
  if (!rec.draftChannel || !rec.draftBody) return NextResponse.json({ error: "no_draft" }, { status: 400 });

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: rec.leadId },
    include: { customer: true },
  });

  const body = overrideBody?.trim() || rec.draftBody;

  // TCPA check: no SMS without consent.
  if (rec.draftChannel === "sms" && !lead.customer.smsConsent) {
    return NextResponse.json({ error: "no_sms_consent" }, { status: 403 });
  }

  let externalId = "";
  let sentAt = new Date();

  if (rec.draftChannel === "sms" && lead.customer.phone) {
    const res = await smsAdapter().send({ rooftopId: rec.rooftopId, to: lead.customer.phone, body });
    externalId = res.externalId;
    sentAt = res.sentAt;
  } else if (rec.draftChannel === "email" && lead.customer.email) {
    const res = await emailAdapter().send({
      rooftopId: rec.rooftopId,
      to: lead.customer.email,
      subject: `From ${rec.user.name}`,
      body,
    });
    externalId = res.externalId;
    sentAt = res.sentAt;
  } else {
    return NextResponse.json({ error: "no_channel_address" }, { status: 400 });
  }

  // Persist the sent message + mark the task done + update lead state.
  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        leadId: lead.id,
        channel: rec.draftChannel!,
        direction: "outbound",
        body,
        draftedBy: "ai",
        approvedByUserId: userId,
        externalId,
        sentAt,
      },
    });

    if (rec.taskId) {
      await tx.task.update({
        where: { id: rec.taskId },
        data: { status: "done", updatedAt: new Date() },
      });
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        firstResponseAt: lead.firstResponseAt ?? new Date(),
        status: lead.status === "new" ? "engaged" : lead.status,
      },
    });

    await tx.customer.update({
      where: { id: lead.customerId },
      data: { lastContactAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, externalId });
}
