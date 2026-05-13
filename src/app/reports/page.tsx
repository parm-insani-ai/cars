import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { startOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams?: { days?: string } }) {
  const user = await requireUser();
  const days = Math.max(1, Math.min(90, Number(searchParams?.days ?? 7)));
  const since = startOfDay(subDays(new Date(), days - 1));

  const [
    callsTotal, callsByOutcome, apptsTotal, completed, noShow,
    avgDuration, costs, followUps,
  ] = await Promise.all([
    prisma.callSession.count({ where: { businessId: user.businessId, startedAt: { gte: since } } }),
    prisma.callSession.groupBy({
      by: ["outcome"],
      where: { businessId: user.businessId, startedAt: { gte: since } },
      _count: true,
    }),
    prisma.appointment.count({ where: { businessId: user.businessId, createdAt: { gte: since } } }),
    prisma.appointment.count({ where: { businessId: user.businessId, createdAt: { gte: since }, status: "completed" } }),
    prisma.appointment.count({ where: { businessId: user.businessId, createdAt: { gte: since }, status: "no_show" } }),
    prisma.callSession.aggregate({
      where: { businessId: user.businessId, startedAt: { gte: since }, durationSec: { not: null } },
      _avg: { durationSec: true },
    }),
    prisma.callSession.aggregate({
      where: { businessId: user.businessId, startedAt: { gte: since }, cost: { not: null } },
      _sum: { cost: true },
    }),
    prisma.followUp.groupBy({
      by: ["status"],
      where: { businessId: user.businessId, createdAt: { gte: since } },
      _count: true,
    }),
  ]);

  const booked = callsByOutcome.find(r => r.outcome === "booked")?._count ?? 0;
  const transferred = callsByOutcome.find(r => r.outcome === "transferred")?._count ?? 0;
  const messageTaken = callsByOutcome.find(r => r.outcome === "message_taken")?._count ?? 0;
  const voicemail = callsByOutcome.find(r => r.outcome === "voicemail")?._count ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">How your agent is performing.</p>
        </div>
        <div className="flex gap-2">
          {[1, 7, 30, 90].map(d => (
            <a key={d} href={`/reports?days=${d}`} className={d === days ? "btn-primary" : "btn-secondary"}>
              Last {d === 1 ? "day" : `${d} days`}
            </a>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="section-title">Calls</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Total calls" value={callsTotal} />
          <Kpi label="Booked" value={booked} sub={pct(booked, callsTotal)} accent="cool" />
          <Kpi label="Transferred to staff" value={transferred} sub={pct(transferred, callsTotal)} />
          <Kpi label="Message taken" value={messageTaken} sub={pct(messageTaken, callsTotal)} />
          <Kpi label="Voicemail" value={voicemail} sub={pct(voicemail, callsTotal)} />
          <Kpi label="Avg duration" value={avgDuration._avg.durationSec ? `${Math.round(avgDuration._avg.durationSec)}s` : "—"} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Appointments</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Booked" value={apptsTotal} />
          <Kpi label="Completed" value={completed} sub={pct(completed, apptsTotal)} accent="cool" />
          <Kpi label="No-shows" value={noShow} sub={pct(noShow, apptsTotal)} accent={noShow > 0 ? "hot" : undefined} />
          <Kpi label="Show rate" value={apptsTotal ? `${Math.round((completed / apptsTotal) * 100)}%` : "—"} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Outbound messages</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Sent" value={followUps.find(f => f.status === "sent")?._count ?? 0} />
          <Kpi label="Scheduled" value={followUps.find(f => f.status === "scheduled")?._count ?? 0} />
          <Kpi label="Failed" value={followUps.find(f => f.status === "failed")?._count ?? 0} accent="hot" />
          <Kpi label="Skipped" value={followUps.find(f => f.status === "skipped")?._count ?? 0} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Cost</h2>
        <Kpi label="Platform spend (voice provider)" value={costs._sum.cost != null ? `$${costs._sum.cost.toFixed(2)}` : "—"} />
      </section>
    </div>
  );
}

function pct(n: number, d: number) { if (!d) return ""; return `${Math.round((n / d) * 100)}% of calls`; }
function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: "cool" | "warm" | "hot" }) {
  return (
    <div className={"kpi " + (accent ? `kpi-${accent}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
