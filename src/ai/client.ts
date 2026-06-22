import Anthropic from "@anthropic-ai/sdk";
import https from "node:https";
import { requireAnthropic } from "@/lib/env";

// HTTPS agent with keep-alive on — reuses TCP connections across calls to
// api.anthropic.com instead of re-handshaking every turn. Saves ~30-50ms
// per LLM call in steady state.
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 50,
});

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: requireAnthropic(),
      httpAgent: keepAliveAgent,
    });
  }
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
