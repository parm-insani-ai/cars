import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic, MODELS } from "@/ai/client";
import { buildAgentSystemPrompt } from "@/ai/system-prompt";
import { getToolSchemas } from "@/ai/tools";
import { openAIToAnthropic, type OpenAIRequest } from "@/ai/openai-translate";

// Vapi custom-LLM endpoint for the inbound AI receptionist. Vapi POSTs to
// `<model.url>/chat/completions` with `stream: true`, so we live here (not at
// /api/voice/llm) and return an OpenAI-compatible SSE stream — anything else
// silently makes Vapi go mute on the call.
//
// Per-call metadata (businessId, callSessionId, callerPhone) is set by the
// assistant-request handler in /api/voice/webhook.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as OpenAIRequest & {
    metadata?: { businessId?: string; callSessionId?: string; callerPhone?: string };
    call?: { metadata?: { businessId?: string; callSessionId?: string }; customer?: { number?: string } };
    stream?: boolean;
  };

  const businessId = body.metadata?.businessId ?? body.call?.metadata?.businessId;
  const callSessionId = body.metadata?.callSessionId ?? body.call?.metadata?.callSessionId;
  const callerPhone = body.metadata?.callerPhone ?? body.call?.customer?.number;

  if (!businessId || !callSessionId) {
    return new Response(JSON.stringify({ error: "missing_call_metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      agentConfig: true,
      hours: true,
      services: { where: { active: true } },
      providers: { where: { active: true } },
      knowledge: true,
    },
  });
  if (!business || !business.agentConfig) {
    return new Response(JSON.stringify({ error: "business_or_agent_missing" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Persist the caller's latest spoken turn.
  const last = body.messages[body.messages.length - 1];
  if (last?.role === "user") {
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content ?? []).map(p => p.text).join("");
    if (text.trim()) {
      await prisma.callTurn
        .create({ data: { sessionId: callSessionId, role: "customer", text } })
        .catch(() => undefined);
    }
  }

  const systemPrompt = buildAgentSystemPrompt({
    business,
    agent: business.agentConfig,
    hours: business.hours,
    services: business.services,
    providers: business.providers.map(p => ({ id: p.id, name: p.name, kind: p.kind })),
    knowledge: business.knowledge.map(k => ({ title: k.title, body: k.body })),
  });
  const tools = getToolSchemas({
    canBook: business.agentConfig.canBook,
    canReschedule: business.agentConfig.canReschedule,
    canCancel: business.agentConfig.canCancel,
    canTransfer: business.agentConfig.canTransfer,
    vertical: business.vertical,
  });

  // Anthropic requires the first message to be user. Vapi sends us a
  // conversation starting with the assistant's greeting on inbound calls, so
  // prepend a synthetic "phone connects" user turn to keep the alternation
  // valid (otherwise the model returns zero tokens and we go silent).
  const { messages: priorMessages } = openAIToAnthropic(body.messages);
  if (priorMessages.length === 0 || priorMessages[0].role !== "user") {
    priorMessages.unshift({ role: "user", content: "(call connects)" });
  }

  // Always pass the caller's phone as a system-level fact so tools that
  // default to "the caller's number" have it.
  const callerFact = callerPhone ? `Caller's phone number on this call: ${callerPhone}` : "";

  const id = "chatcmpl_" + callSessionId.slice(-12);
  const created = Math.floor(Date.now() / 1000);
  const model = body.model ?? "frontdesk-agent";
  const encoder = new TextEncoder();

  function chunk(delta: Record<string, unknown>, finish_reason: string | null = null) {
    return `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason }],
    })}\n\n`;
  }

  const client = anthropic();

  const stream = new ReadableStream({
    async start(controller) {
      let collectedText = "";
      const collectedTools: Array<{ id: string; name: string; input: unknown }> = [];
      let currentTool: { index: number; id: string; name: string; argsRaw: string } | null = null;
      let stopReason: string | null = null;

      try {
        const aStream = client.messages.stream({
          model: MODELS.brain,
          max_tokens: 512,
          system: [
            { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
            ...(callerFact ? [{ type: "text" as const, text: callerFact }] : []),
          ],
          tools,
          messages: priorMessages,
        });

        controller.enqueue(encoder.encode(chunk({ role: "assistant" })));

        for await (const event of aStream as AsyncIterable<any>) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block?.type === "tool_use") {
              const idx = collectedTools.length;
              currentTool = { index: idx, id: block.id, name: block.name, argsRaw: "" };
              controller.enqueue(
                encoder.encode(
                  chunk({
                    tool_calls: [
                      {
                        index: idx,
                        id: block.id,
                        type: "function",
                        function: { name: block.name, arguments: "" },
                      },
                    ],
                  }),
                ),
              );
            }
          } else if (event.type === "content_block_delta") {
            const d = event.delta;
            if (d?.type === "text_delta") {
              collectedText += d.text;
              controller.enqueue(encoder.encode(chunk({ content: d.text })));
            } else if (d?.type === "input_json_delta") {
              if (currentTool) {
                currentTool.argsRaw += d.partial_json ?? "";
                controller.enqueue(
                  encoder.encode(
                    chunk({
                      tool_calls: [
                        {
                          index: currentTool.index,
                          function: { arguments: d.partial_json ?? "" },
                        },
                      ],
                    }),
                  ),
                );
              }
            }
          } else if (event.type === "content_block_stop") {
            if (currentTool) {
              let parsed: unknown = {};
              try { parsed = JSON.parse(currentTool.argsRaw || "{}"); } catch { /* keep {} */ }
              collectedTools.push({
                id: currentTool.id,
                name: currentTool.name,
                input: parsed,
              });
              currentTool = null;
            }
          } else if (event.type === "message_delta") {
            if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
          }
        }

        const finish =
          stopReason === "tool_use" ? "tool_calls" :
          stopReason === "max_tokens" ? "length" : "stop";
        controller.enqueue(encoder.encode(chunk({}, finish)));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        try {
          controller.enqueue(encoder.encode(chunk({}, "stop")));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch { /* */ }
        controller.close();
        console.error("voice llm stream error:", err);
      }

      // Persist what Ava said and any tool calls she emitted.
      if (collectedText) {
        await prisma.callTurn
          .create({ data: { sessionId: callSessionId, role: "agent", text: collectedText } })
          .catch(() => undefined);
      }
      for (const t of collectedTools) {
        await prisma.callTurn
          .create({
            data: {
              sessionId: callSessionId,
              role: "tool",
              text: `→ ${t.name}(${JSON.stringify(t.input)})`,
            },
          })
          .catch(() => undefined);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
