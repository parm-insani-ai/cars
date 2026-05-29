import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic, MODELS } from "@/ai/client";
import { buildOutreachSystemPrompt } from "@/outreach/system-prompt";
import { getOutreachToolSchemas } from "@/outreach/tools";
import type Anthropic from "@anthropic-ai/sdk";

// Text-mode simulator for the outbound AI sales rep. Same brain + system prompt
// as a real call, but driven by typed turns instead of voice — so the persona,
// context, and persuasion can be tuned instantly and for free. Tool calls are
// surfaced (not executed against the database).

const Body = z.object({
  campaignId: z.string().optional(),
  messages: z.array(z.object({ role: z.enum(["rep", "prospect"]), text: z.string() })).max(60),
});

// A realistic Halifax prospect to rehearse against.
const SAMPLE_PROSPECT = {
  businessName: "Bloom Day Spa",
  category: "day_spa",
  categoryGroup: "wellness",
  city: "Halifax",
  region: "NS",
  rating: 4.7,
  reviewsCount: 132,
  website: "https://example.com/bloom-day-spa",
  ownerName: null,
  qualificationNote: null,
};

const DEFAULT_CAMPAIGN = {
  goal: "Introduce the AI receptionist, uncover whether they miss calls, and book a 15-minute demo.",
  pitch: "An AI phone receptionist that answers every call, books appointments, and follows up — so the business never misses a customer.",
  offer: "First 14 days free.",
  repName: "Ava",
};

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { campaignId, messages } = parsed.data;

  let campaign = DEFAULT_CAMPAIGN;
  if (campaignId) {
    const c = await prisma.outreachCampaign.findUnique({ where: { id: campaignId } });
    if (c) campaign = { goal: c.goal, pitch: c.pitch, offer: c.offer ?? undefined, repName: c.repName } as typeof DEFAULT_CAMPAIGN;
  }

  const system = buildOutreachSystemPrompt({ campaign, prospect: SAMPLE_PROSPECT });
  const tools = getOutreachToolSchemas();

  // rep -> assistant, prospect -> user. Anthropic needs the first message to be
  // a user turn, so prepend the prospect "answering the phone".
  const aMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role === "rep" ? ("assistant" as const) : ("user" as const),
    content: m.text,
  }));
  if (aMessages.length === 0 || aMessages[0].role !== "user") {
    aMessages.unshift({ role: "user", content: "(answering the phone) Hello?" });
  }

  const resp = await anthropic().messages.create({
    model: MODELS.brain,
    max_tokens: 400,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools,
    messages: aMessages,
  });

  const reply = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join(" ")
    .trim();
  const toolCalls = resp.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map(b => ({ name: b.name, input: b.input }));

  return NextResponse.json({ reply, toolCalls });
}
