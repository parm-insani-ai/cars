import { anthropic, MODELS } from "@/ai/client";
import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";

// Qualifier: scores a freshly-sourced prospect for fit before we ever dial it.
// Cheap model, one call per prospect. Sets a 0–100 score and flips the status
// to `qualified` or `disqualified`. A heuristic fallback runs if the model
// can't be reached, so sourcing never silently strands prospects as `new`.

const QUALIFY_SYSTEM =
  `You qualify small businesses as sales prospects for "Frontdesk", an AI phone receptionist ` +
  `that answers calls, books appointments, and follows up. Good fits are real, established ` +
  `local SMBs in auto (dealerships, repair shops) or wellness (med spas, salons, clinics) that ` +
  `likely take inbound phone calls and have enough volume to miss some. Poor fits: businesses ` +
  `with almost no reviews (likely closed/fake), national chains, or anything outside those verticals. ` +
  `Output ONLY JSON: {"score": <0-100 integer>, "qualified": <boolean>, "note": "<one sentence why>"}.`;

type QualifyResult = { score: number; qualified: boolean; note: string };

export async function qualifyProspect(prospectId: string): Promise<QualifyResult | null> {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!p) return null;

  const facts = [
    `Name: ${p.businessName}`,
    `Vertical: ${p.vertical}`,
    p.city || p.region ? `Location: ${[p.city, p.region].filter(Boolean).join(", ")}` : null,
    p.rating != null ? `Google rating: ${p.rating} (${p.reviewsCount ?? 0} reviews)` : "No rating data",
    p.phone ? "Has a public phone number" : "No phone number on file",
    p.website ? `Website: ${p.website}` : "No website",
  ]
    .filter(Boolean)
    .join("\n");

  let result: QualifyResult;
  try {
    const client = anthropic();
    const resp = await client.messages.create({
      model: MODELS.classify,
      max_tokens: 200,
      system: QUALIFY_SYSTEM,
      messages: [{ role: "user", content: facts }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const j = JSON.parse(match[0]);
    result = {
      score: clampScore(j.score),
      qualified: Boolean(j.qualified),
      note: String(j.note ?? "").slice(0, 280),
    };
  } catch {
    result = heuristicQualify(p.rating, p.reviewsCount, Boolean(p.phone));
  }

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      score: result.score,
      status: result.qualified ? "qualified" : "disqualified",
      qualificationNote: result.note,
    },
  });
  return result;
}

function clampScore(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

// No-API fallback: a phone number plus a believable review count is most of
// the signal. Keeps the engine fully usable in mock mode.
function heuristicQualify(rating: number | null, reviews: number | null, hasPhone: boolean): QualifyResult {
  let score = 40;
  if (hasPhone) score += 25;
  if ((reviews ?? 0) >= 10) score += 20;
  if ((reviews ?? 0) >= 100) score += 5;
  if (rating != null && rating >= 3.5) score += 10;
  score = Math.min(100, score);
  const qualified = hasPhone && (reviews ?? 0) >= 5;
  return {
    score,
    qualified,
    note: qualified
      ? "Heuristic: has a phone line and an established review presence."
      : "Heuristic: missing a phone number or too few reviews to call confidently.",
  };
}
