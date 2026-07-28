import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { chipClass, dispositionChip, dispositionLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const DISPOSITION_FILTERS = [
  { key: "all", label: "All" },
  { key: "answered", label: "Answered (any)" },
  { key: "demo_booked", label: "Demo booked" },
  { key: "callback_requested", label: "Callback" },
  { key: "not_interested", label: "Not interested" },
  { key: "voicemail", label: "Voicemail" },
  { key: "no_answer", label: "No answer" },
  { key: "failed", label: "Failed" },
];

const WINDOW_FILTERS = [
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d",  label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: 0 },
];

type SearchParams = {
  disposition?: string;
  window?: string;
  campaign?: string;
  q?: string;
};

export default async function OutreachCallsIndex({ searchParams }: { searchParams: SearchParams }) {
  const disposition = searchParams.disposition ?? "all";
  const win = searchParams.window ?? "7d";
  const campaign = searchParams.campaign ?? "all";
  const q = (searchParams.q ?? "").trim();

  const hours = WINDOW_FILTERS.find(w => w.key === win)?.hours ?? 24 * 7;

  const where: Prisma.OutreachCallWhereInput = {};
  if (hours > 0) where.startedAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
  if (campaign !== "all") where.campaignId = campaign;
  if (disposition === "failed") where.status = "failed";
  else if (disposition === "answered") where.disposition = { in: ["demo_booked", "not_interested", "callback_requested"] };
  else if (disposition !== "all") where.disposition = { equals: disposition as Prisma.EnumProspectDispositionNullableFilter["equals"] };
  if (q) where.prospect = { businessName: { contains: q, mode: "insensitive" } };

  const [calls, campaigns, totalCount] = await Promise.all([
    prisma.outreachCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 300,
      include: {
        prospect: { select: { id: true, businessName: true, phone: true, city: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.outreachCampaign.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 50,
    }),
    prisma.outreachCall.count({ where }),
  ]);

  function href(next: Partial<SearchParams>) {
    const params = new URLSearchParams();
    const d = next.disposition ?? disposition;
    const w = next.window ?? win;
    const c = next.campaign ?? campaign;
    const qNext = next.q ?? q;
    if (d !== "all") params.set("disposition", d);
    if (w !== "7d") params.set("window", w);
    if (c !== "all") params.set("campaign", c);
    if (qNext) params.set("q", qNext);
    const str = params.toString();
    return str ? `/outreach/calls?${str}` : "/outreach/calls";
  }

  const chip = (active: boolean) =>
    "px-2.5 py-1 rounded-lg text-xs " +
    (active ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted");

  const anyFilterActive = disposition !== "all" || win !== "7d" || campaign !== "all" || q.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">All outreach calls</h1>
        <p className="page-sub">Every outbound sales call, filterable. Click any row for the full transcript, summary, recording, and prospect details.</p>
      </div>

      {/* Search — plain GET form. Carries other filters forward as hidden inputs. */}
      <form method="GET" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search business name…"
          className="flex-1 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
        />
        {disposition !== "all" && <input type="hidden" name="disposition" value={disposition} />}
        {win !== "7d" && <input type="hidden" name="window" value={win} />}
        {campaign !== "all" && <input type="hidden" name="campaign" value={campaign} />}
        <button type="submit" className="btn-secondary">Search</button>
        {anyFilterActive && (
          <Link href="/outreach/calls" className="text-xs text-ink-muted hover:underline">Clear</Link>
        )}
      </form>

      <div className="space-y-2">
        <FilterRow label="Outcome">
          {DISPOSITION_FILTERS.map(f => (
            <Link key={f.key} href={href({ disposition: f.key })} className={chip(disposition === f.key)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="When">
          {WINDOW_FILTERS.map(f => (
            <Link key={f.key} href={href({ window: f.key })} className={chip(win === f.key)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        {campaigns.length > 0 && (
          <FilterRow label="Campaign">
            <Link href={href({ campaign: "all" })} className={chip(campaign === "all")}>
              All campaigns
            </Link>
            {campaigns.map(c => (
              <Link key={c.id} href={href({ campaign: c.id })} className={chip(campaign === c.id)}>
                {c.name}
              </Link>
            ))}
          </FilterRow>
        )}
      </div>

      <div className="text-xs text-ink-muted">
        {totalCount.toLocaleString()} call{totalCount === 1 ? "" : "s"} match
        {calls.length < totalCount && ` · showing first ${calls.length}`}
      </div>

      <div className="card overflow-hidden">
        {calls.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No calls match this filter</div>
            <div className="empty-sub">Try widening the time window or clearing the outcome filter.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>City</th>
                <th>When</th>
                <th className="text-right">Duration</th>
                <th>Campaign</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">
                    <Link href={`/outreach/calls/${c.id}`} className="text-lane hover:underline">
                      {c.prospect.businessName}
                    </Link>
                    {c.prospect.phone && <div className="text-[10px] text-ink-muted">{c.prospect.phone}</div>}
                  </td>
                  <td className="text-xs text-ink-muted">{c.prospect.city ?? "—"}</td>
                  <td className="text-xs text-ink-muted">{format(c.startedAt, "MMM d, h:mm a")}</td>
                  <td className="text-right tabular-nums text-xs">{c.durationSec != null ? `${c.durationSec}s` : "—"}</td>
                  <td className="text-xs text-ink-muted truncate max-w-[180px]">{c.campaign?.name ?? "—"}</td>
                  <td>
                    {c.disposition ? (
                      <span className={chipClass(dispositionChip[c.disposition])}>{dispositionLabel[c.disposition]}</span>
                    ) : (
                      <span className="chip-warm text-[10px]">{c.status}</span>
                    )}
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold w-16 pt-1.5 shrink-0">
        {label}
      </div>
      <div className="flex items-center gap-1 flex-wrap flex-1">{children}</div>
    </div>
  );
}
