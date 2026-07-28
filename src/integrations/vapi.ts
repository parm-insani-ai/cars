import crypto from "node:crypto";

// Thin Vapi client. Vapi runs the voice pipeline; we point its custom-LLM
// configuration at our /api/voice/llm endpoint and its tool implementations
// at /api/voice/tools/*. Vapi handles audio, turn-taking, STT, TTS, voicemail
// detection, recording, transcription. We own the brain (Anthropic Claude).

const API_BASE = process.env.VAPI_API_BASE ?? "https://api.vapi.ai";

export function vapiAvailable(): boolean {
  return Boolean(process.env.VAPI_API_KEY);
}

async function vapiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi ${path} ${res.status}: ${body}`);
  }
  return res;
}

// Verify the signature Vapi attaches to webhooks. Vapi signs the raw body
// with a shared secret using HMAC-SHA256.
// Header: x-vapi-signature
export function verifyVapiSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode — no secret configured, accept everything
  if (!signatureHeader) return false;
  const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Constant-time compare.
  if (computed.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}

export type VapiAssistantConfig = {
  name: string;
  firstMessage: string;
  voice: { provider: string; voiceId: string };
  model: {
    provider: "custom-llm";
    url: string;          // points at our /api/voice/llm
    model: string;
  };
  transcriber: { provider: string; language: string };
  serverUrl: string;      // points at our /api/voice/webhook
};

export async function createOrUpdateAssistant(args: {
  existingId: string | null;
  config: VapiAssistantConfig;
}): Promise<{ id: string }> {
  if (args.existingId) {
    const res = await vapiFetch(`/assistant/${args.existingId}`, {
      method: "PATCH",
      body: JSON.stringify(args.config),
    });
    const j: any = await res.json();
    return { id: j.id ?? args.existingId };
  }
  const res = await vapiFetch(`/assistant`, {
    method: "POST",
    body: JSON.stringify(args.config),
  });
  const j: any = await res.json();
  return { id: j.id };
}

export async function placeOutboundCall(args: {
  assistantId: string;
  phoneNumberId: string;    // Vapi phone number id to dial FROM
  customer: { number: string; name?: string };
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const res = await vapiFetch(`/call/phone`, {
    method: "POST",
    body: JSON.stringify({
      assistantId: args.assistantId,
      phoneNumberId: args.phoneNumberId,
      customer: args.customer,
      metadata: args.metadata,
    }),
  });
  const j: any = await res.json();
  return { id: j.id };
}

// Play DTMF tones into a live Vapi call. Used by Ava's press_digits tool
// to navigate IVR menus (e.g. "press 0 for operator"). The Vapi call/{id}/
// control endpoint accepts a "dtmf" type with the digits string; Vapi
// injects the tones into the audio stream in real time.
export async function sendDtmf(vapiCallId: string, digits: string): Promise<void> {
  await vapiFetch(`/call/${vapiCallId}/control`, {
    method: "POST",
    body: JSON.stringify({ type: "dtmf", digits }),
  });
}
