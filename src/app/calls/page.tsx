import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { callOutcomeLabel, callOutcomeChip, chipClass } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CallsPage({
  searchParams,
}: {
  searchParams?: { outcome?: string };
}) {
  const user = await requireUser();
  const outcome = searchParams?.outcome ?? "all";

  const where: any = { businessId: user.businessId };
  if (outcome !== "all") where.outcome = outcome;

  const [calls, todayCount, byOutcome] = await Promise.all([
    prisma.callSession.findMany({
      where,
      include: { customer: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    (() => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return prisma.callSession.count({ where: { businessId: user.businessId, startedAt: { gte: start } } });
    })(),
    prisma.callSession.groupBy({
      by: ["outcome"],
      where: { businessId: user.businessId },
      _count: true,
    }),
  ]);

  const totalAll = byOutcome.reduce((s, r) => s + r._count, 0);
  const booked = byOutcome.find(r => r.outcome === "booked")?._count ?? 0;
  const transferred = byOutcome.find(r => r.outcome === "transferred")?._count ?? 0;

  const filters: Array<[string, string]> = [
    ["all", "All calls"],
    ["in_progress", "Live"],
    ["booked", "Booked"],
    ["rescheduled", "Rescheduled"],
    ["canceled", "Canceled"],
    ["message_taken", "Message taken"],
    ["transferred", "Transferred"],
    ["voicemail", "Voicemail"],
    ["hung_up", "Caller hung up"],
    ["no_action", "No outcome"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Calls</h1>
          <p className="page-sub">
            Every call your agent has answered. Click one to see the transcript, what tools it used, and the AI summary.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div><span className="text-ink-muted">Today: </span><span className="font-semibold">{todayCount}</span></div>
          <div><span className="text-ink-muted">All time: </span><span className="font-semibold">{totalAll}</span></div>
          <div><span className="text-ink-muted">Booked: </span><span className="font-semibold text-lane-cool">{booked}</span></div>
          <div><span className="text-ink-muted">Transferred: </span><span className="font-semibold">{transferred}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {filters.map(([v, l]) => (
          <Link
            key={v}
            href={v === "all" ? "/calls" : `/calls?outcome=${v}`}
            className={outcome === v ? "btn-primary" : "btn-secondary"}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        {calls.length === 0 ? (
          <EmptyCalls noFilter={outcome === "all"} />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Caller</th>
                <th>From number</th>
                <th>Outcome</th>
                <th className="text-right">Duration</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id}>
                  <td className="text-xs text-ink-muted whitespace-nowrap">
                    <Link href={`/calls/${c.id}`} className="text-lane hover:underline">
                      {formatDistanceToNowStrict(c.startedAt, { addSuffix: true })}
                    </Link>
                  </td>
                  <td>
                    {c.customer
                      ? `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || "—"
                      : <span className="text-ink-muted">Unknown</span>}
                  </td>
                  <td className="text-xs text-ink-muted whitespace-nowrap">{c.fromNumber}</td>
                  <td><span className={chipClass(callOutcomeChip[c.outcome])}>{callOutcomeLabel[c.outcome]}</span></td>
                  <td className="text-right tabular-nums">{c.durationSec ? `${c.durationSec}s` : "—"}</td>
                  <td className="text-ink-muted text-xs max-w-md">{c.summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyCalls({ noFilter }: { noFilter: boolean }) {
  if (!noFilter) {
    return (
      <div className="empty">
        <div className="empty-title">No calls match this filter</div>
        <div className="empty-sub">Try clearing the filter or selecting a different outcome.</div>
        <Link href="/calls" className="btn-secondary">Show all calls</Link>
      </div>
    );
  }
  return (
    <div className="empty">
      <div className="empty-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.97.37 1.92.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.5 12.5 0 0 0 2.81.72A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>
      <div className="empty-title">No calls yet</div>
      <div className="empty-sub">
        Once your phone number is connected, every call will show up here with a transcript and a one-line summary.
        Until then, you can try the agent in the simulator.
      </div>
      <Link href="/demo" className="btn-primary">Try the agent</Link>
    </div>
  );
}
