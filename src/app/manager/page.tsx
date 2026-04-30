import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ReassignButton } from "@/components/ReassignButton";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const user = await requireUser();
  const rooftopId = user.rooftopId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    feed,
    newLeadsToday,
    apptsSetToday,
    apptsShownToday,
    soldToday,
    missedCallsToday,
    slaBreaches,
    reps,
    alerts,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { rooftopId, status: { in: ["open", "escalated"] } },
      include: { lead: { include: { customer: true } }, user: true },
      orderBy: [{ slaAt: "asc" }, { priority: "desc" }],
      take: 50,
    }),
    prisma.lead.count({ where: { rooftopId, createdAt: { gte: today } } }),
    prisma.appointment.count({
      where: { rooftopId, createdAt: { gte: today }, status: { in: ["set", "confirmed", "shown", "sold"] } },
    }),
    prisma.appointment.count({
      where: { rooftopId, createdAt: { gte: today }, status: { in: ["shown", "sold"] } },
    }),
    prisma.appointment.count({ where: { rooftopId, createdAt: { gte: today }, status: "sold" } }),
    prisma.callEvent.count({
      where: { rooftopId, startedAt: { gte: today }, outcome: "missed", direction: "inbound" },
    }),
    prisma.task.count({
      where: { rooftopId, status: { in: ["open", "escalated"] }, slaAt: { lt: new Date() } },
    }),
    prisma.user.findMany({
      where: { rooftopId, role: "rep", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.alert.findMany({
      where: { rooftopId, acknowledged: false },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const repList = reps.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{user.rooftop.name}</h1>
        <div className="text-xs text-ink-muted">Live leakage monitor</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="New leads today" value={newLeadsToday} />
        <Kpi label="Missed calls today" value={missedCallsToday} />
        <Kpi label="SLA breaches" value={slaBreaches} accent={slaBreaches > 0 ? "hot" : undefined} />
        <Kpi label="Appts set today" value={apptsSetToday} />
        <Kpi label="Appts shown" value={apptsShownToday} />
        <Kpi label="Sold today" value={soldToday} />
      </div>

      {alerts.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-ink-muted">Open alerts</div>
          {alerts.map((a) => (
            <div key={a.id} className="text-sm flex items-start gap-2">
              <span className={a.severity === "critical" ? "chip-hot" : a.severity === "warn" ? "chip-warm" : "chip-muted"}>
                {a.severity}
              </span>
              <div className="flex-1">
                <div className="font-medium">{a.title}</div>
                {a.body && <div className="text-xs text-ink-muted whitespace-pre-line">{a.body}</div>}
              </div>
              <div className="text-xs text-ink-muted flex-none">
                {formatDistanceToNowStrict(a.createdAt, { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">
          Open &amp; escalated tasks
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Rep</th>
                <th className="text-left p-3">SLA</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {feed.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-ink-muted">No open opportunities.</td></tr>
              ) : (
                feed.map((t) => {
                  const breached = t.slaAt && t.slaAt.getTime() < Date.now();
                  return (
                    <tr key={t.id} className="border-t border-surface-border">
                      <td className="p-3">
                        <span className="chip-muted">{t.kind.replace("_", " ")}</span>
                      </td>
                      <td className="p-3">
                        {t.leadId ? (
                          <Link href={`/rep/lead/${t.leadId}`} className="text-lane hover:underline">
                            {t.title}
                          </Link>
                        ) : (
                          t.title
                        )}
                        {t.body && <div className="text-xs text-ink-muted line-clamp-1">{t.body}</div>}
                      </td>
                      <td className="p-3">{t.user?.name ?? "—"}</td>
                      <td className="p-3">
                        {t.slaAt ? (
                          breached ? (
                            <span className="chip-hot">{formatDistanceToNowStrict(t.slaAt)} ago</span>
                          ) : (
                            <span className="text-ink-muted text-xs">in {formatDistanceToNowStrict(t.slaAt)}</span>
                          )
                        ) : (
                          <span className="text-ink-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <ReassignButton taskId={t.id} reps={repList} currentUserId={t.userId} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: "hot" }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={"text-xl font-semibold " + (accent === "hot" ? "text-lane-hot" : "")}>{value}</div>
    </div>
  );
}
