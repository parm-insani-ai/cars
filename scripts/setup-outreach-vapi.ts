import { readFileSync } from "node:fs";

// Provisions (creates or updates) the Vapi assistant the outbound AI sales rep
// uses. Points Vapi at this app's outreach endpoints. Run with:
//   npm run outreach:setup-vapi
// Requires VAPI_API_KEY and PUBLIC_BASE_URL in .env. If
// VAPI_OUTREACH_ASSISTANT_ID is already set, it updates that assistant instead
// of creating a new one.

function loadEnv() {
  try {
    const txt = readFileSync(".env", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    /* no .env — rely on real env */
  }
}

async function main() {
  loadEnv();

  const apiKey = process.env.VAPI_API_KEY;
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const company = process.env.OUTREACH_COMPANY_NAME || "Insani AI";
  const existingId = process.env.VAPI_OUTREACH_ASSISTANT_ID || "";

  if (!apiKey) {
    console.error("✗ VAPI_API_KEY is not set in .env. Add it and re-run.");
    process.exit(1);
  }
  if (!base) {
    console.error("✗ PUBLIC_BASE_URL is not set in .env (your ngrok https URL). Add it and re-run.");
    process.exit(1);
  }

  // NOTE: voice is deliberately NOT set here. Vapi's voice catalog changes
  // (legacy voices get retired and rejected on update), so the voice is chosen
  // in the Vapi dashboard (Assistants -> Voice), which only offers valid ones
  // and lets you preview. Omitting it here means this script never touches the
  // voice — it only keeps the call endpoints pointed at the right URL.
  const config = {
    name: `${company} — Outreach SDR`,
    firstMessageMode: "assistant-speaks-first",
    firstMessage: `Hi, this is Ava with ${company} — I'll be upfront, I'm an AI. I'm calling about something that quietly costs most small businesses thousands every month. Mind if I take thirty seconds?`,
    model: {
      provider: "custom-llm",
      url: `${base}/api/outreach/llm`,
      model: "frontdesk-outreach",
    },
    transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
    server: { url: `${base}/api/outreach/webhook` },
    // Snappier turn-taking. End-of-speech is the biggest single source of
    // perceived lag; lower wait + smart endpointing nearly halves it.
    silenceTimeoutSeconds: 30,
    numWordsToInterruptAssistant: 2,
    startSpeakingPlan: {
      waitSeconds: 0.2,
      smartEndpointingPlan: { provider: "vapi" },
    },
  };

  const url = existingId ? `https://api.vapi.ai/assistant/${existingId}` : "https://api.vapi.ai/assistant";
  const method = existingId ? "PATCH" : "POST";

  console.log(`${existingId ? "Updating" : "Creating"} the outreach assistant on Vapi…`);
  console.log(`  LLM endpoint:     ${base}/api/outreach/llm`);
  console.log(`  Webhook endpoint: ${base}/api/outreach/webhook`);

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`\n✗ Vapi returned ${res.status}:`);
    console.error(text);
    console.error("\nPaste this error to Claude and we'll fix the field it's complaining about.");
    process.exit(1);
  }

  const j = JSON.parse(text);
  console.log("\n✓ Assistant ready.");
  console.log(`  Assistant ID: ${j.id}`);
  console.log("\nNext: put this line in your .env (replace any existing one):");
  console.log(`  VAPI_OUTREACH_ASSISTANT_ID=${j.id}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
