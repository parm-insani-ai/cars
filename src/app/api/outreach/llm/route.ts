import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runOutreachTurn } from "@/outreach/run";
import type { OpenAIRequest } from "@/ai/openai-translate";

// Vapi custom-LLM endpoint for the outbound AI sales rep. Separate from the
// receptionist's /api/voice/llm so the two brains never cross wires.
//
// The outreach Vapi assistant is provisioned with this URL and carries
// `metadata.outreachCallId` (set by the dispatcher when it places the call).
//
// SECURITY: callable by Vapi only — restrict by IP allowlist or shared header
// secret in production. Mock mode accepts all.

export async function POST(req: NextRequest) {
  const body = (await req.json()) as OpenAIRequest & {
    metadata?: { outreachCallId?: string };
  };
  const callObj = (body as any).call as { metadata?: { outreachCallId?: string } } | undefined;
  const outreachCallId = body.metadata?.outreachCallId ?? callObj?.metadata?.outreachCallId;

  if (!outreachCallId) {
    return NextResponse.json({ error: "missing_outreach_call_metadata" }, { status: 400 });
  }

  // Persist the prospect's latest spoken turn.
  const last = body.messages[body.messages.length - 1];
  if (last?.role === "user") {
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content ?? []).map(p => p.text).join("");
    if (text.trim()) {
      await prisma.outreachTurn.create({
        data: { callId: outreachCallId, role: "customer", text },
      });
    }
  }

  const resp = await runOutreachTurn({ outreachCallId, openaiRequest: body });
  return NextResponse.json(resp);
}
