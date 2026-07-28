import { anthropic, MODELS } from "@/ai/client";
import {
  anthropicToOpenAIResponse,
  openAIToAnthropic,
  type OpenAIRequest,
} from "@/ai/openai-translate";
import { buildOutreachSystemPrompt } from "./system-prompt";
import { getOutreachToolSchemas } from "./tools";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { smsAdapter } from "@/integrations/sms";
import type Anthropic from "@anthropic-ai/sdk";

// One turn of an outbound AI sales call. Called by Vapi via our outreach
// OpenAI-compatible LLM endpoint. The system prompt (campaign pitch + prospect
// context) is the stable per-call prefix, so we cache it.

export async function runOutreachTurn(args: {
  outreachCallId: string;
  openaiRequest: OpenAIRequest;
}) {
  const t0 = Date.now();

  const call = await prisma.outreachCall.findUnique({
    where: { id: args.outreachCallId },
    include: { prospect: true, campaign: true },
  });
  if (!call) throw new Error("outreach_call_not_found");
  if (!call.campaign) throw new Error("outreach_campaign_missing");

  const systemPrompt = buildOutreachSystemPrompt({
    campaign: call.campaign,
    prospect: call.prospect,
  });
  const tools = getOutreachToolSchemas();

  const { messages: priorMessages } = openAIToAnthropic(args.openaiRequest.messages);

  // On outbound calls Vapi speaks first (the static firstMessage), so the
  // conversation Vapi sends us starts with the assistant's opener. Anthropic
  // requires the first message to be user — prepend a synthetic "answering
  // the phone" user turn so the alternation is valid and the model actually
  // generates a reply (otherwise it silently returns 0 output tokens).
  if (priorMessages.length === 0 || priorMessages[0].role !== "user") {
    priorMessages.unshift({ role: "user", content: "(answering the phone) Hello?" });
  }

  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.brain,
    max_tokens: 512,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools,
    messages: priorMessages,
  });

  const openaiResp = anthropicToOpenAIResponse(resp, args.openaiRequest.model ?? "insani-outreach");

  const assistantText = openaiResp.choices[0].message.content ?? "";
  if (assistantText) {
    await prisma.outreachTurn.create({
      data: { callId: args.outreachCallId, role: "agent", text: assistantText },
    });
  }
  for (const block of resp.content) {
    if (block.type === "tool_use") {
      await prisma.outreachTurn.create({
        data: {
          callId: args.outreachCallId,
          role: "tool",
          text: `→ ${block.name}(${JSON.stringify(block.input)})`,
        },
      });
    }
  }

  const latencyMs = Date.now() - t0;
  await prisma.aiEval
    .create({
      data: {
        businessId: null,
        task: "outreach_turn",
        input: { messages: args.openaiRequest.messages } as any,
        output: openaiResp as any,
        model: MODELS.brain,
        latencyMs,
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
        cacheReadTokens: resp.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: resp.usage.cache_creation_input_tokens ?? 0,
      },
    })
    .catch(() => undefined);

  return openaiResp;
}

