import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "./client";
import { AI_TOOLS, executeTool } from "./tools";
import { buildDealerSystemPrompt } from "./system-prompt";
import type { Rooftop } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Rooftopish = Pick<Rooftop, "id" | "name" | "voiceProfile" | "consentTemplate" | "timezone">;

export type DraftRunInput = {
  rooftop: Rooftopish;
  task: "draft_first_response" | "draft_followup" | "draft_missed_call_sms" | "draft_service_pitch";
  // The model sees this user message. Include real records (customer, source,
  // vehicle of interest) as structured facts — NOT as free-form history.
  userMessage: string;
  maxIterations?: number;
};

export type DraftRunResult = {
  finalText: string;
  toolCalls: Array<{ name: string; input: unknown; output: string; error: boolean }>;
  usage: { input: number; output: number; cacheRead: number; cacheCreate: number };
  stopReason: string | null;
  latencyMs: number;
};

// Manual agentic loop so we can log tool calls, write AiEval records, and keep
// control of prompt caching. The cached prefix is `system` (frozen per rooftop)
// plus `tools` (deterministic order) — see shared/prompt-caching.md.
export async function runDraft(input: DraftRunInput): Promise<DraftRunResult> {
  const t0 = Date.now();
  const client = anthropic();
  const system = buildDealerSystemPrompt(input.rooftop);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: input.userMessage }];
  const toolCalls: DraftRunResult["toolCalls"] = [];
  let usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let stopReason: string | null = null;
  let finalText = "";

  const maxIter = input.maxIterations ?? 4;
  for (let i = 0; i < maxIter; i++) {
    const resp = await client.messages.create({
      model: MODELS.draft,
      max_tokens: 1024,
      // cache_control on the system prompt caches tools + system together (tools
      // render before system). The prefix is byte-stable per rooftop.
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: AI_TOOLS,
      messages,
    });

    usage.input += resp.usage.input_tokens ?? 0;
    usage.output += resp.usage.output_tokens ?? 0;
    usage.cacheRead += resp.usage.cache_read_input_tokens ?? 0;
    usage.cacheCreate += resp.usage.cache_creation_input_tokens ?? 0;
    stopReason = resp.stop_reason;

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") {
      finalText = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    if (resp.stop_reason !== "tool_use") {
      // refusal, max_tokens, etc. — bail with whatever text we got.
      finalText = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const use of toolUses) {
      const result = await executeTool(input.rooftop.id, use.name, use.input);
      toolCalls.push({
        name: use.name,
        input: use.input,
        output: result.content,
        error: Boolean(result.is_error),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: result.content,
        is_error: result.is_error,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  const latencyMs = Date.now() - t0;

  // Best-effort eval record. Never blocks the caller.
  prisma.aiEval
    .create({
      data: {
        rooftopId: input.rooftop.id,
        task: input.task,
        input: { userMessage: input.userMessage } as any,
        output: { text: finalText, toolCalls } as any,
        model: MODELS.draft,
        latencyMs,
      },
    })
    .catch(() => undefined);

  return { finalText, toolCalls, usage, stopReason, latencyMs };
}
