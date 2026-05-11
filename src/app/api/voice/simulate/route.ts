import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runAgentTurn } from "@/ai/run";
import { executeTool } from "@/ai/tools";
import { summarizeCall } from "@/ai/run";
import type { OpenAIMessage } from "@/ai/openai-translate";

// Simulate a Vapi voice call entirely in text. Used by /demo to walk a
// dealer through the product without a phone number. Drives the same code
// path the real Vapi runtime would: LLM → tool calls → LLM → ... until the
// agent either speaks a final response or calls end_call.

const StartBody = z.object({
  businessId: z.string(),
  callerPhone: z.string().optional(),
  callerFirstName: z.string().optional(),
  callerLastName: z.string().optional(),
});

const TurnBody = z.object({
  callSessionId: z.string(),
  text: z.string(),
});

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  if (op === "start") {
    const parsed = StartBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const b = parsed.data;
    const business = await prisma.business.findUnique({ where: { id: b.businessId }, include: { agentConfig: true } });
    if (!business || !business.agentConfig) return NextResponse.json({ error: "business_or_agent_missing" }, { status: 404 });

    const callerPhone = b.callerPhone ?? `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
    const customer = await prisma.customer.findFirst({ where: { businessId: business.id, phone: callerPhone } });

    const session = await prisma.callSession.create({
      data: {
        businessId: business.id,
        customerId: customer?.id,
        direction: "inbound",
        outcome: "in_progress",
        fromNumber: callerPhone,
        toNumber: business.phoneNumber ?? "simulated",
        startedAt: new Date(),
      },
    });

    // Seed the conversation with the agent's greeting as the first agent turn.
    await prisma.callTurn.create({
      data: { sessionId: session.id, role: "agent", text: business.agentConfig.greeting },
    });

    return NextResponse.json({
      callSessionId: session.id,
      greeting: business.agentConfig.greeting,
      callerPhone,
    });
  }

  if (op === "turn") {
    const parsed = TurnBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { callSessionId, text } = parsed.data;

    const session = await prisma.callSession.findUnique({ where: { id: callSessionId }, include: { business: true } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    // Persist the user turn.
    await prisma.callTurn.create({ data: { sessionId: session.id, role: "customer", text } });

    // Build the OpenAI-style message history from existing turns.
    const turns = await prisma.callTurn.findMany({
      where: { sessionId: session.id },
      orderBy: { startedAt: "asc" },
    });

    const messages: OpenAIMessage[] = [];
    // Pair tool turns with their results: tool log lines become assistant tool_calls,
    // followed by a synthetic "tool" message containing the result. For the simulator,
    // we simplify: just feed agent / customer text. The LLM will replay tool calls anyway.
    for (const t of turns) {
      if (t.role === "agent") messages.push({ role: "assistant", content: t.text });
      else if (t.role === "customer") messages.push({ role: "user", content: t.text });
      // tool / system turns are skipped — they're shadow logs.
    }

    // Run up to N tool-use cycles. Real Vapi orchestrates this turn-by-turn
    // (each tool result comes in as a new message). For the simulator we
    // execute tools inline so a user keystroke yields a complete agent reply.
    const MAX_TOOL_HOPS = 4;
    let last: any = null;
    let finalText: string | null = null;
    let endedNow = false;

    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
      const resp = await runAgentTurn({
        businessId: session.businessId,
        callSessionId: session.id,
        callerPhone: session.fromNumber,
        openaiRequest: { messages, model: "frontdesk-agent" },
      });
      last = resp;
      const choice = resp.choices[0];
      if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls?.length) {
        finalText = choice.message.content ?? "";
        break;
      }
      // Execute tool calls and append synthetic tool messages.
      messages.push({
        role: "assistant",
        content: choice.message.content ?? "",
        tool_calls: choice.message.tool_calls,
      });
      for (const tc of choice.message.tool_calls ?? []) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
        const t0 = Date.now();
        const result = await executeTool(
          { businessId: session.businessId, callSessionId: session.id, callerPhone: session.fromNumber },
          tc.function.name,
          args,
        );
        const latencyMs = Date.now() - t0;
        await prisma.callToolCall.create({
          data: {
            sessionId: session.id,
            toolName: tc.function.name,
            input: args,
            output: result.ok ? (result.content as any) : { error: result.error },
            isError: !result.ok,
            latencyMs,
          },
        });
        if (tc.function.name === "end_call") endedNow = true;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.ok ? JSON.stringify(result.content) : JSON.stringify({ error: result.error }),
        });
      }
    }

    if (endedNow) {
      await prisma.callSession.update({
        where: { id: session.id },
        data: { endedAt: new Date(), durationSec: Math.round((Date.now() - session.startedAt.getTime()) / 1000) },
      });
      summarizeCall(session.id).catch(() => undefined);
    }

    return NextResponse.json({
      callSessionId: session.id,
      reply: finalText ?? "",
      ended: endedNow,
      raw: last,
    });
  }

  if (op === "end") {
    const parsed = TurnBody.pick({ callSessionId: true }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { callSessionId } = parsed.data;
    await prisma.callSession.update({
      where: { id: callSessionId },
      data: { endedAt: new Date() },
    });
    summarizeCall(callSessionId).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_op" }, { status: 400 });
}
