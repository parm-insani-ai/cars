import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, formatDistanceToNowStrict, isFuture, isPast } from "date-fns";
import Link from "next/link";
import { ConsentToggle } from "./ConsentToggle";
import { apptStatusLabel, apptStatusChip, callOutcomeLabel, callOutcomeChip, chipClass } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { customerId: string } }) {
  const user = await requireUser();
  const c = await prisma.customer.findFirst({
    where: { id: params.customerId, businessId: user.businessId },
    include: {
      appointments: { include: { service: true, provider: true }, orderBy: { scheduledAt: "desc" } },
      callSessions: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!c) return <div>Not found.</div>;

  // Summary tiles — what an owner actually cares about at a glance.
  const completedAppts = c.appointments.filter(a => a.status === "completed");
  const lifetimeValue = completedAppts.reduce((s, a) => s + (a.service.priceUsd ?? 0), 0);
  const visitCount = completedAppts.length;
  const lastVisit = completedAppts[0]?.scheduledAt ?? null;
  const nextAppt = c.appointments
    .filter(a => isFuture(a.scheduledAt) && ["pending", "confirmed", "reminded"].includes(a.status))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const fullName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "(no name on file)";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-xs text-ink-muted hover:underline">← All customers</Link>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{fullName}</h1>
          <p className="page-sub">{c.phone ?? "—"} · {c.email ?? "—"}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi">
          <div className="kpi-label">Lifetime value</div>
          <div className="kpi-value">{fmtUsd(lifetimeValue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Visits</div>
          <div className="kpi-value">{visitCount}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Last visit</div>
          <div className="kpi-value text-base">
            {lastVisit ? formatDistanceToNowStrict(lastVisit, { addSuffix: true }) : "—"}
          </div>
        </div>
        <div className={"kpi " + (nextAppt ? "kpi-cool" : "")}>
          <div className="kpi-label">Next appointment</div>
          <div className="kpi-value text-base">
            {nextAppt ? format(nextAppt.scheduledAt, "EEE, MMM d · h:mm a") : "—"}
          </div>
        </div>
      </div>

      <ConsentToggle customerId={c.id} smsConsent={c.smsConsent} emailConsent={c.emailConsent} />

      {c.notes && (
        <div className="card p-5">
          <h2 className="section-title mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Appointments ({c.appointments.length})</h2>
          {c.appointments.length === 0 ? (
            <p className="text-sm text-ink-muted">No appointments on file.</p>
          ) : (
            <ul className="divide-y divide-surface-border max-h-[420px] overflow-y-auto">
              {c.appointments.map(a => (
                <li key={a.id} className="py-2.5 flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{a.service.name}</div>
                    <div className="text-xs text-ink-muted">
                      {format(a.scheduledAt, "PPp")}
                      {a.provider && ` · ${a.provider.name}`}
                      {a.service.priceUsd && ` · $${a.service.priceUsd.toFixed(0)}`}
                    </div>
                  </div>
                  <span className={chipClass(apptStatusChip[a.status])}>{apptStatusLabel[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Calls ({c.callSessions.length})</h2>
          {c.callSessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No calls on file.</p>
          ) : (
            <ul className="divide-y divide-surface-border max-h-[420px] overflow-y-auto">
              {c.callSessions.map(s => (
                <li key={s.id} className="py-2.5 space-y-1">
                  <div className="flex justify-between gap-3">
                    <Link href={`/calls/${s.id}`} className="text-sm font-medium text-lane hover:underline">
                      {s.direction === "inbound" ? "Incoming" : "Outbound"}
                    </Link>
                    <span className={chipClass(callOutcomeChip[s.outcome])}>{callOutcomeLabel[s.outcome]}</span>
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatDistanceToNowStrict(s.startedAt, { addSuffix: true })}
                    {s.durationSec ? ` · ${s.durationSec}s` : ""}
                  </div>
                  {s.summary && <div className="text-xs text-ink-muted line-clamp-2">{s.summary}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtUsd(amount: number): string {
  if (!amount) return "$0";
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(amount).toLocaleString()}`;
}
