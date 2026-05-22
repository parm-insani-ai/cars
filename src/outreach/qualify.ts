import { prisma } from "@/lib/prisma";
import { categoryLabel, groupLabel } from "./categories";

// Transparent prospect fit score (0-100). Fully deterministic — no AI
// guesswork, so the number is explainable and actually spreads.
//
// It estimates how good an outbound-sales prospect a Halifax business is,
// from the signals that genuinely differ between businesses:
//   - review count : proxy for how busy they are (more customers => more
//                    inbound calls => more MISSED calls). The dominant factor.
//   - has a phone  : you literally cannot call them otherwise.
//   - category     : a plumber out on job sites misses far more calls than a
//                    front-desk business.
//   - rating       : mild signal they care about customer experience.
//   - has a website: mild signal of an established, real business.
//
// A business with no phone, or with <=2 reviews (likely closed/fake/too new),
// is disqualified outright regardless of score.

export type QualifyResult = { score: number; qualified: boolean; note: string };

type ScoreInput = {
  category: string;
  categoryGroup: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
};

// Call-miss likelihood by business type (0-15 points).
const GROUP_POINTS: Record<string, number> = {
  home_services: 15,
  auto_retail: 12,
  wellness: 11,
};

const QUALIFY_THRESHOLD = 60;

export function scoreProspect(p: ScoreInput): QualifyResult {
  const hasPhone = Boolean(p.phone);
  const reviews = p.reviewsCount ?? 0;

  // Review count (0-55) — the dominant signal.
  let reviewPts = 0;
  if (reviews >= 200) reviewPts = 55;
  else if (reviews >= 75) reviewPts = 47;
  else if (reviews >= 25) reviewPts = 36;
  else if (reviews >= 10) reviewPts = 24;
  else if (reviews >= 3) reviewPts = 12;

  // Category (0-15).
  const categoryPts = GROUP_POINTS[p.categoryGroup] ?? 11;

  // Rating (0-10) — neutral score when there's no rating data.
  let ratingPts = 4;
  if (p.rating != null) {
    if (p.rating >= 4.5) ratingPts = 10;
    else if (p.rating >= 4.0) ratingPts = 8;
    else if (p.rating >= 3.0) ratingPts = 5;
    else ratingPts = 2;
  }

  // Reachability + legitimacy.
  const phonePts = hasPhone ? 12 : 0;
  const websitePts = p.website ? 8 : 0;

  const score = reviewPts + categoryPts + ratingPts + phonePts + websitePts;

  // Hard disqualifiers: unreachable, or almost certainly not a live business.
  const tooFewReviews = reviews <= 2;
  const qualified = hasPhone && !tooFewReviews && score >= QUALIFY_THRESHOLD;

  return {
    score,
    qualified,
    note: buildNote({ ...p, hasPhone, reviews, tooFewReviews, score }),
  };
}

function buildNote(
  a: ScoreInput & { hasPhone: boolean; reviews: number; tooFewReviews: boolean; score: number },
): string {
  if (!a.hasPhone) return "Disqualified: no phone number on file — there's no way to call them.";
  if (a.tooFewReviews) {
    return `Disqualified: only ${a.reviews} review${a.reviews === 1 ? "" : "s"} — likely closed, fake, or too new to be worth a call.`;
  }
  const tier = a.score >= 80 ? "Strong fit" : a.score >= QUALIFY_THRESHOLD ? "Fair fit" : "Weak fit";
  const ratingTxt = a.rating != null ? `, ${a.rating}★` : "";
  const tail =
    a.score >= QUALIFY_THRESHOLD
      ? ""
      : " — too few call-volume signals to prioritize over busier prospects.";
  return `${tier} (${a.score}/100): ${a.reviews} reviews, ${categoryLabel(a.category)} / ${groupLabel(a.categoryGroup)}${ratingTxt}.${tail}`;
}

// Scores one prospect and writes the result back. Used by the sourcing sweep
// and the per-prospect "Re-qualify" action.
export async function qualifyProspect(prospectId: string): Promise<QualifyResult | null> {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!p) return null;
  const result = scoreProspect(p);
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
