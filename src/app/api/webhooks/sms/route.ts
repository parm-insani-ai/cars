import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { classifyReply } from "@/ai/classify";
import { inngest } from "@/inngest/client";

const Body = z.object({
  rooftopId: z.string(),
  fromNumber: z.string(),
  body: z.string(),
  externalId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { rooftopId: p.rooftopId, phone: p.fromNumber },
  });
  if (!customer) {
    return NextResponse.json({ error: "unknown_customer" }, { status: 404 });
  }

  // Most recent active lead for this customer.
  const lead = await prisma.lead.findFirst({
    where: {
      rooftopId: p.rooftopId,
      customerId: customer.id,
      status: { in: ["new", "engaged", "appointment_set"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Persist inbound message regardless.
  let messageId: string | null = null;
  if (lead) {
    const m = await prisma.message.create({
      data: {
        leadId: lead.id,
        channel: "sms",
        direction: "inbound",
        body: p.body,
        externalId: p.externalId,
        sentAt: new Date(),
      },
    });
    messageId = m.id;
  }

  // Classify intent (Haiku).
  let cls;
  try {
    cls = await classifyReply(p.body);
  } catch {
    cls = { intent: "ask_question" as const, proposed_time_iso: null, urgency: "warm" as const };
  }

  // Update lead state on intent.
  if (lead) {
    if (cls.intent === "opt_out") {
      await prisma.customer.update({ where: { id: customer.id }, data: { smsConsent: false } });
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "lost" } });
    } else if (cls.intent === "set_appointment" && cls.proposed_time_iso) {
      // Open a high-priority task for the rep to confirm + book.
      const repId = lead.assignedRepId ?? (await fallbackRep(lead.rooftopId));
      if (repId) {
        await prisma.task.create({
          data: {
            rooftopId: lead.rooftopId,
            userId: repId,
            kind: "confirm_appointment",
            leadId: lead.id,
            title: `Customer proposed ${new Date(cls.proposed_time_iso).toLocaleString()}`,
            body: `Reply: "${p.body.slice(0, 200)}"`,
            priority: 0.95,
            slaAt: new Date(Date.now() + 10 * 60_000),
          },
        });
      }
    } else if (cls.intent === "negotiate" || cls.intent === "ask_question") {
      // Bump priority of any followup task.
      await prisma.task.updateMany({
        where: { leadId: lead.id, kind: "followup", status: "open" },
        data: { priority: 0.85 },
      });
    }

    if (messageId) {
      await inngest.send({ name: "lead/reply.received", data: { leadId: lead.id, messageId } });
    }
  }

  return NextResponse.json({
    ok: true,
    intent: cls.intent,
    urgency: cls.urgency,
    proposed_time_iso: cls.proposed_time_iso,
  });
}

async function fallbackRep(rooftopId: string): Promise<string | null> {
  const r = await prisma.user.findFirst({ where: { rooftopId, role: "rep", active: true } });
  return r?.id ?? null;
}
