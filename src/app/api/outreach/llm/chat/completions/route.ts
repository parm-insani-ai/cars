import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropic, MODELS } from "@/ai/client";
import { buildOutreachSystemPrompt } from "@/outreach/system-prompt";
import { getOutreachToolSchemas } from "@/outreach/tools";
import { openAIToAnthropic, type OpenAIRequest } from "@/ai/openai-translate";
import { callCacheGetOrLoad } from "@/lib/call-cache";

// Tool schemas are static; build the list once at module load instead of
// re-running it for every turn.
const TOOL_SCHEMAS = getOutreachToolSchemas();

// Vapi custom-LLM endpoint for the outbound AI sales rep. Vapi posts to
// `<base>/chat/completions` and sends `stream: true`, so we must return an
// OpenAI-compatible Server-Sent-Events stream — a plain JSON response is
// silently ignored by Vapi, which is why Ava went mute after her opener.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as OpenAIRequest & {
    metadata?: { outreachCallId?: string };
    call?: { metadata?: { outreachCallId?: string } };
    stream?: boolean;
  };

  const outreachCallId =
    body.metadata?.outreachCallId ?? body.call?.metadata?.outreachCallId;
  if (!outreachCallId) {
    return new Response(JSON.stringify({ error: "missing_outreach_call_metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Same call → same prospect, same campaign — fetch once per call, reuse for
  // every turn. Knocks ~250ms off every turn after the first.
  const call = await callCacheGetOrLoad(
    `outreach:${outreachCallId}`,
    () =>
      prisma.outreachCall.findUnique({
        where: { id: outreachCallId },
        include: { prospect: true, campaign: true },
      }),
  );
  if (!call || !call.campaign) {
    return new Response(JSON.stringify({ error: "call_or_campaign_missing" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Persist the prospect's latest spoken turn. Fire-and-forget — the response
  // doesn't depend on it landing, and awaiting it adds ~150ms before we even
  // start the LLM call.
  const last = body.messages[body.messages.length - 1];
  if (last?.role === "user") {
    const text =
      typeof last.content === "string"
        ? last.content
        : (last.content ?? []).map(p => p.text).join("");
    if (text.trim()) {
      void prisma.outreachTurn
        .create({ data: { callId: outreachCallId, role: "customer", text } })
        .catch(() => undefined);
    }
  }

  const systemPrompt = buildOutreachSystemPrompt({
    campaign: call.campaign,
    prospect: call.prospect,
  });
  const tools = TOOL_SCHEMAS;

  // Anthropic requires the first message to be from the user; Vapi sends us a
  // conversation starting with the assistant's opener on outbound calls.
  const { messages: priorMessages } = openAIToAnthropic(body.messages);
  if (priorMessages.length === 0 || priorMessages[0].role !== "user") {
    priorMessages.unshift({ role: "user", content: "(answering the phone) Hello?" });
  }

  const id = "chatcmpl_" + outreachCallId.slice(-12);
  const created = Math.floor(Date.now() / 1000);
  const model = body.model ?? "insani-outreach";
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
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          tools,
          messages: priorMessages,
        });

        // Initial role marker so the OpenAI consumer can build the assistant turn.
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
        console.error("outreach llm stream error:", err);
      }

      // After the stream is finished, persist what the rep said.
      if (collectedText) {
        await prisma.outreachTurn
          .create({ data: { callId: outreachCallId, role: "agent", text: collectedText } })
          .catch(() => undefined);
      }
      for (const t of collectedTools) {
        await prisma.outreachTurn
          .create({
            data: {
              callId: outreachCallId,
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
