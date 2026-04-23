import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropic } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireAnthropic() });
  return client;
}

export const MODELS = {
  draft: "claude-sonnet-4-6",
  summarize: "claude-sonnet-4-6",
  classify: "claude-haiku-4-5",
  score: "claude-haiku-4-5",
} as const;
