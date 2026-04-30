import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { ConsentToggle } from "./ConsentToggle";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { customerId: string } }) {
  const user = await requireUser();
  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, rooftopId: user.rooftopId },
    include: {
      vehiclesOwned: { orderBy: { purchaseDate: "desc" } },
      leads: { orderBy: { createdAt: "desc" }, include: { interestVehicle: true } },
      opportunities: { orderBy: { createdAt: "desc" } },
      serviceROs: { orderBy: { openedAt: "desc" }, take: 5 },
      calls: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!customer) return <div>Not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {customer.firstName ?? ""} {customer.lastName ?? ""}
          </h1>
          <div className="text-sm text-ink-muted">
            {customer.phone ?? "—"} · {customer.email ?? "—"}
          </div>
        </div>
        <Link href="/customers" className="btn-secondary">← All customers</Link>
      </div>

      <ConsentToggle
        customerId={customer.id}
        smsConsent={customer.smsConsent}
        emailConsent={customer.emailConsent}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-medium mb-3">Vehicles owned</h2>
          {customer.vehiclesOwned.length === 0 ? (
            <p className="text-sm text-ink-muted">None on file.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.vehiclesOwned.map((v) => (
                <li key={v.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                  <div className="font-medium">{v.year} {v.make} {v.model}</div>
                  <div className="text-xs text-ink-muted">
                    {v.mileage ? `${v.mileage.toLocaleString()} mi` : "—"}
                    {v.estimatedPayoff ? ` · payoff $${v.estimatedPayoff.toLocaleString()}` : ""}
                    {v.estimatedValue ? ` · value $${v.estimatedValue.toLocaleString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-3">Leads</h2>
          {customer.leads.length === 0 ? (
            <p className="text-sm text-ink-muted">No leads.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.leads.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center justify-between border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                  <div>
                    <Link href={`/rep/lead/${l.id}`} className="text-lane hover:underline">
                      {l.source.replace("_", " ")}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {l.interestVehicle ? `${l.interestVehicle.year} ${l.interestVehicle.make} ${l.interestVehicle.model}` : "no vehicle"}
                    </div>
                  </div>
                  <span className="chip-muted">{l.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-3">Service history</h2>
          {customer.serviceROs.length === 0 ? (
            <p className="text-sm text-ink-muted">No service ROs.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.serviceROs.map((ro) => (
                <li key={ro.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                  <div className="font-medium">RO {ro.roNumber}</div>
                  <div className="text-xs text-ink-muted">
                    {ro.vehicleYear} {ro.vehicleMake} {ro.vehicleModel}
                    {ro.repairTotal ? ` · $${ro.repairTotal.toLocaleString()}` : ""}
                    {" · " + formatDistanceToNowStrict(ro.openedAt, { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-3">Recent calls</h2>
          {customer.calls.length === 0 ? (
            <p className="text-sm text-ink-muted">No calls.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.calls.map((c) => (
                <li key={c.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                  <div className="text-xs">
                    {c.direction} · {c.outcome}
                    {c.durationSec ? ` · ${c.durationSec}s` : ""}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatDistanceToNowStrict(c.startedAt, { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
