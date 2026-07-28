// The operator's prospecting catalog: Halifax small-business types that are a
// strong fit for an AI voice receptionist — phone-heavy, appointment- or
// quote-driven, with a small front desk that can't always pick up.
//
// Deliberately NOT tied to the customer product's three verticals. We also
// deliberately exclude doctors, dentists, and medical clinics: patient-privacy
// regulation (Nova Scotia's PHIA) makes regulated healthcare a poor first
// market to sell into.

export type CategoryGroup = "home_services" | "wellness" | "auto_retail";

export type ProspectCategory = {
  id: string;
  label: string;
  group: CategoryGroup;
  query: string;     // Google Places text-search phrase
  mockNoun: string;  // used to name synthetic prospects in mock mode
};

export const CATEGORY_GROUPS: { id: CategoryGroup; label: string; hook: string }[] = [
  {
    id: "home_services",
    label: "Home services",
    hook: "When the crew is out on a job, the office phone rings out — and that caller just dials the next company on the list. Every missed call is a missed job.",
  },
  {
    id: "wellness",
    label: "Wellness & personal care",
    hook: "The front desk can't answer mid-appointment. Those missed calls are bookings walking straight to a competitor down the street.",
  },
  {
    id: "auto_retail",
    label: "Auto & local retail",
    hook: "A busy counter means the phone goes unanswered — and an unanswered phone is a booking or a quote that never happens.",
  },
];

export const CATEGORIES: ProspectCategory[] = [
  // --- Home services ---------------------------------------------------
  { id: "plumber",            label: "Plumber",            group: "home_services", query: "plumber",                mockNoun: "Plumbing" },
  { id: "electrician",        label: "Electrician",        group: "home_services", query: "electrician",            mockNoun: "Electric" },
  { id: "hvac",               label: "Heating & cooling",  group: "home_services", query: "HVAC contractor",        mockNoun: "Heating & Cooling" },
  { id: "roofer",             label: "Roofer",             group: "home_services", query: "roofing contractor",     mockNoun: "Roofing" },
  { id: "landscaper",         label: "Landscaper",         group: "home_services", query: "landscaping service",    mockNoun: "Landscaping" },
  { id: "general_contractor", label: "General contractor", group: "home_services", query: "general contractor",     mockNoun: "Contracting" },
  { id: "cleaning",           label: "Cleaning service",   group: "home_services", query: "house cleaning service", mockNoun: "Cleaning Services" },
  { id: "painter",            label: "Painter",            group: "home_services", query: "painting contractor",    mockNoun: "Painting" },
  { id: "pest_control",       label: "Pest control",       group: "home_services", query: "pest control service",   mockNoun: "Pest Control" },
  { id: "handyman",           label: "Handyman",           group: "home_services", query: "handyman service",       mockNoun: "Handyman Services" },
  // --- Wellness & personal care ---------------------------------------
  { id: "day_spa",            label: "Day spa",            group: "wellness",      query: "day spa",                mockNoun: "Day Spa" },
  { id: "hair_salon",         label: "Hair salon",         group: "wellness",      query: "hair salon",             mockNoun: "Hair Studio" },
  // Removed "barber" — operator opted out (low-fit segment for us).
  { id: "nail_salon",         label: "Nail salon",         group: "wellness",      query: "nail salon",             mockNoun: "Nail Bar" },
  { id: "massage",            label: "Massage therapy",    group: "wellness",      query: "massage therapy",        mockNoun: "Massage Therapy" },
  { id: "esthetics",          label: "Esthetics studio",   group: "wellness",      query: "esthetician",            mockNoun: "Esthetics" },
  { id: "tattoo",             label: "Tattoo studio",      group: "wellness",      query: "tattoo studio",          mockNoun: "Tattoo Co" },
  { id: "fitness",            label: "Fitness studio",     group: "wellness",      query: "fitness studio",         mockNoun: "Fitness" },
  { id: "yoga",               label: "Yoga studio",        group: "wellness",      query: "yoga studio",            mockNoun: "Yoga" },
  // --- Auto & local retail --------------------------------------------
  { id: "auto_repair",        label: "Auto repair shop",   group: "auto_retail",   query: "auto repair shop",       mockNoun: "Auto Repair" },
  { id: "auto_body",          label: "Auto body shop",     group: "auto_retail",   query: "auto body shop",         mockNoun: "Auto Body" },
  { id: "car_dealer",         label: "Car dealership",     group: "auto_retail",   query: "car dealership",         mockNoun: "Motors" },
  { id: "detailing",          label: "Car detailing",      group: "auto_retail",   query: "car detailing service",  mockNoun: "Auto Detailing" },
  { id: "tire_shop",          label: "Tire shop",          group: "auto_retail",   query: "tire shop",              mockNoun: "Tire & Wheel" },
  { id: "pet_grooming",       label: "Pet grooming",       group: "auto_retail",   query: "pet grooming",           mockNoun: "Pet Grooming" },
  { id: "pet_daycare",        label: "Dog daycare",        group: "auto_retail",   query: "dog daycare",            mockNoun: "Dog Daycare" },
  { id: "photography",        label: "Photography studio", group: "auto_retail",   query: "photography studio",     mockNoun: "Photography" },
];

// Halifax Regional Municipality — the communities we prospect across.
export const HRM_AREAS = [
  "Halifax, NS",
  "Dartmouth, NS",
  "Bedford, NS",
  "Lower Sackville, NS",
  "Spryfield, NS",
  "Clayton Park, NS",
  "Cole Harbour, NS",
];

export const DEFAULT_AREAS = ["Halifax, NS", "Dartmouth, NS", "Bedford, NS"];

export const HRM_TIMEZONE = "America/Halifax";

export function categoryById(id: string): ProspectCategory | undefined {
  return CATEGORIES.find(c => c.id === id);
}

export function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id;
}

export function groupLabel(group: string): string {
  return CATEGORY_GROUPS.find(g => g.id === group)?.label ?? group;
}

export function groupHook(group: string): string {
  return CATEGORY_GROUPS.find(g => g.id === group)?.hook ?? "";
}

export function categoriesInGroup(group: CategoryGroup): ProspectCategory[] {
  return CATEGORIES.filter(c => c.group === group);
}
