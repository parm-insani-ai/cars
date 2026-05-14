import { env } from "@/lib/env";
import type { Vertical } from "@prisma/client";

// Lead sourcing: find SMB prospects in a vertical + geography to sell Frontdesk
// to. Uses the Google Places API (New) Text Search. When no API key is set we
// fall back to deterministic synthetic prospects so the whole engine — sourcing,
// qualification, dialing, demo booking — runs end-to-end in mock mode.

export type SourcedProspect = {
  source: "google_places";
  externalId: string;
  businessName: string;
  vertical: Vertical;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewsCount: number | null;
};

// What to type into Places search for each vertical we sell into.
const VERTICAL_QUERY: Record<Vertical, string> = {
  dealership: "car dealership",
  service_shop: "auto repair shop",
  wellness: "med spa",
};

export function googlePlacesAvailable(): boolean {
  return Boolean(env.GOOGLE_PLACES_API_KEY);
}

export async function sourceProspects(args: {
  vertical: Vertical;
  location: string; // free-text, e.g. "Austin, TX"
  limit: number;
}): Promise<SourcedProspect[]> {
  const limit = Math.min(20, Math.max(1, args.limit));
  if (!googlePlacesAvailable()) return mockProspects({ ...args, limit });

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.location",
        "places.addressComponents",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: `${VERTICAL_QUERY[args.vertical]} in ${args.location}`,
      maxResultCount: limit,
    }),
  });
  if (!res.ok) {
    throw new Error(`Places searchText ${res.status}: ${await res.text()}`);
  }
  const j: any = await res.json();
  const places: any[] = j.places ?? [];
  return places.map(p => mapPlace(p, args.vertical)).filter((p): p is SourcedProspect => p !== null);
}

function mapPlace(p: any, vertical: Vertical): SourcedProspect | null {
  const id: string | undefined = p.id;
  const name: string | undefined = p.displayName?.text;
  if (!id || !name) return null;
  const components: any[] = p.addressComponents ?? [];
  const comp = (type: string) =>
    components.find(c => Array.isArray(c.types) && c.types.includes(type))?.shortText ?? null;
  return {
    source: "google_places",
    externalId: id,
    businessName: name,
    vertical,
    phone: normalizePhone(p.internationalPhoneNumber),
    website: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    city: comp("locality") ?? comp("postal_town"),
    region: comp("administrative_area_level_1"),
    postalCode: comp("postal_code"),
    country: comp("country") ?? "US",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewsCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
  };
}

// Best-effort E.164 normalization. Places returns numbers like "+1 512-555-0142".
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

// --- Mock mode ----------------------------------------------------------
// Deterministic synthetic prospects so the engine is fully exercisable with
// zero third-party keys. Names/numbers are obviously fake.

const MOCK_NAMES: Record<Vertical, string[]> = {
  dealership: ["Summit Auto Group", "Riverside Motors", "Crown City Cars", "Hilltop Auto Sales", "Bayline Automotive", "Greenfield Motors"],
  service_shop: ["Precision Auto Care", "Anytown Tire & Brake", "Hometown Garage", "Apex Service Center", "Cornerstone Auto Repair", "Lighthouse Mechanics"],
  wellness: ["Serenity Med Spa", "Bloom Wellness Studio", "Stillwater Spa", "Radiance Skin & Body", "Harbor Wellness Collective", "Lotus Day Spa"],
};

const MOCK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];

function mockProspects(args: { vertical: Vertical; location: string; limit: number }): SourcedProspect[] {
  const names = MOCK_NAMES[args.vertical];
  const out: SourcedProspect[] = [];
  for (let i = 0; i < args.limit; i++) {
    const name = names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : "");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    out.push({
      source: "google_places",
      externalId: `mock:${args.vertical}:${slug}:${args.location.toLowerCase().replace(/\W+/g, "-")}`,
      businessName: name,
      vertical: args.vertical,
      phone: `+1555${String(1000000 + i * 7919).slice(0, 7)}`,
      website: `https://example.com/${slug}`,
      address: `${100 + i * 13} Main St, ${args.location}`,
      city: args.location.split(",")[0]?.trim() ?? args.location,
      region: args.location.split(",")[1]?.trim() ?? null,
      postalCode: null,
      country: "US",
      lat: null,
      lng: null,
      rating: Number((3.4 + ((i * 37) % 16) / 10).toFixed(1)),
      reviewsCount: 12 + ((i * 53) % 400),
    });
  }
  return out;
}

// Picked up by the dispatcher / prospect detail to know which timezone to honor
// quiet hours in. Real Places sourcing doesn't return a timezone in the basic
// field set, so we spread mock prospects across a few for realism.
export function inferTimezone(p: SourcedProspect, index: number): string {
  void p;
  return MOCK_TIMEZONES[index % MOCK_TIMEZONES.length];
}
