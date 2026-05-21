import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  sourceProspects,
  googlePlacesAvailable,
  type SourcedProspect,
} from "@/outreach/sourcing/google-places";
import { HRM_TIMEZONE } from "@/outreach/categories";
import { qualifyProspect } from "@/outreach/qualify";

// Source Halifax small-business prospects for the GTM engine. Runs a sweep
// across the chosen business categories x HRM communities, pulling from
// Google Places (or deterministic mock data when no key is set), upserts the
// results, then kicks off qualification in the background — no separate
// worker process required.

const Body = z.object({
  categories: z.array(z.string()).min(1).max(30),
  areas: z.array(z.string()).min(1).max(12),
  perQuery: z.number().int().min(1).max(20),
});

// Each category x area pair is one Places search. Cap the sweep so a single
// click can't fire hundreds of API calls.
const MAX_SEARCHES = 80;

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { categories, areas, perQuery } = parsed.data;

  const combos: Array<{ categoryId: string; area: string }> = [];
  for (const c of categories) for (const a of areas) combos.push({ categoryId: c, area: a });
  const truncated = combos.length > MAX_SEARCHES;
  const run = combos.slice(0, MAX_SEARCHES);

  const sourced: SourcedProspect[] = [];
  const errors: string[] = [];
  for (const combo of run) {
    try {
      const batch = await sourceProspects({
        categoryId: combo.categoryId,
        area: combo.area,
        limit: perQuery,
      });
      sourced.push(...batch);
    } catch (err) {
      errors.push(`${combo.categoryId} @ ${combo.area}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // De-dupe within this run before touching the DB.
  const seen = new Set<string>();
  const unique = sourced.filter(s => {
    const key = `${s.source}:${s.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let imported = 0;
  let skipped = 0;
  for (const s of unique) {
    const existing = await prisma.prospect.findUnique({
      where: { source_externalId: { source: s.source, externalId: s.externalId } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.prospect.create({
      data: { ...s, timezone: HRM_TIMEZONE, status: "new" },
    });
    imported++;
  }

  // Kick off qualification in the background. The dev server stays alive, so
  // this keeps running after the response is sent — the operator just refreshes
  // the Prospects page to watch fit scores appear. No worker process needed.
  void qualifyPendingProspects();

  return NextResponse.json({
    imported,
    skipped,
    searches: run.length,
    truncated,
    mock: !googlePlacesAvailable(),
    errors: errors.slice(0, 5),
  });
}

// Scores every prospect still awaiting a score (newly sourced plus any
// leftovers), in small parallel batches so it doesn't hammer the AI API.
async function qualifyPendingProspects() {
  try {
    const pending = await prisma.prospect.findMany({
      where: { status: "new" },
      select: { id: true },
      take: 1000,
    });
    const BATCH = 8;
    for (let i = 0; i < pending.length; i += BATCH) {
      const slice = pending.slice(i, i + BATCH);
      await Promise.all(slice.map(p => qualifyProspect(p.id).catch(() => undefined)));
    }
  } catch {
    /* best-effort background work */
  }
}
