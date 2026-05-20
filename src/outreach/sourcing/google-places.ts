import { env } from "@/lib/env";
import { categoryById, type ProspectCategory } from "@/outreach/categories";

// Lead sourcing: find Halifax small businesses to sell the AI receptionist to.
// Searches the Google Places API (New) Text Search by business category +
// HRM community. When no API key is set we fall back to deterministic
// synthetic prospects so the whole engine runs end-to-end in mock mode.

export type SourcedProspect = {
  source: "google_places";
  externalId: string;
  businessName: string;
  category: string;        // catalog id
  categoryGroup: string;   // home_services | wellness | auto_retail
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

export function googlePlacesAvailable(): boolean {
  return Boolean(env.GOOGLE_PLACES_API_KEY);
}

export async function sourceProspects(args: {
  categoryId: string;
  area: string; // an HRM community, e.g. "Dartmouth, NS"
  limit: number;
}): Promise<SourcedProspect[]> {
  const category = categoryById(args.categoryId);
  if (!category) throw new Error(`Unknown category: ${args.categoryId}`);
  const limit = Math.min(20, Math.max(1, args.limit));
  if (!googlePlacesAvailable()) return mockProspects(category, args.area, limit);

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
      textQuery: `${category.query} in ${args.area}`,
      maxResultCount: limit,
      regionCode: "CA",
    }),
  });
  if (!res.ok) {
    throw new Error(`Places searchText ${res.status}: ${await res.text()}`);
  }
  const j: any = await res.json();
  const places: any[] = j.places ?? [];
  return places.map(p => mapPlace(p, category)).filter((p): p is SourcedProspect => p !== null);
}

function mapPlace(p: any, category: ProspectCategory): SourcedProspect | null {
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
    category: category.id,
    categoryGroup: category.group,
    phone: normalizePhone(p.internationalPhoneNumber),
    website: p.websiteUri ?? null,
    address: p.formattedAddress ?? null,
    city: comp("locality") ?? comp("postal_town"),
    region: comp("administrative_area_level_1"),
    postalCode: comp("postal_code"),
    country: comp("country") ?? "CA",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewsCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
  };
}

// Best-effort E.164 normalization. Places returns numbers like "+1 902-555-0142".
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
// Deterministic synthetic Halifax prospects so the engine is fully usable
// with zero third-party keys. Names/numbers are obviously fake (902 = the
// Halifax area code).

const MOCK_PREFIXES = [
  "Atlantic", "Harbour City", "Maritime", "Bluenose", "Citadel", "Peninsula",
  "East Coast", "Northwood", "Bedford Basin", "Spring Garden", "Quinpool",
  "Armdale", "Fairview", "Seaport",
];

function mockProspects(category: ProspectCategory, area: string, limit: number): SourcedProspect[] {
  const city = area.split(",")[0]?.trim() || area;
  const areaSlug = area.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const out: SourcedProspect[] = [];
  for (let i = 0; i < limit; i++) {
    const prefix = MOCK_PREFIXES[(i * 5 + category.id.length) % MOCK_PREFIXES.length];
    const name = `${prefix} ${category.mockNoun}`;
    out.push({
      source: "google_places",
      externalId: `mock:${category.id}:${areaSlug}:${i}`,
      businessName: name,
      category: category.id,
      categoryGroup: category.group,
      phone: `+1902${String(5550000 + i * 137 + category.id.length * 911).slice(0, 7)}`,
      website: `https://example.com/${category.id}-${areaSlug}-${i}`,
      address: `${100 + i * 17} Main St, ${city}, NS`,
      city,
      region: "NS",
      postalCode: null,
      country: "CA",
      lat: null,
      lng: null,
      rating: Number((3.6 + ((i * 37) % 14) / 10).toFixed(1)),
      reviewsCount: 8 + ((i * 53 + category.id.length * 17) % 340),
    });
  }
  return out;
}
