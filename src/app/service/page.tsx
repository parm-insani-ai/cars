import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ServiceOppsPage() {
  const rooftop = await prisma.rooftop.findFirst();
  if (!rooftop) return <div>No rooftop.</div>;

  const opps = await prisma.opportunity.findMany({
    where: { rooftopId: rooftop.id, worked: false, kind: { in: ["equity_upgrade", "service_drive"] } },
    include: { customer: true },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const matched = await prisma.vehicle.findMany({
    where: { id: { in: opps.map((o) => o.matchedVehicleId ?? "").filter(Boolean) } },
  });
  const matchedById = new Map(matched.map((v) => [v.id, v]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Service-drive opportunities</h1>
      <p className="text-sm text-ink-muted">
        Ranked by upgrade readiness. Each card expires when the car leaves the service drive.
      </p>

      {opps.length === 0 ? (
        <div className="card p-6 text-center text-ink-muted">No open opportunities.</div>
      ) : (
        <div className="space-y-3">
          {opps.map((o) => {
            const vehicle = o.matchedVehicleId ? matchedById.get(o.matchedVehicleId) : null;
            const expiresMin = o.expiresAt ? Math.round((o.expiresAt.getTime() - Date.now()) / 60_000) : null;
            return (
              <div key={o.id} className="card p-4 flex items-start gap-4">
                <div className="flex-none">
                  <div className="chip-warm">{Math.round(o.score * 100)}% ready</div>
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {o.customer.firstName ?? ""} {o.customer.lastName ?? ""}
                  </div>
                  <div className="text-sm text-ink-muted">{o.rationale}</div>
                  {vehicle && (
                    <div className="text-sm mt-1">
                      Match: <span className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                      {" · "}${vehicle.price.toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-ink-muted mt-1">
                    est ${o.expectedGross.toLocaleString()} gross
                    {expiresMin !== null && <> · expires in {expiresMin}m</>}
                    {" · opened "}{formatDistanceToNowStrict(o.createdAt, { addSuffix: true })}
                  </div>
                </div>
                <div>
                  <Link href={`/service/${o.id}`} className="btn-primary">Open</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
