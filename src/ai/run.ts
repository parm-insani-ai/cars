import { anthropic, MODELS } from "./client";
import { buildAgentSystemPrompt, type SystemContext } from "./system-prompt";
import { getToolSchemas } from "./tools";
import {
  anthropicToolsToOpenAI,
  anthropicToOpenAIResponse,
  openAIToAnthropic,
  type OpenAIRequest,
} from "./openai-translate";
import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";

// One turn of the voice conversation. Called by Vapi via our OpenAI-compatible
// LLM endpoint. Vapi sends the message history; we route through Anthropic and
// return an OpenAI response shape.
//
// Cache: the system prompt is the stable per-business prefix.

export async function runAgentTurn(args: {
  businessId: string;
  callSessionId: string;
  // Caller info from Vapi metadata
  callerPhone?: string;
  openaiRequest: OpenAIRequest;
}) {
  const t0 = Date.now();

  const business = await prisma.business.findUnique({
    where: { id: args.businessId },
    include: { agentConfig: true, hours: true, services: { where: { active: true } }, providers: { where: { active: true } }, knowledge: true },
  });
  if (!business) throw new Error("business_not_found");
  if (!business.agentConfig) throw new Error("agent_config_missing");

  const ctx: SystemContext = {
    business,
    agent: business.agentConfig,
    hours: business.hours,
    services: business.services,
    providers: business.providers.map(p => ({ id: p.id, name: p.name, kind: p.kind })),
    knowledge: business.knowledge.map(k => ({ title: k.title, body: k.body })),
  };
  const systemPrompt = buildAgentSystemPrompt(ctx);

  const anthropicTools = getToolSchemas({
    canBook: business.agentConfig.canBook,
    canReschedule: business.agentConfig.canReschedule,
    canCancel: business.agentConfig.canCancel,
    canTransfer: business.agentConfig.canTransfer,
    vertical: business.vertical,
  });
  const openaiTools = anthropicToolsToOpenAI(anthropicTools);

  // Vapi sends its own system message; we override with our built prompt and
  // pass through user/assistant/tool turns.
  const { messages: priorMessages } = openAIToAnthropic(args.openaiRequest.messages);

  // Anthropic requires the first message to be user. If we're handed a
  // conversation that starts with the assistant's greeting (e.g. from the
  // simulator test page), prepend a synthetic user turn so alternation is
  // valid and the model actually replies.
  if (priorMessages.length === 0 || priorMessages[0].role !== "user") {
    priorMessages.unshift({ role: "user", content: "(call connects)" });
  }

  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.brain,
    max_tokens: 512,
    // Cache the system prefix per business — it doesn't change across turns
    // within a call, or between calls (until config changes).
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: anthropicTools,
    messages: priorMessages,
  });

  const openaiResp = anthropicToOpenAIResponse(resp, args.openaiRequest.model ?? "frontdesk-agent");

  // Log: persist turn text + AI eval row. We do NOT call tools here — Vapi
  // dispatches tool calls back to /api/voice/tools/* via our endpoints.
  const assistantText = openaiResp.choices[0].message.content ?? "";
  if (assistantText) {
    await prisma.callTurn.create({
      data: {
        sessionId: args.callSessionId,
        role: "agent",
        text: assistantText,
      },
    });
  }

  const latencyMs = Date.now() - t0;
  await prisma.aiEval.create({
    data: {
      businessId: args.businessId,
      task: "agent_turn",
      input: { messages: args.openaiRequest.messages } as any,
      output: openaiResp as any,
      model: MODELS.brain,
      latencyMs,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      cacheReadTokens: resp.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: resp.usage.cache_creation_input_tokens ?? 0,
    },
  }).catch(() => undefined);

  // Tool calls also get logged as turns (so the transcript shows the action).
  for (const block of resp.content) {
    if (block.type === "tool_use") {
      await prisma.callTurn.create({
        data: {
          sessionId: args.callSessionId,
          role: "tool",
          text: `→ ${block.name}(${JSON.stringify(block.input)})`,
        },
      });
    }
  }

  return openaiResp;
}

// Summarize a finished call: 1-paragraph summary + outcome reclassification.
// Run from the end-of-call webhook.
export async function summarizeCall(callSessionId: string) {
  const session = await prisma.callSession.findUnique({
    where: { id: callSessionId },
    include: { turns: { orderBy: { startedAt: "asc" } }, business: true },
  });
  if (!session) return;
  const transcript = session.turns
    .filter(t => t.role !== "tool")
    .map(t => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  if (!transcript) return;

  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.summarize,
    max_tokens: 300,
    system: `You summarize voice receptionist calls for ${session.business.name}. Output ONLY JSON: {"summary": "...", "outcome": "booked"|"rescheduled"|"canceled"|"message_taken"|"transferred"|"no_action"|"voicemail"|"hung_up"}. Summary is one paragraph under 60 words.`,
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
    await prisma.callSession.update({
      where: { id: callSessionId },
      data: {
        summary: String(j.summary ?? "").slice(0, 1000),
        outcome: ["booked","rescheduled","canceled","message_taken","transferred","no_action","voicemail","hung_up"].includes(j.outcome)
          ? j.outcome
          : session.outcome,
      },
    });
  } catch { /* ignore */ }
}
