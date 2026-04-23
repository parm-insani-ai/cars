import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SendComposer } from "@/components/SendComposer";

export const dynamic = "force-dynamic";

export default async function OpportunityDetail({ params }: { params: { oppId: string } }) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: params.oppId },
    include: {
      customer: { include: { vehiclesOwned: { take: 1, orderBy: { purchaseDate: "desc" } } } },
      rooftop: true,
    },
  });
  if (!opp) return <div>Not found.</div>;

  const matched = opp.matchedVehicleId
    ? await prisma.vehicle.findUnique({ where: { id: opp.matchedVehicleId } })
    : null;
  const rec = await prisma.recommendation.findFirst({
    where: { rooftopId: opp.rooftopId, userId: { not: "" } /* placeholder filter */ },
    orderBy: { createdAt: "desc" },
  });

  const owned = opp.customer.vehiclesOwned[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4">
          <h1 className="text-lg font-semibold">
            {opp.customer.firstName ?? ""} {opp.customer.lastName ?? ""}
          </h1>
          <div className="text-sm text-ink-muted">{opp.rationale}</div>
          <div className="mt-2 text-xs text-ink-muted">
            Score: {Math.round(opp.score * 100)}% · est ${opp.expectedGross.toLocaleString()} gross
          </div>
        </div>

        {owned && (
          <div className="card p-4">
            <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Currently drives</div>
            <div className="text-sm">
              {owned.year} {owned.make} {owned.model}
              {owned.mileage ? ` · ${owned.mileage.toLocaleString()} mi` : ""}
              {owned.estimatedPayoff ? ` · payoff $${owned.estimatedPayoff.toLocaleString()}` : ""}
              {owned.estimatedValue ? ` · value $${owned.estimatedValue.toLocaleString()}` : ""}
            </div>
          </div>
        )}

        {matched && (
          <div className="card p-4">
            <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Matched in-stock upgrade</div>
            <div className="font-medium">
              {matched.year} {matched.make} {matched.model} {matched.trim ?? ""}
            </div>
            <div className="text-sm text-ink-muted">
              stock #{matched.stockNumber} · ${matched.price.toLocaleString()}
              {matched.mileage ? ` · ${matched.mileage.toLocaleString()} mi` : ""}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {rec && rec.talkTrack && (
          <div className="card p-4">
            <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">In-person talk track</div>
            <p className="text-sm whitespace-pre-wrap">{rec.talkTrack}</p>
          </div>
        )}
        {rec && rec.draftBody && (
          <SendComposer
            recommendationId={rec.id}
            userId={rec.userId}
            initialBody={rec.draftBody}
            channel={rec.draftChannel}
          />
        )}
        <Link href="/service" className="btn-secondary w-full">← Back to opportunities</Link>
      </div>
    </div>
  );
}
