import { prisma } from "@/lib/prisma";
import { FeedCardRow } from "@/components/FeedCard";
import { getManagerFeed } from "@/domain/feed";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const rooftop = await prisma.rooftop.findFirst();
  if (!rooftop) return <div>No rooftop.</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [feed, newLeadsToday, apptsSetToday, apptsShownToday, soldToday, missedCallsToday, slaBreaches] = await Promise.all([
    getManagerFeed(rooftop.id, 30),
    prisma.lead.count({ where: { rooftopId: rooftop.id, createdAt: { gte: today } } }),
    prisma.appointment.count({ where: { rooftopId: rooftop.id, createdAt: { gte: today }, status: { in: ["set", "confirmed", "shown", "sold"] } } }),
    prisma.appointment.count({ where: { rooftopId: rooftop.id, createdAt: { gte: today }, status: { in: ["shown", "sold"] } } }),
    prisma.appointment.count({ where: { rooftopId: rooftop.id, createdAt: { gte: today }, status: "sold" } }),
    prisma.callEvent.count({ where: { rooftopId: rooftop.id, startedAt: { gte: today }, outcome: "missed", direction: "inbound" } }),
    prisma.task.count({ where: { rooftopId: rooftop.id, status: { in: ["open", "escalated"] }, slaAt: { lt: new Date() } } }),
  ]);

  const leakage = (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Kpi label="New leads today" value={newLeadsToday} />
      <Kpi label="Missed calls today" value={missedCallsToday} />
      <Kpi label="SLA breaches" value={slaBreaches} accent={slaBreaches > 0 ? "hot" : undefined} />
      <Kpi label="Appts set today" value={apptsSetToday} />
      <Kpi label="Appts shown" value={apptsShownToday} />
      <Kpi label="Sold today" value={soldToday} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{rooftop.name}</h1>
        <div className="text-xs text-ink-muted">Leakage monitor — live</div>
      </div>

      {leakage}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Open &amp; escalated</h2>
        {feed.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted text-sm">No open opportunities.</div>
        ) : (
          feed.map((c) => <FeedCardRow key={c.taskId} card={c} />)
        )}
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
