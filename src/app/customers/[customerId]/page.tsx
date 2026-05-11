import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { ConsentToggle } from "./ConsentToggle";

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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{c.firstName ?? ""} {c.lastName ?? ""}</h1>
          <p className="text-sm text-ink-muted">{c.phone ?? "—"} · {c.email ?? "—"}</p>
        </div>
        <Link href="/customers" className="btn-secondary">← All customers</Link>
      </div>

      <ConsentToggle customerId={c.id} smsConsent={c.smsConsent} emailConsent={c.emailConsent} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-medium mb-2">Recent appointments</h2>
          {c.appointments.length === 0 ? (
            <p className="text-sm text-ink-muted">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {c.appointments.map(a => (
                <li key={a.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0 flex justify-between">
                  <div>
                    <div className="font-medium">{a.service.name}</div>
                    <div className="text-xs text-ink-muted">{format(a.scheduledAt, "PPp")}{a.provider && ` · ${a.provider.name}`}</div>
                  </div>
                  <span className="chip-muted">{a.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-2">Recent calls</h2>
          {c.callSessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No calls on file.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {c.callSessions.map(s => (
                <li key={s.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0 flex justify-between">
                  <div>
                    <Link href={`/calls/${s.id}`} className="text-lane hover:underline">
                      {s.direction} · {s.outcome.replace("_", " ")}
                    </Link>
                    <div className="text-xs text-ink-muted">{formatDistanceToNowStrict(s.startedAt, { addSuffix: true })}{s.durationSec ? ` · ${s.durationSec}s` : ""}</div>
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
