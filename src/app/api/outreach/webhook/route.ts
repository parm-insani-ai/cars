import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyVapiSignature } from "@/integrations/vapi";
import { executeOutreachTool } from "@/outreach/tools";
import { summarizeOutreachCall } from "@/outreach/run";
import { nextAttemptTime } from "@/outreach/schedule";

// Vapi lifecycle webhook for outbound AI sales calls. Outbound calls are placed
// with a pre-provisioned assistant, so there's no assistant-request here — just
// tool-calls, status-update, and the end-of-call report.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyVapiSignature(raw, req.headers.get("x-vapi-signature"))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const msg = body.message ?? body;

  console.log(`[outreach-webhook] received type=${msg.type}`);
  try {
    switch (msg.type as string) {
      case "tool-calls":         return await handleToolCalls(msg);
      case "function-call":      return await handleToolCalls({ ...msg, toolCalls: [msg.functionCall] });
      case "status-update":      return await handleStatusUpdate(msg);
      case "end-of-call-report": return await handleEndOfCall(msg);
      default:                   return NextResponse.json({ ok: true, ignored: msg.type });
    }
  } catch (err) {
    console.error("outreach webhook error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

async function handleToolCalls(msg: any) {
  const meta = msg.call?.metadata ?? msg.metadata ?? {};
  const outreachCallId: string | undefined = meta.outreachCallId;
  const prospectId: string | undefined = meta.prospectId;
  if (!outreachCallId || !prospectId) {
    return NextResponse.json({ error: "no_call_metadata" }, { status: 400 });
  }
  const ctx = {
    outreachCallId,
    prospectId,
    campaignId: meta.campaignId as string | undefined,
    targetId: meta.targetId as string | undefined,
  };

  const results: Array<{ toolCallId: string; result: string }> = [];
  const toolCalls: any[] = msg.toolCalls ?? msg.toolCallList ?? [];
  for (const tc of toolCalls) {
    const id = tc.id ?? tc.toolCallId ?? tc.function?.id;
    const name = tc.function?.name ?? tc.name;
    let args: any = {};
    try {
      args =
        typeof tc.function?.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments ?? tc.arguments ?? {};
    } catch {
      args = {};
    }

    const t0 = Date.now();
    const result = await executeOutreachTool(ctx, name, args);
    const latencyMs = Date.now() - t0;

    await prisma.outreachToolCall.create({
      data: {
        callId: outreachCallId,
        toolName: name,
        input: args,
        output: result.ok ? (result.content as any) : { error: result.error },
        isError: !result.ok,
        latencyMs,
      },
    });
    results.push({
      toolCallId: id,
      result: result.ok ? JSON.stringify(result.content) : JSON.stringify({ error: result.error }),
    });
  }
  return NextResponse.json({ results });
}

async function handleStatusUpdate(msg: any) {
  const callId = msg.call?.id;
  if (callId && msg.status === "ended") {
    await prisma.outreachCall.updateMany({
      where: { vapiCallId: callId },
      data: { endedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}

async function handleEndOfCall(msg: any) {
  const callId = msg.call?.id;
  const transcript: string | undefined = msg.transcript ?? msg.artifact?.transcript;
  const recordingUrl: string | undefined = msg.recordingUrl ?? msg.artifact?.recordingUrl;
  const cost: number | undefined = msg.cost ?? msg.call?.cost;

  const call = callId
    ? await prisma.outreachCall.findFirst({ where: { vapiCallId: callId }, include: { prospect: true } })
    : null;
  if (!call) return NextResponse.json({ ok: true, note: "no_call_match" });

  const endedAt = new Date();
  const durationSec = Math.max(0, Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000));
  await prisma.outreachCall.update({
    where: { id: call.id },
    data: {
      status: "completed",
      endedAt,
      durationSec,
      transcript: transcript ?? null,
      recordingUrl: recordingUrl ?? null,
      cost: cost ?? null,
    },
  });

  // Reconcile the target if no tool resolved it (e.g. no answer / voicemail):
  // retry while attempts remain, otherwise close it out.
  if (call.targetId) {
    const target = await prisma.outreachTarget.findUnique({ where: { id: call.targetId } });
    if (target && target.status === "calling") {
      const campaign = call.campaignId
        ? await prisma.outreachCampaign.findUnique({ where: { id: call.campaignId } })
        : null;
      const maxAttempts = campaign?.maxAttempts ?? 3;
      if (target.attempts < maxAttempts) {
        // Smart retry — pick a time-of-day window we haven't tried yet,
        // rotating morning/afternoon/next-day so we sample different
        // "when might they be near the phone" moments instead of just
        // hammering the same 4-hour offset.
        const next = nextAttemptTime({
          attemptsSoFar: target.attempts,
          now: new Date(),
          timezone: call.prospect.timezone || "America/Halifax",
        });
        await prisma.outreachTarget.update({
          where: { id: target.id },
          data: {
            status: "pending",
            nextAttemptAt: next,
            outcomeNote: `No contact made — re-queued for attempt ${target.attempts + 1} at ${next.toISOString()}`,
          },
        });
      } else {
        await prisma.outreachTarget.update({
          where: { id: target.id },
          data: { status: "completed", outcomeNote: "No contact made after max attempts" },
        });
        await prisma.prospect.updateMany({
          where: { id: call.prospectId, status: { in: ["contacted", "queued"] } },
          data: { status: "lost" },
        });
      }
    }
  }

  // Summary + disposition classification. We AWAIT this instead of firing
  // it in the background — Vercel Serverless Functions terminate the
  // process the moment the response returns, which was killing our
  // summarize + SMS mid-Anthropic-call. Adding a few seconds to this
  // webhook response is fine; Vapi doesn't care.
  console.log(`[outreach-webhook] end-of-call reached, awaiting summarizeOutreachCall for ${call.id}`);
  try {
    await summarizeOutreachCall(call.id);
    console.log(`[outreach-webhook] summarizeOutreachCall completed for ${call.id}`);
  } catch (err) {
    console.error(`[outreach-webhook] summarizeOutreachCall failed for ${call.id}:`, err);
  }

  return NextResponse.json({ ok: true });
}
