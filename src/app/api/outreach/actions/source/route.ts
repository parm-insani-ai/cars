import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sourceProspects, googlePlacesAvailable, inferTimezone } from "@/outreach/sourcing/google-places";
import { inngest } from "@/inngest/client";

// Source SMB prospects for the GTM engine. Pulls from Google Places (or mock
// data when no key is set), upserts them onto the prospect island, and kicks
// off qualification. Admin-gated like the rest of /outreach.

const Body = z.object({
  vertical: z.enum(["dealership", "service_shop", "wellness"]),
  location: z.string().min(2).max(120),
  limit: z.number().int().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { vertical, location, limit } = parsed.data;

  let sourced;
  try {
    sourced = await sourceProspects({ vertical, location, limit });
  } catch (err) {
    return NextResponse.json(
      { error: "source_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const newIds: string[] = [];
  let imported = 0;
  let skipped = 0;
  for (let i = 0; i < sourced.length; i++) {
    const s = sourced[i];
    const existing = await prisma.prospect.findUnique({
      where: { source_externalId: { source: s.source, externalId: s.externalId } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const created = await prisma.prospect.create({
      data: {
        source: s.source,
        externalId: s.externalId,
        businessName: s.businessName,
        vertical: s.vertical,
        phone: s.phone,
        website: s.website,
        address: s.address,
        city: s.city,
        region: s.region,
        postalCode: s.postalCode,
        country: s.country,
        timezone: inferTimezone(s, i),
        lat: s.lat,
        lng: s.lng,
        rating: s.rating,
        reviewsCount: s.reviewsCount,
        status: "new",
      },
    });
    newIds.push(created.id);
    imported++;
  }

  if (newIds.length > 0) {
    await inngest.send({ name: "outreach/prospects.sourced", data: { prospectIds: newIds } }).catch(() => undefined);
  }

  return NextResponse.json({
    imported,
    skipped,
    mock: !googlePlacesAvailable(),
  });
}
