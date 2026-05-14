import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { chipClass, prospectStatusChip, prospectStatusLabel, dispositionLabel } from "@/lib/labels";
import { googlePlacesAvailable } from "@/outreach/sourcing/google-places";
import { outreachVapiReady } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function OutreachOverview() {
  const [byStatus, totalProspects, demos, runningCampaigns, recentCalls] = await Promise.all([
    prisma.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: "converted" } }),
    prisma.outreachCampaign.count({ where: { status: "running" } }),
    prisma.outreachCall.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { prospect: true },
    }),
  ]);

  const count = (s: string) => byStatus.find(r => r.status === s)?._count._all ?? 0;
  const callable = count("qualified");
  const contacted = count("contacted") + count("queued") + demos + count("lost");
  const convRate = contacted > 0 ? Math.round((demos / contacted) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Go-to-market engine</h1>
          <p className="page-sub">
            Source SMB prospects, qualify them with AI, and have an AI sales rep call them to book demos of Frontdesk.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/outreach/prospects" className="btn-secondary">Find prospects</Link>
          <Link href="/outreach/campaigns/new" className="btn-primary">New campaign</Link>
        </div>
      </div>

      {(!googlePlacesAvailable() || !outreachVapiReady()) && (
        <div className="card p-4 text-sm bg-surface-sub">
          <div className="font-semibold mb-1">Running in mock mode</div>
          <ul className="text-ink-muted space-y-0.5 text-xs">
            {!googlePlacesAvailable() && (
              <li>· <span className="font-mono">GOOGLE_PLACES_API_KEY</span> not set — sourcing returns synthetic prospects.</li>
            )}
            {!outreachVapiReady() && (
              <li>· Outreach Vapi assistant not configured — campaign calls are skipped with a note instead of dialed.</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Prospects" value={totalProspects} />
        <Kpi label="Qualified / callable" value={callable} accent="cool" />
        <Kpi label="Running campaigns" value={runningCampaigns} accent="warm" />
        <Kpi label="Demos booked" value={demos} accent="cool" />
        <Kpi label="Demo conversion" value={`${convRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="section-title mb-3">Pipeline</h2>
          <div className="space-y-2">
            {["new", "qualified", "queued", "contacted", "converted", "lost", "do_not_call", "disqualified"].map(s => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className={chipClass(prospectStatusChip[s])}>{prospectStatusLabel[s]}</span>
                <span className="tabular-nums font-medium">{count(s)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="section-title mb-3">Recent sales calls</h2>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-ink-muted">No outbound calls yet. Create a campaign and start it.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentCalls.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/outreach/calls/${c.id}`} className="text-lane hover:underline truncate">
                    {c.prospect.businessName}
                  </Link>
                  <span className="text-xs text-ink-muted flex-none">
                    {c.disposition ? dispositionLabel[c.disposition] : c.status} · {format(c.startedAt, "MMM d, h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "cool" | "warm" | "hot" }) {
  return (
    <div className={"kpi " + (accent ? `kpi-${accent}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
