import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNowStrict } from "date-fns";
import { OutreachCampaignControls } from "./OutreachCampaignControls";
import { CampaignSettings } from "./CampaignSettings";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  draft: "chip-muted",
  scheduled: "chip-warm",
  running: "chip-warm",
  paused: "chip-muted",
  completed: "chip-cool",
  canceled: "chip-hot",
};

const TARGET_CHIP: Record<string, string> = {
  pending: "chip-muted",
  calling: "chip-warm",
  completed: "chip-cool",
  failed: "chip-hot",
  skipped: "chip-muted",
  opted_out: "chip-hot",
};

export default async function OutreachCampaignDetail({ params }: { params: { id: string } }) {
  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id: params.id },
    include: {
      targets: {
        include: { prospect: true },
        orderBy: [{ status: "asc" }, { id: "asc" }],
        take: 300,
      },
      calls: { select: { disposition: true } },
    },
  });
  if (!campaign) return <div>Campaign not found.</div>;

  const t = campaign.targets;
  const stats = {
    total: t.length,
    pending: t.filter(x => x.status === "pending").length,
    calling: t.filter(x => x.status === "calling").length,
    completed: t.filter(x => x.status === "completed").length,
    failed: t.filter(x => x.status === "failed").length,
    skipped: t.filter(x => x.status === "skipped" || x.status === "opted_out").length,
    demos: campaign.calls.filter(c => c.disposition === "demo_booked").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/outreach/campaigns" className="text-xs text-ink-muted hover:underline">← All campaigns</Link>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-sub">{campaign.goal}</p>
          <p className="text-xs text-ink-muted mt-2">
            Rep “{campaign.repName}” · Quiet hours {campaign.quietStartHour}:00–{campaign.quietEndHour}:00 (prospect-local) ·
            Up to {campaign.ratePerMinute} calls/min · {campaign.maxAttempts} attempts max
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={STATUS_CHIP[campaign.status] ?? "chip-muted"}>{campaign.status}</span>
          <OutreachCampaignControls campaignId={campaign.id} status={campaign.status} />
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="section-title">Pitch</h2>
        <p className="text-sm whitespace-pre-wrap">{campaign.pitch}</p>
        {campaign.offer && <p className="text-sm text-ink-muted">Offer: {campaign.offer}</p>}
      </div>

      <CampaignSettings
        campaignId={campaign.id}
        quietStartHour={campaign.quietStartHour}
        quietEndHour={campaign.quietEndHour}
        ratePerMinute={campaign.ratePerMinute}
        maxAttempts={campaign.maxAttempts}
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Targets" value={stats.total} />
        <Kpi label="Pending" value={stats.pending} accent="warm" />
        <Kpi label="Calling" value={stats.calling} />
        <Kpi label="Completed" value={stats.completed} accent="cool" />
        <Kpi label="Demos booked" value={stats.demos} accent="cool" />
        <Kpi label="Failed / skipped" value={stats.failed + stats.skipped} accent="hot" />
      </div>

      <div className="card overflow-hidden">
        {campaign.targets.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No targets in this campaign</div>
            <div className="empty-sub">No qualified prospects matched the filter. Source and qualify more, or lower the minimum fit score.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="text-right">Attempts</th>
                <th>Last attempt</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {campaign.targets.map(target => (
                <tr key={target.id}>
                  <td className="font-medium">
                    <Link href={`/outreach/prospects/${target.prospectId}`} className="text-lane hover:underline">
                      {target.prospect.businessName}
                    </Link>
                  </td>
                  <td className="text-xs">{target.prospect.phone ?? "—"}</td>
                  <td><span className={TARGET_CHIP[target.status] ?? "chip-muted"}>{target.status}</span></td>
                  <td className="text-right tabular-nums">{target.attempts}</td>
                  <td className="text-xs text-ink-muted">
                    {target.lastAttemptAt ? formatDistanceToNowStrict(target.lastAttemptAt, { addSuffix: true }) : "—"}
                  </td>
                  <td className="text-xs text-ink-muted max-w-md truncate">{target.outcomeNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: "cool" | "warm" | "hot" }) {
  return (
    <div className={"kpi " + (accent ? `kpi-${accent}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
