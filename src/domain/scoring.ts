import type { Lead, Customer, OwnedVehicle, ServiceRO } from "@prisma/client";

// --- Lead hotness (v1, rules-based) --------------------------------------
// Inputs we have at ingest: source, has-vehicle-of-interest, recency, prior history.
// Output: [0,1]. Tied directly to: probability-to-set-appointment × expected gross.
export function scoreLeadHotness(lead: Lead, hasInterest: boolean, customerRecentContact: boolean): number {
  let s = 0;

  // Source: inbound high-intent sources beat dumb ones.
  const sourceWeights: Record<string, number> = {
    phone_in: 0.45,
    walk_in: 0.5,
    cargurus: 0.3,
    autotrader: 0.3,
    website: 0.35,
    cars_com: 0.3,
    referral: 0.4,
    service: 0.25,
    facebook: 0.2,
    other: 0.2,
  };
  s += sourceWeights[lead.source] ?? 0.2;

  // Vehicle of interest in hand = actionable.
  if (hasInterest) s += 0.2;

  // Recency: fresh leads convert ~10x better than >1hr old.
  const ageMin = (Date.now() - lead.createdAt.getTime()) / 60_000;
  if (ageMin < 5) s += 0.2;
  else if (ageMin < 60) s += 0.1;
  else if (ageMin < 24 * 60) s += 0.05;

  // Prior relationship.
  if (customerRecentContact) s += 0.1;

  return clamp(s, 0, 1);
}

export function expectedGrossForLead(priceOfInterest: number | null, source: Lead["source"]): number {
  // Very rough heuristic until we train a real model on pilot data:
  // gross ≈ 6% of price for new, 10% for used, floor $1500.
  const base = priceOfInterest ?? 28000;
  const marginPct = source === "walk_in" ? 0.09 : 0.07;
  return Math.max(1500, Math.round(base * marginPct));
}

// --- Equity / upgrade readiness (service-to-sales) ----------------------
export type EquityInput = {
  owned: Pick<OwnedVehicle, "year" | "mileage" | "estimatedPayoff" | "estimatedValue" | "purchaseDate">;
  recentServiceROs: Pick<ServiceRO, "openedAt" | "repairTotal" | "mileage">[];
};

export type EquitySignal = {
  score: number;           // 0..1, upgrade-readiness
  equityUsd: number | null;
  rationale: string;
};

export function scoreEquityReadiness(input: EquityInput): EquitySignal {
  const { owned, recentServiceROs } = input;
  const year = owned.year;
  const vehicleAgeYears = new Date().getFullYear() - year;

  let score = 0;
  const notes: string[] = [];

  // Ownership age: 3-5 years is peak upgrade zone.
  if (vehicleAgeYears >= 3 && vehicleAgeYears <= 5) {
    score += 0.3;
    notes.push(`${vehicleAgeYears}-yr ownership (prime upgrade window)`);
  } else if (vehicleAgeYears > 5) {
    score += 0.15;
    notes.push(`${vehicleAgeYears}-yr ownership`);
  }

  // Mileage above 60k on late-model car = upgrade trigger.
  if (owned.mileage && owned.mileage > 60_000) {
    score += 0.15;
    notes.push(`${Math.round(owned.mileage / 1000)}k miles`);
  }

  // Positive equity if value > payoff.
  let equityUsd: number | null = null;
  if (owned.estimatedValue != null && owned.estimatedPayoff != null) {
    equityUsd = Math.round(owned.estimatedValue - owned.estimatedPayoff);
    if (equityUsd > 3000) {
      score += 0.3;
      notes.push(`$${equityUsd.toLocaleString()} positive equity`);
    } else if (equityUsd > 0) {
      score += 0.1;
      notes.push(`$${equityUsd.toLocaleString()} positive equity`);
    }
  }

  // Recent service spend = pain point we can solve by upgrading.
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentSpend = recentServiceROs
    .filter((ro) => ro.openedAt.getTime() > ninetyDaysAgo)
    .reduce((sum, ro) => sum + (ro.repairTotal ?? 0), 0);
  if (recentSpend > 1500) {
    score += 0.15;
    notes.push(`$${recentSpend.toLocaleString()} service spend in last 90 days`);
  }

  return {
    score: clamp(score, 0, 1),
    equityUsd,
    rationale: notes.length ? notes.join(" · ") : "baseline service customer",
  };
}

// --- Matching customer to inventory --------------------------------------
// Rules engine: segment + fuel + monthly payment band. Don't train anything.
export type InventoryMatchCriteria = {
  preferredBodyType?: string;
  preferredFuel?: string;
  targetPrice?: number;      // anchor price to match against
  targetPriceRange?: number; // +/- tolerance (default 15%)
  newOnly?: boolean;
};

export function inventoryMatchWhere(criteria: InventoryMatchCriteria) {
  const tolerance = criteria.targetPriceRange ?? 0.15;
  const target = criteria.targetPrice ?? 30000;
  const low = target * (1 - tolerance);
  const high = target * (1 + tolerance);
  return {
    status: "in_stock",
    ...(criteria.preferredBodyType ? { bodyType: criteria.preferredBodyType } : {}),
    ...(criteria.preferredFuel ? { fuel: criteria.preferredFuel } : {}),
    ...(criteria.newOnly ? { isNew: true } : {}),
    price: { gte: low, lte: high },
  } as const;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
