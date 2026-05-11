import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropic } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireAnthropic() });
  return client;
}

// Model picks. The agent brain runs on Sonnet 4.6 — high-volume, low latency,
// strong tool-use. Classification/summarization runs on Haiku 4.5.
export const MODELS = {
  brain: "claude-sonnet-4-6",
  summarize: "claude-sonnet-4-6",
  classify: "claude-haiku-4-5",
} as const;
