import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { startOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams?: { days?: string } }) {
  const user = await requireUser();
  const days = Math.max(1, Math.min(90, Number(searchParams?.days ?? 7)));
  const since = startOfDay(subDays(new Date(), days - 1));

  const [
    leadsCreated,
    apptsSet,
    apptsShown,
    sold,
    influenced,
    missedCalls,
    missedRecovered,
    leadsResponded5min,
    leadsTotal,
    serviceOpps,
    serviceOppsWorked,
    bySource,
    byRep,
  ] = await Promise.all([
    prisma.lead.count({ where: { rooftopId: user.rooftopId, createdAt: { gte: since } } }),
    prisma.appointment.count({
      where: { rooftopId: user.rooftopId, createdAt: { gte: since }, status: { in: ["set", "confirmed", "shown", "sold"] } },
    }),
    prisma.appointment.count({
      where: { rooftopId: user.rooftopId, createdAt: { gte: since }, status: { in: ["shown", "sold"] } },
    }),
    prisma.appointment.count({
      where: { rooftopId: user.rooftopId, createdAt: { gte: since }, status: "sold" },
    }),
    prisma.appointment.count({
      where: {
        rooftopId: user.rooftopId,
        createdAt: { gte: since },
        status: "sold",
        source: "ai",
      },
    }),
    prisma.callEvent.count({
      where: { rooftopId: user.rooftopId, startedAt: { gte: since }, outcome: "missed", direction: "inbound" },
    }),
    prisma.task.count({
      where: {
        rooftopId: user.rooftopId,
        kind: "missed_call_recovery",
        createdAt: { gte: since },
        status: "done",
      },
    }),
    prisma.lead.count({
      where: {
        rooftopId: user.rooftopId,
        createdAt: { gte: since },
        firstResponseAt: { not: null },
      },
    }),
    prisma.lead.count({ where: { rooftopId: user.rooftopId, createdAt: { gte: since } } }),
    prisma.opportunity.count({ where: { rooftopId: user.rooftopId, createdAt: { gte: since } } }),
    prisma.opportunity.count({ where: { rooftopId: user.rooftopId, createdAt: { gte: since }, worked: true } }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { rooftopId: user.rooftopId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.appointment.groupBy({
      by: ["repId"],
      where: { rooftopId: user.rooftopId, createdAt: { gte: since }, status: { in: ["set", "shown", "sold"] } },
      _count: true,
    }),
  ]);

  // First-response SLA: did the lead get a response within 5 minutes?
  const fast = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint as count FROM "Lead"
     WHERE "rooftopId" = $1
       AND "createdAt" >= $2
       AND "firstResponseAt" IS NOT NULL
       AND EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) <= 300`,
    user.rooftopId,
    since,
  ).catch(() => [{ count: BigInt(0) }]);
  const fastCount = Number(fast[0]?.count ?? 0);

  const reps = await prisma.user.findMany({
    where: { rooftopId: user.rooftopId, role: "rep" },
  });
  const repName = (id: string | null) => reps.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <div className="text-xs text-ink-muted">Last {days} days</div>
        </div>
        <div className="flex gap-2">
          {[1, 7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/reports?days=${d}`}
              className={d === days ? "btn-primary" : "btn-secondary"}
            >
              {d}d
            </a>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">Conversion funnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Funnel label="Leads" value={leadsCreated} />
          <Funnel label="Appts set" value={apptsSet} ratio={leadsCreated ? apptsSet / leadsCreated : 0} />
          <Funnel label="Shown" value={apptsShown} ratio={apptsSet ? apptsShown / apptsSet : 0} />
          <Funnel label="Sold" value={sold} ratio={apptsShown ? sold / apptsShown : 0} />
          <Funnel label="Revline-influenced" value={influenced} accent />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">Operational SLA</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Pct label="Lead first-response" target={0.95}
               num={fastCount} denom={leadsTotal} sub={`${fastCount}/${leadsTotal} under 5 min`} />
          <Pct label="Missed-call recovery" target={0.9}
               num={missedRecovered} denom={missedCalls} sub={`${missedRecovered}/${missedCalls} closed`} />
          <Pct label="Service opps worked" target={0.7}
               num={serviceOppsWorked} denom={serviceOpps} sub={`${serviceOppsWorked}/${serviceOpps} touched`} />
          <Pct label="Lead response coverage" target={0.95}
               num={leadsResponded5min} denom={leadsTotal} sub="any response time" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">Lead source mix</h2>
        <div className="card p-4 space-y-2">
          {bySource.length === 0 ? (
            <p className="text-sm text-ink-muted">No leads in window.</p>
          ) : (
            bySource
              .sort((a, b) => b._count - a._count)
              .map((s) => {
                const pct = leadsCreated ? s._count / leadsCreated : 0;
                return (
                  <div key={s.source} className="flex items-center gap-3 text-sm">
                    <div className="w-32">{s.source.replace("_", " ")}</div>
                    <div className="flex-1 h-2 bg-surface-sub rounded-full overflow-hidden">
                      <div className="h-full bg-lane" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <div className="w-16 text-right tabular-nums text-ink-muted">{s._count}</div>
                  </div>
                );
              })
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">Rep scoreboard</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Rep</th>
                <th className="text-right p-3">Appts set</th>
              </tr>
            </thead>
            <tbody>
              {byRep.length === 0 ? (
                <tr><td colSpan={2} className="p-4 text-center text-ink-muted">No data.</td></tr>
              ) : (
                byRep
                  .sort((a, b) => b._count - a._count)
                  .map((r, i) => (
                    <tr key={r.repId ?? i} className="border-t border-surface-border">
                      <td className="p-3">{repName(r.repId)}</td>
                      <td className="p-3 text-right tabular-nums">{r._count}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Funnel({ label, value, ratio, accent }: { label: string; value: number; ratio?: number; accent?: boolean }) {
  return (
    <div className={"card p-3 " + (accent ? "border-lane" : "")}>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={"text-xl font-semibold " + (accent ? "text-lane" : "")}>{value}</div>
      {ratio !== undefined && (
        <div className="text-xs text-ink-muted">{Math.round(ratio * 100)}% of prev</div>
      )}
    </div>
  );
}

function Pct({
  label,
  num,
  denom,
  target,
  sub,
}: {
  label: string;
  num: number;
  denom: number;
  target: number;
  sub: string;
}) {
  const pct = denom > 0 ? num / denom : 0;
  const onTarget = pct >= target;
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={"text-xl font-semibold " + (onTarget ? "" : "text-lane-hot")}>
        {Math.round(pct * 100)}%
      </div>
      <div className="text-xs text-ink-muted">target {Math.round(target * 100)}% · {sub}</div>
    </div>
  );
}
