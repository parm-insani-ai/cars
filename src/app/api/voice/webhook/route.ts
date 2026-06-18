import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyVapiSignature } from "@/integrations/vapi";
import { executeTool } from "@/ai/tools";
import { summarizeCall } from "@/ai/run";
import { inngest } from "@/inngest/client";

// Single Vapi webhook endpoint. Routes on message.type.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-vapi-signature");
  if (!verifyVapiSignature(raw, sig)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const msg = body.message ?? body;
  const type = msg.type as string;

  try {
    switch (type) {
      case "assistant-request":   return await handleAssistantRequest(msg);
      case "tool-calls":          return await handleToolCalls(msg);
      case "function-call":       return await handleToolCalls({ ...msg, toolCalls: [msg.functionCall] }); // legacy shape
      case "status-update":       return await handleStatusUpdate(msg);
      case "end-of-call-report":  return await handleEndOfCall(msg);
      case "transcript":          return await handleTranscript(msg);
      default:                    return NextResponse.json({ ok: true, ignored: type });
    }
  } catch (err) {
    console.error("vapi webhook error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// --- assistant-request --------------------------------------------------
// Vapi pings us when a call comes in (or as we're about to make one) and asks
// "which assistant should answer?" We look up the business by the dialed
// number, create a CallSession, and return a Vapi-shaped assistant override
// that points at our custom LLM with the right metadata.
async function handleAssistantRequest(msg: any) {
  const call = msg.call ?? {};
  const toNumber: string | undefined = call?.phoneNumber?.number ?? call?.to ?? msg.toNumber;
  const fromNumber: string | undefined = call?.customer?.number ?? call?.from ?? msg.fromNumber;
  if (!toNumber) return NextResponse.json({ error: "no_to_number" }, { status: 400 });

  const business = await prisma.business.findFirst({ where: { phoneNumber: toNumber }, include: { agentConfig: true } });
  if (!business) return NextResponse.json({ error: "no_business_for_number", toNumber }, { status: 404 });
  if (!business.agentConfig) return NextResponse.json({ error: "no_agent_config" }, { status: 404 });

  const customer = fromNumber
    ? await prisma.customer.findFirst({ where: { businessId: business.id, phone: fromNumber } })
    : null;

  const session = await prisma.callSession.create({
    data: {
      businessId: business.id,
      customerId: customer?.id,
      vapiCallId: call.id,
      direction: "inbound",
      outcome: "in_progress",
      fromNumber: fromNumber ?? "unknown",
      toNumber,
      startedAt: new Date(),
    },
  });

  // Return assistant override telling Vapi to use our custom LLM.
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  return NextResponse.json({
    assistant: {
      firstMessage: business.agentConfig.greeting,
      // Allow callers to interrupt the greeting — most won't, but the ones
      // who already know the business will appreciate being able to cut in.
      firstMessageInterruptionsEnabled: true,
      voice: { provider: business.agentConfig.voiceProvider, voiceId: business.agentConfig.voiceId },
      transcriber: { provider: "deepgram", model: "nova-2", language: business.agentConfig.language },
      model: {
        provider: "custom-llm",
        url: `${baseUrl}/api/voice/llm`,
        model: "insani-agent",
        // Vapi reflects metadata on subsequent /llm calls.
        metadata: {
          businessId: business.id,
          callSessionId: session.id,
          callerPhone: fromNumber,
        },
        // Tell Vapi to dispatch tool calls to us via the function-call message
        // shape on this same webhook. Vapi forwards tool args as-is.
        functions: [], // tools are declared in our LLM output; Vapi auto-handles dispatch
      },
      // Snappy turn-taking — the difference between feeling robotic and human.
      silenceTimeoutSeconds: 30,
      numWordsToInterruptAssistant: 1,
      startSpeakingPlan: {
        waitSeconds: 0.1,
        // LiveKit's endpointing model is faster than Vapi's default.
        smartEndpointingPlan: { provider: "livekit" },
      },
      stopSpeakingPlan: {
        numWords: 0,
        voiceSeconds: 0.1,
        backoffSeconds: 1,
      },
      metadata: {
        businessId: business.id,
        callSessionId: session.id,
        callerPhone: fromNumber,
      },
    },
  });
}

// --- tool-calls ---------------------------------------------------------
// When Claude emits a tool_use, Vapi marshals it into a function-call webhook
// to us. We execute and return results in the format Vapi expects.
async function handleToolCalls(msg: any) {
  const sessionMeta = msg.call?.metadata ?? msg.metadata ?? {};
  const businessId: string | undefined = sessionMeta.businessId;
  const callSessionId: string | undefined = sessionMeta.callSessionId;
  if (!businessId || !callSessionId) return NextResponse.json({ error: "no_call_metadata" }, { status: 400 });
  const callerPhone: string | undefined = sessionMeta.callerPhone ?? msg.call?.customer?.number;

  const results: Array<{ toolCallId: string; result: string }> = [];
  const toolCalls: any[] = msg.toolCalls ?? msg.toolCallList ?? [];

  for (const tc of toolCalls) {
    const id = tc.id ?? tc.toolCallId ?? tc.function?.id;
    const name = tc.function?.name ?? tc.name;
    let args: any = {};
    try { args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments ?? tc.arguments ?? {}); } catch { args = {}; }

    const t0 = Date.now();
    const result = await executeTool({ businessId, callSessionId, callerPhone }, name, args);
    const latencyMs = Date.now() - t0;

    await prisma.callToolCall.create({
      data: {
        sessionId: callSessionId,
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

  // Vapi expects this exact shape for tool results.
  return NextResponse.json({ results });
}

// --- status-update ------------------------------------------------------
async function handleStatusUpdate(msg: any) {
  const callId = msg.call?.id;
  if (!callId) return NextResponse.json({ ok: true });
  const status = msg.status as string | undefined;
  // We don't change CallSession.outcome here — the LLM/tools own that.
  if (status === "ended") {
    await prisma.callSession.updateMany({
      where: { vapiCallId: callId },
      data: { endedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}

// --- transcript ---------------------------------------------------------
// Vapi streams partial transcripts. We ignore partials; the LLM endpoint
// captures finalized user turns, and end-of-call has the full transcript.
async function handleTranscript(_msg: any) {
  return NextResponse.json({ ok: true });
}

// --- end-of-call-report ------------------------------------------------
async function handleEndOfCall(msg: any) {
  const callId = msg.call?.id;
  const transcript: string | undefined = msg.transcript ?? msg.artifact?.transcript;
  const recordingUrl: string | undefined = msg.recordingUrl ?? msg.artifact?.recordingUrl;
  const cost: number | undefined = msg.cost ?? msg.call?.cost;
  const session = callId ? await prisma.callSession.findFirst({ where: { vapiCallId: callId } }) : null;
  if (!session) return NextResponse.json({ ok: true, note: "no_session_match" });

  const endedAt = new Date();
  const durationSec = Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000));

  await prisma.callSession.update({
    where: { id: session.id },
    data: {
      endedAt,
      durationSec,
      transcript: transcript ?? null,
      recordingUrl: recordingUrl ?? null,
      cost: cost ?? null,
    },
  });

  // AI summary + outcome reclassification (async-best-effort).
  summarizeCall(session.id).catch(() => undefined);

  // Schedule follow-ups based on outcome.
  await inngest.send({ name: "call/ended", data: { callSessionId: session.id } });

  return NextResponse.json({ ok: true });
}
