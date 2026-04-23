import { prisma } from "@/lib/prisma";
import { scoreEquityReadiness, inventoryMatchWhere } from "./scoring";

// Called when a new service RO is opened (webhook). Creates a ranked
// opportunity if the customer is likely ready to upgrade AND there's a
// matching in-stock vehicle. Opportunities expire in 4 hours (service visit).
export async function processServiceDrive(roId: string) {
  const ro = await prisma.serviceRO.findUniqueOrThrow({
    where: { id: roId },
    include: {
      customer: {
        include: {
          vehiclesOwned: { orderBy: { purchaseDate: "desc" }, take: 1 },
          serviceROs: { orderBy: { openedAt: "desc" }, take: 6 },
        },
      },
    },
  });

  const owned = ro.customer.vehiclesOwned[0];
  if (!owned) return null;

  const signal = scoreEquityReadiness({
    owned,
    recentServiceROs: ro.customer.serviceROs,
  });

  if (signal.score < 0.35) return null;

  // Match a real in-stock vehicle in the same segment / price band.
  const targetPrice = owned.estimatedValue ?? 30000;
  const matches = await prisma.vehicle.findMany({
    where: {
      rooftopId: ro.rooftopId,
      ...inventoryMatchWhere({
        targetPrice,
        targetPriceRange: 0.2,
        newOnly: false,
      }),
    },
    orderBy: { price: "asc" },
    take: 3,
  });
  if (matches.length === 0) return null;

  const expectedGross = Math.max(2000, Math.round(matches[0].price * 0.07));
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

  const opportunity = await prisma.opportunity.create({
    data: {
      rooftopId: ro.rooftopId,
      customerId: ro.customerId,
      kind: "equity_upgrade",
      score: signal.score,
      expectedGross,
      matchedVehicleId: matches[0].id,
      rationale: signal.rationale,
      expiresAt,
    },
  });

  // Assign a rep for the card.
  const rep = await prisma.user.findFirst({
    where: { rooftopId: ro.rooftopId, role: "rep", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (rep) {
    await prisma.task.create({
      data: {
        rooftopId: ro.rooftopId,
        userId: rep.id,
        kind: "service_opp",
        opportunityId: opportunity.id,
        title: `Service-drive upgrade — ${ro.customer.firstName ?? "customer"} is on-site`,
        body: `${signal.rationale}. Match: ${matches[0].year} ${matches[0].make} ${matches[0].model} @ $${matches[0].price.toLocaleString()}.`,
        slaAt: expiresAt,
        priority: Math.min(0.95, signal.score + 0.2), // boost: short-lived opportunity
      },
    });
  }

  return opportunity;
}
