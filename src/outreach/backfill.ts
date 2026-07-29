import { prisma } from "@/lib/prisma";
import { fetchPlaceReviews, extractOwnerNameFromReviews } from "./sourcing/google-places";

// One-shot backfill of Prospect.ownerName for prospects that were sourced
// before the owner-name extractor existed. Hits Google Places details for
// each and reruns the extractor over the fetched reviews.
//
// Batched. The endpoint is called with a `limit` (default 25) so a single
// Vercel serverless invocation stays under the 60s Hobby timeout even if
// Google Places is slow. The caller (a small client button) polls until
// `remaining === 0`.

export type BackfillResult = {
  processed: number;   // total prospects considered this batch (including no-op ones)
  enriched: number;    // how many got a name written in this batch
  remaining: number;   // rough count of prospects still needing backfill after this batch
  done: boolean;       // true when there are no more candidates to try
};

export async function backfillOwnerNamesBatch(limit = 25): Promise<BackfillResult> {
  // Only google_places prospects with a placeId (externalId), owner name
  // empty, and phone present (no point enriching a lead we can't dial).
  const candidates = await prisma.prospect.findMany({
    where: {
      source: "google_places",
      externalId: { not: null },
      ownerName: null,
      phone: { not: null },
    },
    select: { id: true, externalId: true, businessName: true },
    take: limit,
    orderBy: { createdAt: "asc" }, // process oldest first so we don't skip
  });

  let enriched = 0;
  for (const p of candidates) {
    if (!p.externalId) continue;
    const reviews = await fetchPlaceReviews(p.externalId);
    if (reviews.length === 0) continue;
    const name = extractOwnerNameFromReviews(reviews, p.businessName);
    if (!name) continue;
    await prisma.prospect.update({
      where: { id: p.id },
      data: { ownerName: name },
    });
    enriched++;
  }

  // Cheap "roughly how many left" — count remaining candidates after this
  // batch. If the batch was full, more likely exist; if partial, done.
  const remaining =
    candidates.length < limit
      ? 0
      : await prisma.prospect.count({
          where: {
            source: "google_places",
            externalId: { not: null },
            ownerName: null,
            phone: { not: null },
          },
        });

  return {
    processed: candidates.length,
    enriched,
    remaining,
    done: candidates.length === 0 || remaining === 0,
  };
}
