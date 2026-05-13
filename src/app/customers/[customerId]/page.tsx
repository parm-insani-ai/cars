import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { ConsentToggle } from "./ConsentToggle";
import { apptStatusLabel, apptStatusChip, callOutcomeLabel, callOutcomeChip, chipClass } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { customerId: string } }) {
  const user = await requireUser();
  const c = await prisma.customer.findFirst({
    where: { id: params.customerId, businessId: user.businessId },
    include: {
      appointments: { include: { service: true, provider: true }, orderBy: { scheduledAt: "desc" }, take: 10 },
      callSessions: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!c) return <div>Not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-xs text-ink-muted hover:underline">← All customers</Link>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{c.firstName ?? ""} {c.lastName ?? ""}</h1>
          <p className="page-sub">{c.phone ?? "—"} · {c.email ?? "—"}</p>
        </div>
      </div>

      <ConsentToggle customerId={c.id} smsConsent={c.smsConsent} emailConsent={c.emailConsent} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Appointments</h2>
          {c.appointments.length === 0 ? (
            <p className="text-sm text-ink-muted">No appointments on file.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {c.appointments.map(a => (
                <li key={a.id} className="py-2.5 flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{a.service.name}</div>
                    <div className="text-xs text-ink-muted">
                      {format(a.scheduledAt, "PPp")}{a.provider && ` · ${a.provider.name}`}
                    </div>
                  </div>
                  <span className={chipClass(apptStatusChip[a.status])}>{apptStatusLabel[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Calls</h2>
          {c.callSessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No calls on file.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {c.callSessions.map(s => (
                <li key={s.id} className="py-2.5 flex justify-between gap-3">
                  <div>
                    <Link href={`/calls/${s.id}`} className="text-sm font-medium text-lane hover:underline">
                      {s.direction === "inbound" ? "Incoming" : "Outbound"}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {formatDistanceToNowStrict(s.startedAt, { addSuffix: true })}{s.durationSec ? ` · ${s.durationSec}s` : ""}
                    </div>
                  </div>
                  <span className={chipClass(callOutcomeChip[s.outcome])}>{callOutcomeLabel[s.outcome]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
