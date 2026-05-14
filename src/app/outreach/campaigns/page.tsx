import Link from "next/link";
import { prisma } from "@/lib/prisma";
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

export default async function OutreachCampaignsPage() {
  const campaigns = await prisma.outreachCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      targets: { select: { status: true } },
      calls: { select: { disposition: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Outreach campaigns</h1>
          <p className="page-sub">Each campaign has an AI sales rep call a list of qualified prospects to book demos.</p>
        </div>
        <Link href="/outreach/campaigns/new" className="btn-primary">New campaign</Link>
      </div>

      <div className="card overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No campaigns yet</div>
            <div className="empty-sub">A campaign points the AI sales rep at a slice of your qualified prospects with a pitch and a goal.</div>
            <Link href="/outreach/campaigns/new" className="btn-primary">Create your first campaign</Link>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Goal</th>
                <th>Status</th>
                <th className="text-right">Targets</th>
                <th className="text-right">Demos</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const demos = c.calls.filter(call => call.disposition === "demo_booked").length;
                return (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/outreach/campaigns/${c.id}`} className="text-lane hover:underline">{c.name}</Link>
                    </td>
                    <td className="text-xs text-ink-muted max-w-md truncate">{c.goal}</td>
                    <td><span className={STATUS_CHIP[c.status] ?? "chip-muted"}>{c.status}</span></td>
                    <td className="text-right tabular-nums">{c.targets.length}</td>
                    <td className="text-right tabular-nums">{demos}</td>
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
