import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const user = await requireUser();
  const status = searchParams?.status ?? "scheduled";
  const where: any = { businessId: user.businessId };
  if (status !== "all") where.status = status;

  const follow = await prisma.followUp.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    include: { },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Follow-ups</h1>
        <div className="flex gap-2">
          {["scheduled", "sent", "failed", "skipped", "all"].map(s => (
            <a key={s} href={`/follow-ups?status=${s}`} className={status === s ? "btn-primary" : "btn-secondary"}>
              {s}
            </a>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Kind</th>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">Scheduled</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {follow.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-ink-muted">None.</td></tr>
            ) : follow.map(f => (
              <tr key={f.id} className="border-t border-surface-border">
                <td className="p-3">{f.kind.replace(/_/g, " ")}</td>
                <td className="p-3 text-xs">{f.channel}</td>
                <td className="p-3 text-xs text-ink-muted">{formatDistanceToNowStrict(f.scheduledFor, { addSuffix: true })}</td>
                <td className="p-3">
                  <span className={
                    f.status === "sent" ? "chip-cool" :
                    f.status === "failed" ? "chip-hot" :
                    f.status === "scheduled" ? "chip-warm" : "chip-muted"
                  }>{f.status}</span>
                  {f.errorMessage && <div className="text-xs text-lane-hot mt-0.5">{f.errorMessage}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
