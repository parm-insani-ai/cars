import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { chipClass, prospectStatusChip, prospectStatusLabel } from "@/lib/labels";
import { categoryLabel, groupLabel, CATEGORY_GROUPS } from "@/outreach/categories";
import { SourceForm } from "./SourceForm";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "Unqualified" },
  { key: "qualified", label: "Qualified" },
  { key: "queued", label: "In a campaign" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Demo booked" },
  { key: "do_not_call", label: "Do not call" },
];

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { status?: string; group?: string };
}) {
  const status = searchParams.status ?? "all";
  const group = searchParams.group ?? "all";

  const where: Prisma.ProspectWhereInput = {};
  if (status !== "all") where.status = status as any;
  if (group !== "all") where.categoryGroup = group;

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const qs = (next: { status?: string; group?: string }) => {
    const s = next.status ?? status;
    const g = next.group ?? group;
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (g !== "all") params.set("group", g);
    const str = params.toString();
    return str ? `/outreach/prospects?${str}` : "/outreach/prospects";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Prospects</h1>
        <p className="page-sub">Halifax small businesses we've sourced as potential AI-receptionist customers.</p>
      </div>

      <SourceForm />

      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap text-sm">
          {STATUS_FILTERS.map(f => (
            <Link
              key={f.key}
              href={qs({ status: f.key })}
              className={
                "px-3 py-1.5 rounded-lg " +
                (status === f.key ? "bg-ink text-white" : "hover:bg-surface-sub text-ink")
              }
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <Link
            href={qs({ group: "all" })}
            className={
              "px-2.5 py-1 rounded-lg " +
              (group === "all" ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted")
            }
          >
            All types
          </Link>
          {CATEGORY_GROUPS.map(g => (
            <Link
              key={g.id}
              href={qs({ group: g.id })}
              className={
                "px-2.5 py-1 rounded-lg " +
                (group === g.id ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted")
              }
            >
              {g.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {prospects.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No prospects here yet</div>
            <div className="empty-sub">Use “Find Halifax prospects” above to pull a batch of small businesses to call.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>Type</th>
                <th>Location</th>
                <th>Phone</th>
                <th className="text-right">Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/outreach/prospects/${p.id}`} className="text-lane hover:underline">
                      {p.businessName}
                    </Link>
                  </td>
                  <td className="text-xs text-ink-muted">
                    {categoryLabel(p.category)}
                    <span className="text-ink-muted/60"> · {groupLabel(p.categoryGroup)}</span>
                  </td>
                  <td className="text-xs text-ink-muted">
                    {[p.city, p.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="text-xs">{p.phone ?? "—"}</td>
                  <td className="text-right tabular-nums">{p.score ?? "—"}</td>
                  <td><span className={chipClass(prospectStatusChip[p.status])}>{prospectStatusLabel[p.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
