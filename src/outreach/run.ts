import { anthropic, MODELS } from "@/ai/client";
import {
  anthropicToOpenAIResponse,
  openAIToAnthropic,
  type OpenAIRequest,
} from "@/ai/openai-translate";
import { buildOutreachSystemPrompt } from "./system-prompt";
import { getOutreachToolSchemas } from "./tools";
import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";

// One turn of an outbound AI sales call. Called by Vapi via our outreach
// OpenAI-compatible LLM endpoint. The system prompt (campaign pitch + prospect
// context) is the stable per-call prefix, so we cache it.

export async function runOutreachTurn(args: {
  outreachCallId: string;
  openaiRequest: OpenAIRequest;
}) {
  const t0 = Date.now();

  const call = await prisma.outreachCall.findUnique({
    where: { id: args.outreachCallId },
    include: { prospect: true, campaign: true },
  });
  if (!call) throw new Error("outreach_call_not_found");
  if (!call.campaign) throw new Error("outreach_campaign_missing");

  const systemPrompt = buildOutreachSystemPrompt({
    campaign: call.campaign,
    prospect: call.prospect,
  });
  const tools = getOutreachToolSchemas();

  const { messages: priorMessages } = openAIToAnthropic(args.openaiRequest.messages);

  // On outbound calls Vapi speaks first (the static firstMessage), so the
  // conversation Vapi sends us starts with the assistant's opener. Anthropic
  // requires the first message to be user — prepend a synthetic "answering
  // the phone" user turn so the alternation is valid and the model actually
  // generates a reply (otherwise it silently returns 0 output tokens).
  if (priorMessages.length === 0 || priorMessages[0].role !== "user") {
    priorMessages.unshift({ role: "user", content: "(answering the phone) Hello?" });
  }

  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.brain,
    max_tokens: 512,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools,
    messages: priorMessages,
  });

  const openaiResp = anthropicToOpenAIResponse(resp, args.openaiRequest.model ?? "insani-outreach");

  const assistantText = openaiResp.choices[0].message.content ?? "";
  if (assistantText) {
    await prisma.outreachTurn.create({
      data: { callId: args.outreachCallId, role: "agent", text: assistantText },
    });
  }
  for (const block of resp.content) {
    if (block.type === "tool_use") {
      await prisma.outreachTurn.create({
        data: {
          callId: args.outreachCallId,
          role: "tool",
          text: `→ ${block.name}(${JSON.stringify(block.input)})`,
        },
      });
    }
  }

  const latencyMs = Date.now() - t0;
  await prisma.aiEval
    .create({
      data: {
        businessId: null,
        task: "outreach_turn",
        input: { messages: args.openaiRequest.messages } as any,
        output: openaiResp as any,
        model: MODELS.brain,
        latencyMs,
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
        cacheReadTokens: resp.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: resp.usage.cache_creation_input_tokens ?? 0,
      },
    })
    .catch(() => undefined);

  return openaiResp;
}

// Summarize a finished outbound sales call: 1-paragraph summary + a disposition
// classification. Run from the end-of-call webhook. Only fills disposition if a
// tool didn't already set one.
export async function summarizeOutreachCall(outreachCallId: string) {
  const call = await prisma.outreachCall.findUnique({
    where: { id: outreachCallId },
    include: { turns: { orderBy: { startedAt: "asc" } }, prospect: true },
  });
  if (!call) return;
  const transcript = call.turns
    .filter(t => t.role !== "tool")
    .map(t => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  if (!transcript) return;

  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.summarize,
    max_tokens: 300,
    system:
      `You summarize outbound AI sales calls selling an AI receptionist to ${call.prospect.businessName}. ` +
      `Output ONLY JSON: {"summary": "...", "disposition": "demo_booked"|"callback_requested"|"not_interested"|"no_answer"|"voicemail"|"wrong_number"|"bad_fit"|"gatekeeper_blocked"|"do_not_call"}. ` +
      `Summary is one paragraph under 60 words.`,
    messages: [{ role: "user", content: transcript }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return;
  try {
    const j = JSON.parse(match[0]);
    const valid = [
      "demo_booked", "callback_requested", "not_interested", "no_answer",
      "voicemail", "wrong_number", "bad_fit", "gatekeeper_blocked", "do_not_call",
    ];
    await prisma.outreachCall.update({
      where: { id: outreachCallId },
      data: {
        summary: String(j.summary ?? "").slice(0, 1000),
        disposition: call.disposition ?? (valid.includes(j.disposition) ? j.disposition : null),
      },
    });
  } catch {
    /* ignore */
  }
}
