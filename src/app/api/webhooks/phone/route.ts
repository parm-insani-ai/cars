import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { summarizeCall } from "@/ai/classify";

// Generic phone webhook endpoint. Providers (CallRevu, Car Wars, Dialpad,
// RingCentral) each POST their own shape — normalize at the edge.
const Body = z.object({
  rooftopId: z.string(),
  externalId: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]),
  outcome: z.enum(["connected", "missed", "voicemail", "abandoned"]),
  fromNumber: z.string(),
  toNumber: z.string(),
  startedAt: z.string(),     // ISO
  endedAt: z.string().optional(),
  durationSec: z.number().optional(),
  repExternalId: z.string().optional(),
  department: z.string().optional(),
  recordingUrl: z.string().optional(),
  transcriptText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  // Match rep by external id if we have it (CRM → phone rep id mapping lives on User.
  // MVP just does best-effort lookup by name prefix).
  const rep = p.repExternalId
    ? await prisma.user.findFirst({ where: { rooftopId: p.rooftopId, name: { contains: p.repExternalId } } })
    : null;

  // Best-effort customer match by phone.
  const customer = await prisma.customer.findFirst({
    where: { rooftopId: p.rooftopId, phone: p.fromNumber },
  });

  const call = await prisma.callEvent.create({
    data: {
      rooftopId: p.rooftopId,
      externalId: p.externalId,
      direction: p.direction,
      outcome: p.outcome,
      fromNumber: p.fromNumber,
      toNumber: p.toNumber,
      startedAt: new Date(p.startedAt),
      endedAt: p.endedAt ? new Date(p.endedAt) : null,
      durationSec: p.durationSec,
      repId: rep?.id,
      customerId: customer?.id,
      recordingUrl: p.recordingUrl,
      department: p.department ?? "sales",
    },
  });

  // If we got a transcript, summarize + classify async-free (Haiku is fast).
  if (p.transcriptText) {
    try {
      const summary = await summarizeCall(p.transcriptText);
      await prisma.transcript.create({
        data: {
          callId: call.id,
          text: p.transcriptText,
          summary: summary.summary,
          intent: summary.intent,
          objections: summary.objections,
          nextAction: summary.next_action,
        },
      });
    } catch {
      await prisma.transcript.create({ data: { callId: call.id, text: p.transcriptText } });
    }
  }

  // Kick off recovery workflow for missed sales calls.
  if (p.outcome === "missed" && (p.department ?? "sales") === "sales" && p.direction === "inbound") {
    await inngest.send({ name: "call/missed", data: { callId: call.id } });
  }

  return NextResponse.json({ ok: true, callId: call.id });
}
