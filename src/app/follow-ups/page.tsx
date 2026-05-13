import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { followUpKindLabel, followUpStatusChip, chipClass, humanize } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const user = await requireUser();
  const status = searchParams?.status ?? "scheduled";
  const where: any = { businessId: user.businessId };
  if (status !== "all") where.status = status;

  const items = await prisma.followUp.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Follow-ups</h1>
        <p className="page-sub">
          Outbound reminders and follow-up messages the agent has scheduled. They go out automatically on time.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {["scheduled", "sent", "failed", "skipped", "all"].map(s => (
          <a key={s} href={`/follow-ups?status=${s}`} className={status === s ? "btn-primary" : "btn-secondary"}>
            {humanize(s)}
          </a>
        ))}
      </div>

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nothing here</div>
            <div className="empty-sub">When the agent books appointments or takes messages, you'll see reminders queue up here.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Channel</th>
                <th>Scheduled</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(f => (
                <tr key={f.id}>
                  <td>{followUpKindLabel[f.kind] ?? humanize(f.kind)}</td>
                  <td className="text-xs capitalize">{f.channel}</td>
                  <td className="text-xs text-ink-muted">{formatDistanceToNowStrict(f.scheduledFor, { addSuffix: true })}</td>
                  <td>
                    <span className={chipClass(followUpStatusChip[f.status])}>{humanize(f.status)}</span>
                    {f.errorMessage && <div className="text-xs text-lane-hot mt-0.5">{f.errorMessage}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