// Summarize a finished outbound sales call: 1-paragraph summary + a disposition
// classification. Run from the end-of-call webhook. Only fills disposition if a
// tool didn't already set one.
export async function summarizeOutreachCall(outreachCallId: string) {
  console.log(`[summarize] starting for ${outreachCallId}`);
  const call = await prisma.outreachCall.findUnique({
    where: { id: outreachCallId },
    include: { turns: { orderBy: { startedAt: "asc" } }, prospect: true },
  });
  if (!call) {
    console.log(`[summarize] call ${outreachCallId} not found in DB`);
    return;
  }
  const transcript = call.turns
    .filter(t => t.role !== "tool")
    .map(t => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  if (!transcript) {
    console.log(`[summarize] call ${outreachCallId} has no turns to summarize; sending SMS with fallback text`);
    // Even without a transcript we still want the operator notified that a
    // call ended. Await so Vercel doesn't kill it in the background.
    try {
      await notifyOperatorAfterCall({
        outreachCallId,
        businessName: call.prospect.businessName,
        disposition: call.disposition,
        summary: "(no conversation captured — call may have hit voicemail or ended before a turn was recorded)",
      });
    } catch (err) {
      console.error("notifyOperatorAfterCall failed:", err);
    }
    return;
  }

  console.log(`[summarize] calling Anthropic for ${outreachCallId}, transcript length=${transcript.length}`);
  const client = anthropic();
  const resp = await client.messages.create({
    model: MODELS.summarize,
    max_tokens: 300,
    system:
      `You summarize outbound AI sales calls selling an AI receptionist to ${call.prospect.businessName}. ` +
      `Output ONLY JSON: {"summary": "...", "disposition": "demo_booked"|"callback_requested"|"not_interested"|"no_answer"|"voicemail"|"wrong_number"|"bad_fit"|"gatekeeper_blocked"|"do_not_call"}. ` +
      `Summary is one paragraph under 60 words.`,
    messages: [{ role: "user", content: transcript }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
  console.log(`[summarize] anthropic returned, text length=${text.length}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.log(`[summarize] no JSON block in anthropic response; sending SMS with best-effort text`);
    try {
      await notifyOperatorAfterCall({
        outreachCallId,
        businessName: call.prospect.businessName,
        disposition: call.disposition,
        summary: text.slice(0, 500) || "(summary generation failed)",
      });
    } catch (err) {
      console.error("notifyOperatorAfterCall failed:", err);
    }
    return;
  }
  try {
    const j = JSON.parse(match[0]);
    const valid = [
      "demo_booked", "callback_requested", "not_interested", "no_answer",
      "voicemail", "wrong_number", "bad_fit", "gatekeeper_blocked", "do_not_call",
    ];
    const finalDisposition = call.disposition ?? (valid.includes(j.disposition) ? j.disposition : null);
    const finalSummary = String(j.summary ?? "").slice(0, 1000);
    await prisma.outreachCall.update({
      where: { id: outreachCallId },
      data: {
        summary: finalSummary,
        disposition: finalDisposition,
      },
    });
    // AWAIT the SMS so Vercel keeps the function alive until Twilio responds.
    // On Vercel Serverless, background promises are killed once the response
    // returns; fire-and-forget silently dropped every SMS.
    try {
      await notifyOperatorAfterCall({
        outreachCallId,
        businessName: call.prospect.businessName,
        disposition: finalDisposition,
        summary: finalSummary,
      });
    } catch (err) {
      console.error("notifyOperatorAfterCall failed:", err);
    }

    // Multi-touch outreach: when Ava hits voicemail, follow up with a text
    // to the prospect's business number. SMB owners live on their phones for
    // texts — a follow-up SMS within a minute of a voicemail typically
    // 3-5x's your effective connect rate over voicemail alone. Same await
    // discipline as the operator SMS so Vercel doesn't kill it.
    if (finalDisposition === "voicemail") {
      try {
        await sendVoicemailFollowUpToProspect({
          prospect: call.prospect,
          campaignId: call.campaignId,
          outreachCallId,
        });
      } catch (err) {
        console.error("sendVoicemailFollowUpToProspect failed:", err);
      }
    }
  } catch (err) {
    console.error(`[summarize] JSON parse or DB update failed for ${outreachCallId}:`, err);
  }
}

// SMS notification to the operator after every outbound call ends. Includes
// business called, disposition, one-paragraph summary, and a link back to the
// full transcript in the dashboard. Silent if OPERATOR_NOTIFICATION_PHONE is
// not configured.
const DISPOSITION_TEXT: Record<string, string> = {
  demo_booked:         "Demo booked ✓",
  callback_requested:  "Callback requested",
  not_interested:      "Not interested",
  no_answer:           "No answer",
  voicemail:           "Left voicemail",
  wrong_number:        "Wrong number",
  bad_fit:             "Bad fit",
  gatekeeper_blocked:  "Blocked by gatekeeper",
  do_not_call:         "Added to DNC",
};

async function notifyOperatorAfterCall(args: {
  outreachCallId: string;
  businessName: string;
  disposition: string | null;
  summary: string;
}) {
  if (!env.OPERATOR_NOTIFICATION_PHONE) {
    console.log("notifyOperatorAfterCall: skipped — OPERATOR_NOTIFICATION_PHONE not set");
    return;
  }

  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const url = base ? `${base}/outreach/calls/${args.outreachCallId}` : "";
  const dispositionLine = args.disposition
    ? DISPOSITION_TEXT[args.disposition] ?? args.disposition
    : "Ended (no outcome recorded)";

  const body =
    `${env.OUTREACH_COMPANY_NAME} call: ${args.businessName}\n` +
    `Result: ${dispositionLine}\n\n` +
    `${args.summary || "(no summary generated)"}\n\n` +
    (url ? `Transcript: ${url}` : "");

  const adapter = smsAdapter();
  console.log(`notifyOperatorAfterCall: sending via ${adapter.provider} to ${env.OPERATOR_NOTIFICATION_PHONE}`);
  const result = await adapter.send({ to: env.OPERATOR_NOTIFICATION_PHONE, body });
  console.log(`notifyOperatorAfterCall: sent, externalId=${result.externalId}`);
}

// Follow-up SMS to the PROSPECT right after Ava leaves a voicemail. Guarded
// three ways: (1) global kill-switch env var OUTREACH_SMS_FOLLOWUP_DISABLED,
// (2) prospect on the do-not-call list, (3) no phone number on file. Logs
// every attempt (sent OR skipped) to outreachToolCall so the call-detail
// page shows exactly what happened.
async function sendVoicemailFollowUpToProspect(args: {
  prospect: { id: string; businessName: string; ownerName: string | null; phone: string | null; doNotCall: boolean };
  campaignId: string | null;
  outreachCallId: string;
}) {
  const { prospect, outreachCallId } = args;

  const logSkip = (reason: string) =>
    prisma.outreachToolCall
      .create({
        data: {
          callId: outreachCallId,
          toolName: "sms_followup_skipped",
          input: { reason } as any,
          output: { skipped: true } as any,
          latencyMs: 0,
        },
      })
      .catch(() => undefined);

  if (process.env.OUTREACH_SMS_FOLLOWUP_DISABLED === "1" || process.env.OUTREACH_SMS_FOLLOWUP_DISABLED === "true") {
    await logSkip("global kill switch on");
    return;
  }
  if (!prospect.phone) {
    await logSkip("prospect has no phone number");
    return;
  }
  if (prospect.doNotCall) {
    await logSkip("prospect is on do-not-call list");
    return;
  }

  // Twilio auto-handles carrier-level STOP compliance for us — replying STOP
  // suppresses future messages from our number to theirs at the Twilio layer.
  // We include "Reply STOP to opt out" in the body so it's explicit to the
  // recipient too, per SMS best practices.
  const greeting = prospect.ownerName ? `Hi ${prospect.ownerName.split(" ")[0]},` : "Hi,";
  const body =
    `${greeting} this is Ava from ${env.OUTREACH_COMPANY_NAME} — I just left you a voicemail. ` +
    `Wanted to see if I could grab a quick 15 minutes to show you how we help Halifax businesses answer every call and book more appointments. ` +
    `Reply here if easier, or visit insani.ai. Reply STOP to opt out.`;

  const adapter = smsAdapter();
  console.log(`[voicemail-followup] sending via ${adapter.provider} to ${prospect.phone} (prospect ${prospect.id})`);
  try {
    const result = await adapter.send({ to: prospect.phone, body });
    console.log(`[voicemail-followup] sent, externalId=${result.externalId}`);
    await prisma.outreachToolCall.create({
      data: {
        callId: outreachCallId,
        toolName: "sms_followup_sent",
        input: { to: prospect.phone, body } as any,
        output: { externalId: result.externalId } as any,
        latencyMs: 0,
      },
    }).catch(() => undefined);
  } catch (err) {
    console.error("[voicemail-followup] Twilio rejected:", err);
    await logSkip(`Twilio error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
