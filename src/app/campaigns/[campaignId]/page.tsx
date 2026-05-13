import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { CampaignControls } from "./CampaignControls";
import { format, formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  draft: "chip-muted",
  scheduled: "chip-warm",
  running: "chip-warm",
  paused: "chip-muted",
  completed: "chip-cool",
  canceled: "chip-hot",
};

export default async function CampaignDetail({ params }: { params: { campaignId: string } }) {
  const user = await requireUser();
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.campaignId, businessId: user.businessId },
    include: {
      targets: {
        include: { customer: true },
        orderBy: [{ status: "asc" }, { id: "asc" }],
        take: 200,
      },
    },
  });
  if (!campaign) return <div>Campaign not found.</div>;

  const stats = {
    total: campaign.targets.length,
    pending: campaign.targets.filter(t => t.status === "pending").length,
    calling: campaign.targets.filter(t => t.status === "calling").length,
    completed: campaign.targets.filter(t => t.status === "completed").length,
    failed: campaign.targets.filter(t => t.status === "failed").length,
    skipped: campaign.targets.filter(t => t.status === "skipped").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-xs text-ink-muted hover:underline">← All campaigns</Link>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-sub">{campaign.goal}</p>
          <p className="text-xs text-ink-muted mt-2">
            Quiet hours {campaign.quietStartHour}:00–{campaign.quietEndHour}:00 ·
            Up to {campaign.ratePerMinute} calls/min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={STATUS_CHIP[campaign.status] ?? "chip-muted"}>{campaign.status}</span>
          <CampaignControls campaignId={campaign.id} status={campaign.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Targets" value={stats.total} />
        <Kpi label="Pending" value={stats.pending} accent="warm" />
        <Kpi label="Calling" value={stats.calling} />
        <Kpi label="Completed" value={stats.completed} accent="cool" />
        <Kpi label="Failed" value={stats.failed} accent="hot" />
        <Kpi label="Skipped" value={stats.skipped} />
      </div>

      <div className="card overflow-hidden">
        {campaign.targets.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No targets in this campaign</div>
            <div className="empty-sub">No customers matched the filter. Try widening the lapse window or turning off the SMS-consent requirement.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="text-right">Attempts</th>
                <th>Last attempt</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {campaign.targets.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.customer.firstName ?? ""} {t.customer.lastName ?? "(no name)"}</td>
                  <td className="text-xs">{t.customer.phone ?? "—"}</td>
                  <td>
                    <span className={
                      t.status === "completed" ? "chip-cool" :
                      t.status === "failed" ? "chip-hot" :
                      t.status === "calling" ? "chip-warm" : "chip-muted"
                    }>{t.status}</span>
                  </td>
                  <td className="text-right tabular-nums">{t.attempts}</td>
                  <td className="text-xs text-ink-muted">{t.lastAttemptAt ? formatDistanceToNowStrict(t.lastAttemptAt, { addSuffix: true }) : "—"}</td>
                  <td className="text-xs text-ink-muted max-w-md truncate">{t.outcomeNote ?? "—"}</td>
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
