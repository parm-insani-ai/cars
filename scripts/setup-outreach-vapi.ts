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
    // Let the prospect interrupt the opener — most natural-sounding callers
    // start talking the moment they realize Ava is a recording.
    firstMessageInterruptionsEnabled: true,
    firstMessage: `Hey, is this the owner or manager? I'll be quick — I'm calling because we help Halifax businesses stop missing customer calls after hours, during busy periods, or when staff are tied up. It's an AI receptionist that answers calls, takes messages, books appointments, and sends you the details. Are missed calls or voicemails something you deal with right now?`,
    model: {
      provider: "custom-llm",
      url: `${base}/api/outreach/llm`,
      model: "insani-outreach",
    },
    // ElevenLabs Flash v2.5 "Jessica" — warm, conversational female voice
    // with natural energy. Feels less corporate than Rachel; better fit for
    // small-business owners who don't want to feel sold to. The 1.05x speed
    // bump makes her sound confident without feeling rushed.
    voice: {
      provider: "11labs",
      voiceId: "cgSgspJ2msm6clMCkdW9",
      model: "eleven_flash_v2_5",
      speed: 1.05,
      stability: 0.5,
      similarityBoost: 0.75,
    },
    // Nova-3 is Deepgram's latest streaming model — same ~50ms latency as
    // Nova-2 but better accuracy on accents and noisy audio.
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    server: { url: `${base}/api/outreach/webhook` },
    // Snappier turn-taking. End-of-speech is the biggest single source of
    // perceived lag; lower wait + smart endpointing nearly halves it.
    silenceTimeoutSeconds: 30,
    // Interrupt on a single word so Ava actually stops when cut off.
    numWordsToInterruptAssistant: 1,
    startSpeakingPlan: {
      // Don't wait long after the caller stops talking — smart endpointing
      // handles the "still thinking" case; this is just the floor.
      waitSeconds: 0.1,
      // LiveKit's model fires sooner than Vapi's default and feels noticeably
      // snappier in real calls. Falls back to Vapi if the provider is down.
      smartEndpointingPlan: { provider: "livekit" },
      // Aggressive transcription endpointing. Defaults are 0.4s/1.5s/0.5s
      // which adds noticeable lag. These values fire sooner; LiveKit's
      // smart endpointing still vetoes mid-thought cuts.
      transcriptionEndpointingPlan: {
        onPunctuationSeconds: 0.1,
        onNoPunctuationSeconds: 0.8,
        onNumberSeconds: 0.4,
      },
    },
    // Backchanneling — Ava interjects brief "mhm" / "okay" while the
    // caller speaks. Makes the call feel ~300ms snappier even though
    // raw latency is unchanged.
    backchannelingEnabled: true,
    stopSpeakingPlan: {
      // Cut the TTS the moment voice activity is detected (100ms threshold),
      // and only let Ava resume after a brief backoff so cross-talk settles.
      numWords: 0,
      voiceSeconds: 0.1,
      backoffSeconds: 1,
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
