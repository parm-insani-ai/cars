import { anthropic, MODELS } from "./client";

// Classification & summarization live on Haiku 4.5 — they run in bulk
// (scoring, transcript processing) so we want the cheaper/faster model.

export type CallSummary = {
  summary: string;
  intent: "shopping" | "service" | "finance" | "trade" | "general";
  objections: string[];
  next_action: string;
};

export async function summarizeCall(transcript: string): Promise<CallSummary> {
  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.summarize,
    max_tokens: 512,
    system: CALL_SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Summarize this call transcript strictly as a JSON object matching the schema. No prose outside JSON.\n\nTRANSCRIPT:\n${transcript}`,
      },
    ],
  });

  const text = resp.content
    .filter((b): b is Extract<(typeof resp.content)[number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseCallSummary(text);
}

const CALL_SUMMARY_SYSTEM = `You classify dealership phone calls. Output ONLY a JSON object with this shape:
{
  "summary": "one paragraph, <= 60 words, focused on what would help a sales manager decide the next action",
  "intent": "shopping" | "service" | "finance" | "trade" | "general",
  "objections": ["price_too_high", "wants_lower_payment", "needs_spouse_approval", "unhappy_with_trade", "not_ready", ...],
  "next_action": "<= 20 words, concrete (\"call back today with a trade appraisal\")"
}
Use only the canonical objection tags you see in the examples. Don't invent new ones.`;

function parseCallSummary(text: string): CallSummary {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallbackSummary();
  try {
    const obj = JSON.parse(match[0]);
    return {
      summary: String(obj.summary ?? "").slice(0, 1000),
      intent: ["shopping", "service", "finance", "trade", "general"].includes(obj.intent)
        ? obj.intent
        : "general",
      objections: Array.isArray(obj.objections) ? obj.objections.map(String).slice(0, 8) : [],
      next_action: String(obj.next_action ?? "").slice(0, 200),
    };
  } catch {
    return fallbackSummary();
  }
}

function fallbackSummary(): CallSummary {
  return {
    summary: "Could not summarize call — treat as unclassified and route to a rep.",
    intent: "general",
    objections: [],
    next_action: "Call back within 15 minutes",
  };
}

// --- Lead intent classifier (inbound reply) ----------------------------
export type ReplyIntent = {
  intent: "set_appointment" | "ask_question" | "negotiate" | "opt_out" | "unrelated";
  proposed_time_iso: string | null;
  urgency: "hot" | "warm" | "cold";
};

export async function classifyReply(rawSms: string): Promise<ReplyIntent> {
  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.classify,
    max_tokens: 200,
    system: `You classify an inbound SMS from a car shopper. Output ONLY JSON:
{"intent": "set_appointment" | "ask_question" | "negotiate" | "opt_out" | "unrelated",
 "proposed_time_iso": <ISO 8601 if they proposed a specific time, else null>,
 "urgency": "hot" | "warm" | "cold"}
No prose.`,
    messages: [{ role: "user", content: rawSms }],
  });
  const text = resp.content
    .filter((b): b is Extract<(typeof resp.content)[number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { intent: "unrelated", proposed_time_iso: null, urgency: "cold" };
  try {
    const obj = JSON.parse(match[0]);
    return {
      intent: ["set_appointment", "ask_question", "negotiate", "opt_out", "unrelated"].includes(obj.intent)
        ? obj.intent
        : "unrelated",
      proposed_time_iso: typeof obj.proposed_time_iso === "string" ? obj.proposed_time_iso : null,
      urgency: ["hot", "warm", "cold"].includes(obj.urgency) ? obj.urgency : "cold",
    };
  } catch {
    return { intent: "unrelated", proposed_time_iso: null, urgency: "cold" };
  }
}
