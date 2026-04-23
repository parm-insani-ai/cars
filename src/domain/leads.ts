import { prisma } from "@/lib/prisma";
import { scoreLeadHotness, expectedGrossForLead } from "./scoring";
import type { LeadSource, LeadStatus } from "@prisma/client";

type IntakePayload = {
  rooftopId: string;
  source: LeadSource;
  customer: { firstName?: string; lastName?: string; phone?: string; email?: string };
  vehicleOfInterest?: { stockNumber?: string; year?: number; make?: string; model?: string };
  rawPayload?: unknown;
};

export async function ingestLead(p: IntakePayload) {
  // Dedupe customer by (rooftop, phone) then (rooftop, email).
  const existing = p.customer.phone
    ? await prisma.customer.findFirst({
        where: { rooftopId: p.rooftopId, phone: p.customer.phone },
      })
    : p.customer.email
      ? await prisma.customer.findFirst({
          where: { rooftopId: p.rooftopId, email: p.customer.email },
        })
      : null;

  const customer =
    existing ??
    (await prisma.customer.create({
      data: {
        rooftopId: p.rooftopId,
        firstName: p.customer.firstName,
        lastName: p.customer.lastName,
        phone: p.customer.phone,
        email: p.customer.email,
        // TCPA consent comes from the source — leave false unless we have proof.
        smsConsent: p.source === "walk_in" || p.source === "phone_in",
        emailConsent: Boolean(p.customer.email),
      },
    }));

  // Match or create vehicle of interest.
  let vehicleId: string | null = null;
  if (p.vehicleOfInterest?.stockNumber) {
    const v = await prisma.vehicle.findFirst({
      where: { rooftopId: p.rooftopId, stockNumber: p.vehicleOfInterest.stockNumber },
    });
    vehicleId = v?.id ?? null;
  } else if (p.vehicleOfInterest?.make) {
    const v = await prisma.vehicle.findFirst({
      where: {
        rooftopId: p.rooftopId,
        status: "in_stock",
        make: { equals: p.vehicleOfInterest.make, mode: "insensitive" },
        model: p.vehicleOfInterest.model
          ? { contains: p.vehicleOfInterest.model, mode: "insensitive" }
          : undefined,
      },
    });
    vehicleId = v?.id ?? null;
  }

  // Assign rep: MVP round-robin by lowest open-task load.
  const rep = await assignRep(p.rooftopId);

  const priceOfInterest = vehicleId
    ? (await prisma.vehicle.findUnique({ where: { id: vehicleId } }))?.price ?? null
    : null;

  const lead = await prisma.lead.create({
    data: {
      rooftopId: p.rooftopId,
      customerId: customer.id,
      interestVehicleId: vehicleId,
      source: p.source,
      status: "new" as LeadStatus,
      assignedRepId: rep?.id ?? null,
      rawPayload: p.rawPayload as any,
    },
  });

  const recentContact = customer.lastContactAt
    ? Date.now() - customer.lastContactAt.getTime() < 30 * 24 * 60 * 60 * 1000
    : false;
  const hotness = scoreLeadHotness(lead, Boolean(vehicleId), recentContact);
  const gross = expectedGrossForLead(priceOfInterest, p.source);

  await prisma.lead.update({
    where: { id: lead.id },
    data: { score: hotness, expectedGross: gross, closeProbability: hotness * 0.6 },
  });

  // Create the first-response task with a 5-minute SLA.
  const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
  if (rep) {
    await prisma.task.create({
      data: {
        rooftopId: p.rooftopId,
        userId: rep.id,
        kind: "first_response",
        leadId: lead.id,
        title: `New ${p.source.replace("_", " ")} lead${customer.firstName ? ` — ${customer.firstName}` : ""}`,
        body: vehicleId ? `Interested in a specific vehicle. Draft is ready to review.` : `Open lead — ask what they're shopping for.`,
        slaAt: fiveMin,
        priority: hotness,
      },
    });
  }

  return { leadId: lead.id, customerId: customer.id, assignedRepId: rep?.id ?? null, score: hotness };
}

async function assignRep(rooftopId: string) {
  // Simplest useful assignment: rep with fewest open tasks.
  const reps = await prisma.user.findMany({
    where: { rooftopId, role: "rep", active: true },
    include: { _count: { select: { tasks: { where: { status: "open" } } } } },
  });
  if (reps.length === 0) return null;
  reps.sort((a, b) => a._count.tasks - b._count.tasks);
  return reps[0];
}
