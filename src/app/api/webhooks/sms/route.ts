import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSmsTurn } from "@/ai/sms-run";
import { smsAdapter } from "@/integrations/sms";

// Twilio inbound SMS webhook.
//
// Twilio posts application/x-www-form-urlencoded with fields:
//   From, To, Body, MessageSid, AccountSid, NumMedia
// We use From + To to find the business + customer, append the message to
// the thread, run the brain, persist and send the reply.
//
// Returns a TwiML <Response/> immediately so Twilio doesn't auto-reply.

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fromNumber = String(form.get("From") ?? "");
  const toNumber = String(form.get("To") ?? "");
  const body = String(form.get("Body") ?? "").trim();
  const externalId = String(form.get("MessageSid") ?? "") || null;

  if (!fromNumber || !toNumber || !body) {
    return twiml();
  }

  // Find the business this number belongs to. Accept either phoneNumber or
  // smsFromNumber as identifying.
  const business = await prisma.business.findFirst({
    where: {
      OR: [{ phoneNumber: toNumber }, { smsFromNumber: toNumber }],
    },
  });
  if (!business) {
    console.warn("sms inbound: no business for", toNumber);
    return twiml();
  }

  // Handle STOP keywords — revoke consent, do not reply with the brain.
  const lower = body.toLowerCase();
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(lower)) {
    const customer = await prisma.customer.findFirst({ where: { businessId: business.id, phone: fromNumber } });
    if (customer) {
      await prisma.customer.update({ where: { id: customer.id }, data: { smsConsent: false } });
    }
    return twiml();
  }

  // Upsert the thread.
  const thread = await prisma.smsThread.upsert({
    where: { businessId_phoneNumber: { businessId: business.id, phoneNumber: fromNumber } },
    create: { businessId: business.id, phoneNumber: fromNumber, lastInboundAt: new Date() },
    update: { lastInboundAt: new Date(), status: "open" },
  });

  // Link customer to thread if we can find one.
  if (!thread.customerId) {
    const customer = await prisma.customer.findFirst({ where: { businessId: business.id, phone: fromNumber } });
    if (customer) {
      await prisma.smsThread.update({ where: { id: thread.id }, data: { customerId: customer.id } });
    }
  }

  // Persist inbound.
  await prisma.smsMessage.create({
    data: {
      threadId: thread.id,
      role: "customer",
      body,
      externalId,
    },
  });

  // Run the brain.
  let reply = "";
  try {
    const result = await runSmsTurn({ threadId: thread.id, incomingBody: body });
    reply = result.reply.trim();
  } catch (err) {
    console.error("sms run error", err);
    reply = "Sorry, something went wrong on our end. A team member will follow up.";
  }

  if (reply) {
    // Append the SMS footer for compliance.
    const footer = (await prisma.agentConfig.findUnique({ where: { businessId: business.id } }))?.smsFooter;
    const fullReply = footer ? `${reply}\n${footer}` : reply;
    const sent = await smsAdapter().send({
      fromNumber: business.smsFromNumber ?? business.phoneNumber ?? undefined,
      to: fromNumber,
      body: fullReply,
    }).catch(() => null);
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        role: "agent",
        body: fullReply,
        externalId: sent?.externalId ?? null,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastOutboundAt: new Date() },
    });
  }

  return twiml();
}

function twiml() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}
