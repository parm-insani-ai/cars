import { prisma } from "@/lib/prisma";
import { addMinutes, isBefore, isAfter, startOfDay, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

// Slot finder. For each provider that can deliver this service, walks the
// next N days; for each day, takes the intersection of (business hours,
// provider shift) and removes existing appointments. Returns up to `limit`
// slots, sorted by earliest.
//
// This is intentionally rules-based and conservative. Real implementations
// will fold in: external calendars (Google/Cal.com), buffer time between
// appointments, blackout dates, provider time off. The interface is the
// same — only the inputs grow.

export type SlotQuery = {
  businessId: string;
  serviceId: string;
  providerId?: string;
  earliest: Date;
  latest: Date;
  limit?: number;
};

export type Slot = {
  scheduledAt: Date;
  providerId: string | null;
  providerName: string;
};

export async function findAvailableSlots(q: SlotQuery): Promise<Slot[]> {
  const service = await prisma.service.findUnique({ where: { id: q.serviceId } });
  if (!service || !service.active) return [];
  const business = await prisma.business.findUnique({
    where: { id: q.businessId },
    include: { hours: true },
  });
  if (!business) return [];
  const hoursByDow = new Map(business.hours.map(h => [h.dayOfWeek, h]));

  // Candidate providers.
  const providers = q.providerId
    ? await prisma.provider.findMany({
        where: { id: q.providerId, businessId: q.businessId, active: true },
        include: { shifts: true },
      })
    : await prisma.provider.findMany({
        where: {
          businessId: q.businessId,
          active: true,
          ...(service.providerKind ? { kind: service.providerKind } : {}),
        },
        include: { shifts: true },
      });

  // If no specific providers configured, fall back to "any" — generate slots
  // straight from business hours and check global appointment conflicts.
  const limit = q.limit ?? 5;
  const stepMinutes = 30;
  const out: Slot[] = [];

  const appts = await prisma.appointment.findMany({
    where: {
      businessId: q.businessId,
      status: { in: ["pending", "confirmed", "reminded", "arrived"] },
      scheduledAt: { gte: q.earliest, lte: addDays(q.latest, 1) },
    },
    select: { scheduledAt: true, durationMin: true, providerId: true },
  });

  for (let day = startOfDay(q.earliest); isBefore(day, q.latest); day = addDays(day, 1)) {
    const hours = hoursByDow.get(day.getDay());
    if (!hours) continue;

    const dayOpen = setMs(setHours(setMinutes(day, hours.openMin % 60), Math.floor(hours.openMin / 60)));
    const dayClose = setMs(setHours(setMinutes(day, hours.closeMin % 60), Math.floor(hours.closeMin / 60)));

    if (providers.length === 0) {
      // Anyone (or no providers configured): slot per business hour.
      for (let t = newer(dayOpen, q.earliest); isBefore(addMinutes(t, service.durationMin), dayClose); t = addMinutes(t, stepMinutes)) {
        if (isBefore(t, q.earliest)) continue;
        const conflict = appts.some(a => overlaps(t, service.durationMin, a.scheduledAt, a.durationMin));
        if (!conflict) {
          out.push({ scheduledAt: t, providerId: null, providerName: "any available" });
          if (out.length >= limit) return out.slice(0, limit);
        }
      }
      continue;
    }

    for (const provider of providers) {
      const shift = provider.shifts.find(s => s.dayOfWeek === day.getDay());
      if (!shift) continue;
      const shiftStart = setMs(setHours(setMinutes(day, shift.startMin % 60), Math.floor(shift.startMin / 60)));
      const shiftEnd = setMs(setHours(setMinutes(day, shift.endMin % 60), Math.floor(shift.endMin / 60)));
      const windowStart = newer(dayOpen, shiftStart);
      const windowEnd = older(dayClose, shiftEnd);

      for (let t = newer(windowStart, q.earliest); isBefore(addMinutes(t, service.durationMin), windowEnd); t = addMinutes(t, stepMinutes)) {
        if (isBefore(t, q.earliest)) continue;
        const conflict = appts.some(a =>
          (a.providerId === provider.id || a.providerId === null) &&
          overlaps(t, service.durationMin, a.scheduledAt, a.durationMin)
        );
        if (!conflict) {
          out.push({ scheduledAt: t, providerId: provider.id, providerName: provider.name });
        }
      }
    }
  }

  // Sort + cap. When multiple providers offer the same earliest time, prefer
  // alphabetically by provider name for determinism in tests.
  out.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.providerName.localeCompare(b.providerName));
  // De-dupe near-identical slots from different providers (keep first).
  const seen = new Set<number>();
  const deduped: Slot[] = [];
  for (const s of out) {
    const key = s.scheduledAt.getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function setMs(d: Date): Date {
  return setMilliseconds(setSeconds(d, 0), 0);
}
function newer(a: Date, b: Date): Date {
  return isAfter(a, b) ? a : b;
}
function older(a: Date, b: Date): Date {
  return isBefore(a, b) ? a : b;
}
function overlaps(aStart: Date, aMin: number, bStart: Date, bMin: number): boolean {
  const aEnd = addMinutes(aStart, aMin);
  const bEnd = addMinutes(bStart, bMin);
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd);
}

// --- Appointment creation -----------------------------------------------

export async function lookupOrCreateCustomer(args: {
  businessId: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  if (args.phone) {
    const existing = await prisma.customer.findFirst({
      where: { businessId: args.businessId, phone: args.phone },
    });
    if (existing) {
      // Backfill name if we now know it.
      if ((!existing.firstName && args.firstName) || (!existing.lastName && args.lastName)) {
        return prisma.customer.update({
          where: { id: existing.id },
          data: {
            firstName: existing.firstName ?? args.firstName,
            lastName: existing.lastName ?? args.lastName,
            email: existing.email ?? args.email,
          },
        });
      }
      return existing;
    }
  }
  if (args.email) {
    const existing = await prisma.customer.findFirst({
      where: { businessId: args.businessId, email: args.email },
    });
    if (existing) return existing;
  }
  return prisma.customer.create({
    data: {
      businessId: args.businessId,
      phone: args.phone,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      smsConsent: Boolean(args.phone), // inbound caller implies opt-in for transactional SMS
    },
  });
}

export type CreateApptResult =
  | { ok: true; appointment: Awaited<ReturnType<typeof prisma.appointment.create>>; serviceName: string; providerName: string }
  | { ok: false; error: string };

export async function createAppointment(args: {
  businessId: string;
  customerId: string;
  serviceId: string;
  providerId: string | null;
  scheduledAt: Date;
  notes?: string;
  callSessionId?: string;
}): Promise<CreateApptResult> {
  const service = await prisma.service.findUnique({ where: { id: args.serviceId } });
  if (!service || !service.active) return { ok: false, error: "service_not_found" };

  // Conflict check — re-run availability for this slot to avoid double-book.
  const slots = await findAvailableSlots({
    businessId: args.businessId,
    serviceId: args.serviceId,
    providerId: args.providerId ?? undefined,
    earliest: args.scheduledAt,
    latest: addMinutes(args.scheduledAt, service.durationMin + 1),
    limit: 1,
  });
  const exact = slots.find(s => s.scheduledAt.getTime() === args.scheduledAt.getTime());
  if (!exact) return { ok: false, error: "slot_not_available" };

  const providerId = args.providerId ?? exact.providerId;
  const provider = providerId
    ? await prisma.provider.findUnique({ where: { id: providerId } })
    : null;

  const appt = await prisma.appointment.create({
    data: {
      businessId: args.businessId,
      customerId: args.customerId,
      providerId,
      serviceId: args.serviceId,
      scheduledAt: args.scheduledAt,
      durationMin: service.durationMin,
      status: "confirmed",
      source: args.callSessionId ? "agent" : "manual",
      notes: args.notes,
      callSessionId: args.callSessionId,
    },
  });
  return {
    ok: true,
    appointment: appt,
    serviceName: service.name,
    providerName: provider?.name ?? "any available",
  };
}
