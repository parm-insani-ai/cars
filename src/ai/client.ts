import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropic } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireAnthropic() });
  return client;
}

// Model picks. The agent brain runs on Haiku 4.5 — about 3x faster to first
// token than Sonnet, which is what keeps voice conversations from feeling
// laggy. Quality is plenty for SDR/receptionist back-and-forth.
export const MODELS = {
  brain: "claude-haiku-4-5",
  summarize: "claude-sonnet-4-6",
  classify: "claude-haiku-4-5",
} as const;
