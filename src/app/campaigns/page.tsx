import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  draft: "chip-muted",
  scheduled: "chip-warm",
  running: "chip-warm",
  paused: "chip-muted",
  completed: "chip-cool",
  canceled: "chip-hot",
};

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { businessId: user.businessId },
    include: { _count: { select: { targets: true } }, targets: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Outbound campaigns</h1>
          <p className="page-sub">
            Have the agent call your lapsed customers and offer them a slot. Best ROI feature in the app.
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">Create campaign</Link>
      </div>

      <div className="card overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h3l3-8 4 16 3-8h5" />
              </svg>
            </div>
            <div className="empty-title">No campaigns yet</div>
            <div className="empty-sub">A campaign calls a list of customers with a specific goal — usually rebooking them after a long gap.</div>
            <Link href="/campaigns/new" className="btn-primary">Create your first campaign</Link>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Goal</th>
                <th>Status</th>
                <th className="text-right">Targets</th>
                <th className="text-right">Completed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const done = c.targets.filter(t => t.status === "completed").length;
                return (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/campaigns/${c.id}`} className="text-lane hover:underline">{c.name}</Link>
                    </td>
                    <td className="text-xs text-ink-muted max-w-md truncate">{c.goal}</td>
                    <td><span className={STATUS_CHIP[c.status] ?? "chip-muted"}>{c.status}</span></td>
                    <td className="text-right tabular-nums">{c._count.targets}</td>
                    <td className="text-right tabular-nums">{done}</td>
                    <td className="text-xs text-ink-muted">{formatDistanceToNowStrict(c.createdAt, { addSuffix: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
