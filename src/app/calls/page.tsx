import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

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

  const [calls, today, byOutcome] = await Promise.all([
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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calls</h1>
          <p className="text-xs text-ink-muted">
            {today} today · {totalAll} total · {booked} booked · {transferred} transferred
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          ["all", "All"],
          ["in_progress", "Live"],
          ["booked", "Booked"],
          ["rescheduled", "Rescheduled"],
          ["canceled", "Canceled"],
          ["message_taken", "Message"],
          ["transferred", "Transferred"],
          ["voicemail", "Voicemail"],
          ["hung_up", "Hung up"],
          ["no_action", "No action"],
        ].map(([v, l]) => (
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
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">From</th>
              <th className="text-left p-3">Caller</th>
              <th className="text-left p-3">Outcome</th>
              <th className="text-right p-3">Duration</th>
              <th className="text-left p-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No calls.</td></tr>
            ) : (
              calls.map(c => (
                <tr key={c.id} className="border-t border-surface-border hover:bg-surface-sub/60">
                  <td className="p-3 text-xs text-ink-muted">
                    <Link href={`/calls/${c.id}`} className="text-lane hover:underline">
                      {formatDistanceToNowStrict(c.startedAt, { addSuffix: true })}
                    </Link>
                  </td>
                  <td className="p-3">{c.fromNumber}</td>
                  <td className="p-3">
                    {c.customer
                      ? `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || "—"
                      : <span className="text-ink-muted">unknown</span>}
                  </td>
                  <td className="p-3"><span className={chipFor(c.outcome)}>{c.outcome.replace("_", " ")}</span></td>
                  <td className="p-3 text-right tabular-nums">{c.durationSec ? `${c.durationSec}s` : "—"}</td>
                  <td className="p-3 text-ink-muted text-xs line-clamp-1 max-w-md">{c.summary ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function chipFor(o: string) {
  if (o === "booked") return "chip-cool";
  if (o === "rescheduled" || o === "message_taken") return "chip-cool";
  if (o === "transferred" || o === "voicemail") return "chip-warm";
  if (o === "canceled" || o === "hung_up" || o === "no_action") return "chip-hot";
  if (o === "in_progress") return "chip-warm";
  return "chip-muted";
}
