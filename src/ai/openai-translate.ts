import type Anthropic from "@anthropic-ai/sdk";

// Vapi calls our LLM endpoint with OpenAI chat-completions request shape and
// expects an OpenAI-compatible response. We translate to/from Anthropic.
//
// References: the format is a strict subset of OpenAI v1 chat completions.

export type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

export type OpenAIContentPart = { type: "text"; text: string };

export type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
};

export type OpenAIRequest = {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

// --- Tool schema mapping --------------------------------------------------

export function anthropicToolsToOpenAI(tools: Anthropic.Tool[]): OpenAITool[] {
  return tools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as object,
    },
  }));
}

// --- Message translation ------------------------------------------------

// Convert OpenAI messages → Anthropic messages, splitting out the system text.
export function openAIToAnthropic(messages: OpenAIMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  const systems: string[] = [];
  const out: Anthropic.MessageParam[] = [];
  // Accumulate tool results so we can group consecutive tool messages into
  // a single user-turn (Anthropic shape requires this).
  let pendingToolResults: Anthropic.ToolResultBlockParam[] = [];

  function flushToolResults() {
    if (pendingToolResults.length > 0) {
      out.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  }

  for (const m of messages) {
    if (m.role === "system") {
      systems.push(extractText(m.content));
      continue;
    }
    if (m.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "",
        content: extractText(m.content),
      });
      continue;
    }
    flushToolResults();
    if (m.role === "user") {
      out.push({ role: "user", content: extractText(m.content) });
    } else if (m.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      const text = extractText(m.content);
      if (text) blocks.push({ type: "text", text });
      for (const tc of m.tool_calls ?? []) {
        let parsed: unknown = {};
        try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep {} */ }
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: parsed as Record<string, unknown>,
        });
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : text });
    }
  }
  flushToolResults();
  return { system: systems.join("\n\n"), messages: out };
}

function extractText(content: OpenAIMessage["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content.map(p => p.text).join("");
}

// --- Response translation -----------------------------------------------

export type AnthropicResponse = Anthropic.Message;

export function anthropicToOpenAIResponse(resp: AnthropicResponse, model: string) {
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
  const toolCalls = resp.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b): OpenAIToolCall => ({
      id: b.id,
      type: "function",
      function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
    }));

  const finishReason =
    resp.stop_reason === "tool_use" ? "tool_calls" :
    resp.stop_reason === "end_turn" ? "stop" :
    resp.stop_reason === "max_tokens" ? "length" :
    "stop";

  return {
    id: resp.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: resp.usage.input_tokens,
      completion_tokens: resp.usage.output_tokens,
      total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
    },
  };
}

// --- Streaming (SSE) translation ----------------------------------------
// Vapi can also call us with stream:true. We translate Anthropic message
// stream events into OpenAI-style SSE chunks. Keep responses small —
// many TTS engines flush at sentence boundaries.

export function anthropicEventToOpenAIChunk(event: Anthropic.RawMessageStreamEvent, model: string, id: string) {
  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") {
      return {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
      };
    }
    if (event.delta.type === "input_json_delta") {
      // Tool argument streaming. OpenAI emits tool_calls deltas with partial
      // function.arguments. Vapi waits for the full args anyway, so we batch
      // these at content_block_stop in `flushBlock`.
      return null;
    }
  }
  if (event.type === "message_delta" && event.delta.stop_reason) {
    const finish =
      event.delta.stop_reason === "tool_use" ? "tool_calls" :
      event.delta.stop_reason === "end_turn" ? "stop" :
      event.delta.stop_reason === "max_tokens" ? "length" :
      "stop";
    return {
      id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: {}, finish_reason: finish }],
    };
  }
  return null;
}
