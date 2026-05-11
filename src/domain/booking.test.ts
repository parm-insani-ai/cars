import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the slot finder against a mocked prisma module to keep the test
// hermetic. The shape of mock returns is intentional and matches what
// findAvailableSlots reads.

const mockBusinessFindUnique = vi.fn();
const mockServiceFindUnique = vi.fn();
const mockProviderFindMany = vi.fn();
const mockApptFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: { findUnique: (...a: any[]) => mockBusinessFindUnique(...a) },
    service: { findUnique: (...a: any[]) => mockServiceFindUnique(...a) },
    provider: { findMany: (...a: any[]) => mockProviderFindMany(...a) },
    appointment: { findMany: (...a: any[]) => mockApptFindMany(...a) },
  },
}));

// Import after mock so the module reads the mocked prisma.
import { findAvailableSlots } from "./booking";

const businessId = "biz_1";
const serviceId = "svc_1";

// Helper: Mon–Fri 9-17, single provider, no appts.
function setupHappyPath() {
  mockBusinessFindUnique.mockResolvedValue({
    id: businessId,
    hours: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, openMin: 9 * 60, closeMin: 17 * 60 })),
  });
  mockServiceFindUnique.mockResolvedValue({
    id: serviceId, active: true, durationMin: 30, providerKind: "tech",
  });
  mockProviderFindMany.mockResolvedValue([
    {
      id: "p_1",
      name: "Provider A",
      kind: "tech",
      shifts: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startMin: 9 * 60, endMin: 17 * 60 })),
    },
  ]);
  mockApptFindMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findAvailableSlots", () => {
  it("returns slots inside business hours when nothing is booked", async () => {
    setupHappyPath();
    // Pick a Tuesday for determinism.
    const earliest = new Date("2025-03-04T08:00:00-08:00"); // Tue 8am Pacific
    const slots = await findAvailableSlots({
      businessId, serviceId,
      earliest, latest: new Date(earliest.getTime() + 24 * 60 * 60 * 1000),
      limit: 5,
    });
    expect(slots.length).toBe(5);
    expect(slots[0].providerName).toBe("Provider A");
  });

  it("returns empty when service is inactive", async () => {
    setupHappyPath();
    mockServiceFindUnique.mockResolvedValue({
      id: serviceId, active: false, durationMin: 30, providerKind: "tech",
    });
    const earliest = new Date("2025-03-04T08:00:00-08:00");
    const slots = await findAvailableSlots({
      businessId, serviceId,
      earliest, latest: new Date(earliest.getTime() + 24 * 60 * 60 * 1000),
    });
    expect(slots).toEqual([]);
  });

  it("returns empty when no business hours match the search window", async () => {
    setupHappyPath();
    mockBusinessFindUnique.mockResolvedValue({ id: businessId, hours: [] });
    const earliest = new Date("2025-03-04T08:00:00-08:00");
    const slots = await findAvailableSlots({
      businessId, serviceId,
      earliest, latest: new Date(earliest.getTime() + 24 * 60 * 60 * 1000),
    });
    expect(slots).toEqual([]);
  });

  it("excludes slots that overlap an existing appointment", async () => {
    setupHappyPath();
    // Appointment from 10:00–11:00 on the same Tuesday.
    mockApptFindMany.mockResolvedValue([
      {
        scheduledAt: new Date("2025-03-04T10:00:00-08:00"),
        durationMin: 60,
        providerId: "p_1",
      },
    ]);
    const earliest = new Date("2025-03-04T08:00:00-08:00");
    const slots = await findAvailableSlots({
      businessId, serviceId,
      earliest, latest: new Date(earliest.getTime() + 24 * 60 * 60 * 1000),
      limit: 10,
    });
    // None of the returned slots may overlap 10:00-11:00.
    for (const s of slots) {
      const end = new Date(s.scheduledAt.getTime() + 30 * 60_000);
      const blockStart = new Date("2025-03-04T10:00:00-08:00");
      const blockEnd = new Date("2025-03-04T11:00:00-08:00");
      const overlap = s.scheduledAt < blockEnd && blockStart < end;
      expect(overlap).toBe(false);
    }
  });

  it("uses 'any available' when no providers are configured", async () => {
    setupHappyPath();
    mockProviderFindMany.mockResolvedValue([]);
    const earliest = new Date("2025-03-04T08:00:00-08:00");
    const slots = await findAvailableSlots({
      businessId, serviceId,
      earliest, latest: new Date(earliest.getTime() + 24 * 60 * 60 * 1000),
      limit: 3,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].providerId).toBe(null);
    expect(slots[0].providerName).toBe("any available");
  });
});
