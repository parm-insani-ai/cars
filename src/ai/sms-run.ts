// SMS conversation runner. Reuses the same brain (Claude + tools) as voice,
// but with an SMS-specific system addendum (short replies, no greeting fluff,
// no spoken cues). Logs to SmsThread/SmsMessage/SmsToolCall.

import { anthropic, MODELS } from "./client";
import { buildAgentSystemPrompt, type SystemContext } from "./system-prompt";
import { getToolSchemas, executeTool } from "./tools";
import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";

const SMS_GUIDANCE = `\n\n=== This is an SMS conversation, not a voice call ===
- Keep every reply to under 320 characters when possible.
- Plain text — no emoji, no markdown, no URLs unless a tool produced one.
- No "let me know" — always end with a concrete option or question.
- The caller can take time to reply; you do NOT need to wrap things up quickly.
- Do not say "I'm listening" or other voice-only phrasings.`;

export async function runSmsTurn(args: {
  threadId: string;
  incomingBody: string;       // already persisted by caller
}): Promise<{ reply: string; outcome?: string }> {
  const thread = await prisma.smsThread.findUniqueOrThrow({
    where: { id: args.threadId },
    include: {
      business: {
        include: {
          agentConfig: true,
          hours: true,
          services: { where: { active: true } },
          providers: { where: { active: true } },
          knowledge: true,
        },
      },
    },
  });
  if (!thread.business.agentConfig) throw new Error("agent_config_missing");

  const ctx: SystemContext = {
    business: thread.business,
    agent: thread.business.agentConfig,
    hours: thread.business.hours,
    services: thread.business.services,
    providers: thread.business.providers.map(p => ({ id: p.id, name: p.name, kind: p.kind })),
    knowledge: thread.business.knowledge.map(k => ({ title: k.title, body: k.body })),
  };
  const systemPrompt = buildAgentSystemPrompt(ctx) + SMS_GUIDANCE;

  const tools = getToolSchemas({
    canBook: thread.business.agentConfig.canBook,
    canReschedule: thread.business.agentConfig.canReschedule,
    canCancel: thread.business.agentConfig.canCancel,
    canTransfer: false, // never transfer over SMS
    vertical: thread.business.vertical,
  });

  // Build message history from existing SmsMessages.
  const history = await prisma.smsMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });
  const messages: Anthropic.MessageParam[] = history.map(m =>
    m.role === "customer"
      ? { role: "user", content: m.body }
      : { role: "assistant", content: m.body }
  );

  const client = anthropic();
  // SMS conversations can tool-use just like voice. Loop until end-of-turn.
  const MAX_HOPS = 4;
  let replyText = "";
  let outcome: string | undefined;

  for (let i = 0; i < MAX_HOPS; i++) {
    const resp = await client.messages.create({
      model: MODELS.brain,
      max_tokens: 400,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });

    if (resp.stop_reason !== "tool_use") {
      replyText = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n")
        .trim();
      break;
    }

    messages.push({ role: "assistant", content: resp.content });
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const t0 = Date.now();
      // For SMS, "call session" doesn't apply. Pass a synthetic placeholder.
      // Tools that write to CallSession will fail gracefully when the id doesn't exist.
      const result = await executeTool(
        { businessId: thread.businessId, callSessionId: `sms:${thread.id}`, callerPhone: thread.phoneNumber },
        use.name,
        use.input,
      );
      const latencyMs = Date.now() - t0;
      await prisma.smsToolCall.create({
        data: {
          threadId: thread.id,
          toolName: use.name,
          input: use.input as any,
          output: (result.ok ? result.content : { error: (result as any).error }) as any,
          isError: !result.ok,
          latencyMs,
        },
      });
      if (use.name === "end_call") outcome = "closed";
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: result.ok ? JSON.stringify(result.content) : JSON.stringify({ error: (result as any).error }),
        is_error: !result.ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: replyText, outcome };
}
