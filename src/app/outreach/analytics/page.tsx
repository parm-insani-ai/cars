import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/outreach/categories";

export const dynamic = "force-dynamic";

const WINDOWS = [
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d",  label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: 0 },
];

const HALIFAX_TZ = "America/Halifax";

export default async function OutreachAnalyticsPage({
  searchParams,
}: {
  searchParams: { window?: string; campaign?: string };
}) {
  const win = searchParams.window ?? "7d";
  const campaign = searchParams.campaign ?? "all";
  const hours = WINDOWS.find(w => w.key === win)?.hours ?? 24 * 7;

  const where: any = {};
  if (hours > 0) where.startedAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
  if (campaign !== "all") where.campaignId = campaign;

  const [calls, campaigns] = await Promise.all([
    prisma.outreachCall.findMany({
      where,
      select: {
        id: true,
        startedAt: true,
        durationSec: true,
        disposition: true,
        status: true,
        cost: true,
        campaignId: true,
        prospect: { select: { category: true, categoryGroup: true } },
        turns: { select: { role: true } },
      },
    }),
    prisma.outreachCampaign.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 30,
    }),
  ]);

  // Funnel — each stage is a subset of the one above it.
  const dialed = calls.length;
  const connected = calls.filter(c => c.turns.some(t => t.role === "customer") || (c.durationSec ?? 0) > 15).length;
  const reachedHuman = calls.filter(c =>
    c.disposition &&
    !["voicemail", "no_answer"].includes(c.disposition) &&
    c.status !== "failed" &&
    c.turns.filter(t => t.role === "customer").length >= 1,
  ).length;
  const engaged = calls.filter(c => c.turns.filter(t => t.role === "customer").length >= 2).length;
  const callbacks = calls.filter(c => c.disposition === "callback_requested").length;
  const demos = calls.filter(c => c.disposition === "demo_booked").length;

  const totalCost = calls.reduce((sum, c) => sum + (c.cost ?? 0), 0);
  const costPerConnect = connected > 0 ? totalCost / connected : 0;
  const costPerDemo = demos > 0 ? totalCost / demos : 0;

  // Hour-of-day breakdown (Halifax time). We want to know: at which hours
  // are we actually getting connects, so future campaigns can bias toward
  // the good windows.
  const hourBuckets = new Map<number, { dialed: number; connected: number; demos: number }>();
  for (let h = 0; h < 24; h++) hourBuckets.set(h, { dialed: 0, connected: 0, demos: 0 });
  for (const c of calls) {
    const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: HALIFAX_TZ, hour: "2-digit", hour12: false }).format(c.startedAt));
    const b = hourBuckets.get(hour)!;
    b.dialed++;
    if (c.turns.some(t => t.role === "customer") || (c.durationSec ?? 0) > 15) b.connected++;
    if (c.disposition === "demo_booked") b.demos++;
  }

  // Per-category breakdown so operators can see which vertical converts.
  const catBuckets = new Map<string, { dialed: number; connected: number; demos: number }>();
  for (const c of calls) {
    const cat = c.prospect.category;
    const b = catBuckets.get(cat) ?? { dialed: 0, connected: 0, demos: 0 };
    b.dialed++;
    if (c.turns.some(t => t.role === "customer") || (c.durationSec ?? 0) > 15) b.connected++;
    if (c.disposition === "demo_booked") b.demos++;
    catBuckets.set(cat, b);
  }
  const byCategory = Array.from(catBuckets.entries())
    .map(([cat, b]) => ({ cat, ...b }))
    .sort((a, b) => b.dialed - a.dialed);

  function href(next: { window?: string; campaign?: string }) {
    const params = new URLSearchParams();
    const w = next.window ?? win;
    const c = next.campaign ?? campaign;
    if (w !== "7d") params.set("window", w);
    if (c !== "all") params.set("campaign", c);
    const s = params.toString();
    return s ? `/outreach/analytics?${s}` : "/outreach/analytics";
  }
  const chip = (active: boolean) =>
    "px-2.5 py-1 rounded-lg text-xs " +
    (active ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Outreach analytics</h1>
        <p className="page-sub">Where the funnel is bleeding, at what hour, in what category.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          {WINDOWS.map(w => (
            <Link key={w.key} href={href({ window: w.key })} className={chip(win === w.key)}>{w.label}</Link>
          ))}
        </div>
        {campaigns.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Link href={href({ campaign: "all" })} className={chip(campaign === "all")}>All campaigns</Link>
            {campaigns.map(c => (
              <Link key={c.id} href={href({ campaign: c.id })} className={chip(campaign === c.id)}>{c.name}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Funnel */}
      <div className="card p-5">
        <h2 className="section-title mb-3">Funnel</h2>
        <FunnelStage label="Dialed"                       count={dialed}       base={dialed} />
        <FunnelStage label="Connected (any voice/turns)" count={connected}    base={dialed} />
        <FunnelStage label="Reached a human"              count={reachedHuman} base={dialed} />
        <FunnelStage label="Engaged (2+ turns)"           count={engaged}      base={dialed} />
        <FunnelStage label="Callback requested"           count={callbacks}    base={dialed} tone="warm" />
        <FunnelStage label="Demo booked"                  count={demos}        base={dialed} tone="cool" />
      </div>

      {/* Cost */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total cost"       value={fmtUsd(totalCost)} />
        <Kpi label="Cost per dial"    value={dialed > 0 ? fmtUsd(totalCost / dialed) : "—"} />
        <Kpi label="Cost per connect" value={connected > 0 ? fmtUsd(costPerConnect) : "—"} accent="warm" />
        <Kpi label="Cost per demo"    value={demos > 0 ? fmtUsd(costPerDemo) : "—"} accent="cool" />
      </div>

      {/* Time-of-day heatmap-lite */}
      <div className="card p-5 space-y-2">
        <h2 className="section-title">Answer rate by hour (Halifax time)</h2>
        <p className="text-xs text-ink-muted">
          Which windows actually get real conversations? Bias future campaigns toward the tall bars.
        </p>
        <div className="flex items-end gap-0.5 h-32 mt-2">
          {Array.from(hourBuckets.entries()).map(([hour, b]) => {
            const total = b.dialed;
            const rate = total > 0 ? b.connected / total : 0;
            const heightPct = Math.round(rate * 100);
            return (
              <div key={hour} className="flex-1 flex flex-col items-center justify-end min-w-[10px]" title={`${hour}:00 — ${b.connected}/${b.dialed} connects (${heightPct}%)`}>
                <div
                  className={"w-full rounded-t " + (heightPct >= 30 ? "bg-lane-cool" : heightPct >= 15 ? "bg-lane-warm" : "bg-ink/20")}
                  style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex text-[9px] text-ink-muted mt-1">
          {Array.from(hourBuckets.keys()).map(h => (
            <div key={h} className="flex-1 text-center min-w-[10px]">{h % 3 === 0 ? h : ""}</div>
          ))}
        </div>
      </div>

      {/* Per-category */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="section-title">By category</h2>
        </div>
        {byCategory.length === 0 ? (
          <div className="empty px-5"><div className="empty-title">No calls yet</div></div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Dialed</th>
                <th className="text-right">Connected</th>
                <th className="text-right">Connect %</th>
                <th className="text-right">Demos</th>
                <th className="text-right">Demo %</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(row => (
                <tr key={row.cat}>
                  <td className="font-medium">{categoryLabel(row.cat)}</td>
                  <td className="text-right tabular-nums">{row.dialed}</td>
                  <td className="text-right tabular-nums">{row.connected}</td>
                  <td className="text-right tabular-nums">{pct(row.connected, row.dialed)}</td>
                  <td className="text-right tabular-nums">{row.demos}</td>
                  <td className="text-right tabular-nums">{pct(row.demos, row.dialed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FunnelStage({ label, count, base, tone }: { label: string; count: number; base: number; tone?: "cool" | "warm" }) {
  const rate = base > 0 ? count / base : 0;
  const widthPct = base > 0 ? Math.max(2, Math.round(rate * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-medium">
          {count.toLocaleString()} <span className="text-ink-muted text-xs">· {pct(count, base)}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-sub mt-1 overflow-hidden">
        <div
          className={"h-full " + (tone === "cool" ? "bg-lane-cool" : tone === "warm" ? "bg-lane-warm" : "bg-ink/60")}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "cool" | "warm" | "hot" }) {
  return (
    <div className={"kpi " + (accent ? `kpi-${accent}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}
function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0.00";
  return `$${n.toFixed(2)}`;
}
