import { describe, it, expect } from "vitest";
import { scoreLeadHotness, expectedGrossForLead, scoreEquityReadiness } from "./scoring";
import type { Lead } from "@prisma/client";

function fakeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    rooftopId: "r1",
    customerId: "c1",
    source: "website",
    status: "new",
    assignedRepId: null,
    interestVehicleId: null,
    rawPayload: null,
    firstResponseAt: null,
    score: 0,
    closeProbability: 0,
    expectedGross: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

describe("scoreLeadHotness", () => {
  it("scores a fresh phone-in lead with vehicle of interest highly", () => {
    const s = scoreLeadHotness(fakeLead({ source: "phone_in", createdAt: new Date() }), true, false);
    expect(s).toBeGreaterThan(0.7);
    expect(s).toBeLessThanOrEqual(1);
  });

  it("scores a 2-day-old facebook lead with no interest low", () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const s = scoreLeadHotness(fakeLead({ source: "facebook", createdAt: old }), false, false);
    expect(s).toBeLessThan(0.4);
  });

  it("never exceeds 1.0", () => {
    const s = scoreLeadHotness(fakeLead({ source: "walk_in", createdAt: new Date() }), true, true);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe("expectedGrossForLead", () => {
  it("floors at $1500", () => {
    expect(expectedGrossForLead(0, "website")).toBeGreaterThanOrEqual(1500);
  });
  it("walk-in earns higher margin %", () => {
    const walkIn = expectedGrossForLead(30000, "walk_in");
    const website = expectedGrossForLead(30000, "website");
    expect(walkIn).toBeGreaterThan(website);
  });
});

describe("scoreEquityReadiness", () => {
  it("scores a 4yr-old, 70k-mile, $13k-equity, recent-spend customer near 1.0", () => {
    const purchase = new Date(new Date().getFullYear() - 4, 1, 1);
    const result = scoreEquityReadiness({
      owned: {
        year: new Date().getFullYear() - 4,
        mileage: 70000,
        estimatedPayoff: 9000,
        estimatedValue: 22000,
        purchaseDate: purchase,
      },
      recentServiceROs: [
        { openedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), repairTotal: 2000, mileage: 70000 },
      ],
    });
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.equityUsd).toBe(13000);
  });

  it("returns null equity when payoff or value missing", () => {
    const r = scoreEquityReadiness({
      owned: {
        year: new Date().getFullYear() - 4,
        mileage: 70000,
        estimatedPayoff: null,
        estimatedValue: 22000,
        purchaseDate: null,
      },
      recentServiceROs: [],
    });
    expect(r.equityUsd).toBeNull();
  });
});
