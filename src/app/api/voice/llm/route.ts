import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentTurn } from "@/ai/run";
import type { OpenAIRequest } from "@/ai/openai-translate";

// Vapi custom-LLM endpoint. Receives an OpenAI chat completions request,
// returns an OpenAI-compatible response. We thread the call session through
// the request metadata Vapi attaches.
//
// Vapi passes a `metadata` object on the request; we expect `businessId` and
// `callSessionId` to be set (we set them when handling assistant-request).
//
// SECURITY: this endpoint is callable by Vapi only. In production, restrict
// by IP allowlist or shared secret in a header; mock-mode accepts all.

export async function POST(req: NextRequest) {
  const body = (await req.json()) as OpenAIRequest & {
    metadata?: { businessId?: string; callSessionId?: string; callerPhone?: string };
  };

  // Vapi sometimes forwards via `call` object instead of `metadata` — accept both.
  const callObj = (body as any).call as
    | { metadata?: { businessId?: string; callSessionId?: string }; customer?: { number?: string } }
    | undefined;

  const businessId = body.metadata?.businessId ?? callObj?.metadata?.businessId;
  const callSessionId = body.metadata?.callSessionId ?? callObj?.metadata?.callSessionId;
  const callerPhone = body.metadata?.callerPhone ?? callObj?.customer?.number;

  if (!businessId || !callSessionId) {
    return NextResponse.json({ error: "missing_call_metadata" }, { status: 400 });
  }

  // Persist the latest user turn (if the last message is from the user).
  const last = body.messages[body.messages.length - 1];
  if (last?.role === "user") {
    const text = typeof last.content === "string"
      ? last.content
      : (last.content ?? []).map(p => p.text).join("");
    if (text.trim()) {
      await prisma.callTurn.create({
        data: { sessionId: callSessionId, role: "customer", text },
      });
    }
  }

  const resp = await runAgentTurn({
    businessId,
    callSessionId,
    callerPhone,
    openaiRequest: body,
  });
  return NextResponse.json(resp);
}
