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
  // Best-guess owner name extracted from review text ("Bob was amazing" /
  // "Jennifer takes great care of us"). Null when no clear name emerges.
  // Lets Ava open with "Hi, is Jennifer around?" instead of the generic
  // "the owner or manager please" — dramatically better gatekeeper pass-
  // through in SMB cold calls.
  ownerName: string | null;
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
        // Review text is the source we extract owner names from.
        "places.reviews",
        "places.editorialSummary",
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
    ownerName: extractOwnerNameFromReviews(p.reviews, name),
  };
}

// Simple name-extraction over review text. Looks for owner-referring patterns
// ("Bob was amazing", "Jennifer is the best", "Sarah's team", "ask for Mike")
// and returns the name mentioned across the MOST reviews. Requires ≥2 mentions
// so a one-off customer name doesn't get picked. Returns null when nothing
// clears the bar.
//
// Heuristics — not perfect, but the false-positive cost is low: worst case Ava
// asks for "Jennifer" and gets "she doesn't work here anymore" which is still
// a warmer entry than "the owner or manager please".
export function extractOwnerNameFromReviews(reviews: any, businessName: string): string | null {
  if (!Array.isArray(reviews) || reviews.length === 0) return null;

  const OWNER_HINT_PATTERNS = [
    /\b([A-Z][a-z]{2,15})\s+was\s+(amazing|great|wonderful|so\s+kind|so\s+nice|so\s+helpful|so\s+professional|the\s+best|awesome|fantastic|excellent|super)/,
    /\b([A-Z][a-z]{2,15})\s+is\s+(amazing|great|wonderful|the\s+best|so\s+kind|so\s+nice|so\s+helpful|so\s+professional|awesome|fantastic|excellent)/,
    /\bask\s+for\s+([A-Z][a-z]{2,15})\b/i,
    /\b([A-Z][a-z]{2,15})['’]s\s+(team|shop|salon|studio|staff|crew)/,
    /\bthe\s+owner\s+([A-Z][a-z]{2,15})\b/i,
    /\bowner[,]?\s+([A-Z][a-z]{2,15})[,\s]/i,
    /\b([A-Z][a-z]{2,15})[,\s]+the\s+owner\b/i,
    /\b([A-Z][a-z]{2,15})\s+took\s+(great\s+)?care/,
    /\b([A-Z][a-z]{2,15})\s+did\s+(a\s+)?(great|amazing|wonderful|fantastic)/,
  ];

  const STOP_NAMES = new Set([
    // Common noise words that pattern-match as capitalized names but aren't.
    "Great","Amazing","Excellent","Best","Nice","Good","Bad","Terrible","Awful",
    "Very","Really","Super","Highly","Definitely","Absolutely","Would",
    "Halifax","Dartmouth","Bedford","Nova","Scotia","Canada",
    "Google","Yelp","Facebook",
    "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
    "January","February","March","April","May","June","July","August","September","October","November","December",
    "The","This","That","They","There","Their","Them","She","He","His","Her","Hers",
  ]);

  // Words in the business name are almost certainly not the owner's first name.
  const nameWords = new Set(businessName.split(/\s+/).map(w => w.replace(/[^A-Za-z]/g, "")).filter(Boolean));

  const counts = new Map<string, number>();
  for (const r of reviews) {
    const text: string = String(r?.text?.text ?? r?.originalText?.text ?? "");
    if (!text) continue;
    const seenInThisReview = new Set<string>();
    for (const pattern of OWNER_HINT_PATTERNS) {
      const m = text.match(pattern);
      if (!m) continue;
      const name = m[1];
      if (!name) continue;
      if (STOP_NAMES.has(name)) continue;
      if (nameWords.has(name)) continue;
      if (seenInThisReview.has(name)) continue;
      seenInThisReview.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  // Require ≥2 mentions across distinct reviews so a random customer's name
  // ("thanks to Susan for choosing us") doesn't get promoted to "the owner".
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (count < 2) continue;
    if (!best || count > best.count) best = { name, count };
  }
  return best?.name ?? null;
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
      ownerName: null,
    });
  }
  return out;
}
