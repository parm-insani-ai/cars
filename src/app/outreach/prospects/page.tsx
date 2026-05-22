import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { chipClass, prospectStatusChip, prospectStatusLabel } from "@/lib/labels";
import {
  categoryLabel,
  groupLabel,
  categoryById,
  categoriesInGroup,
  CATEGORY_GROUPS,
  type CategoryGroup,
} from "@/outreach/categories";
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
  searchParams: { status?: string; group?: string; category?: string };
}) {
  const status = searchParams.status ?? "all";
  const category = searchParams.category ?? "all";
  // The major group is implied by a chosen sub-category.
  const group =
    category !== "all" ? categoryById(category)?.group ?? "all" : searchParams.group ?? "all";

  const where: Prisma.ProspectWhereInput = {};
  if (status !== "all") where.status = status as any;
  if (category !== "all") where.category = category;
  else if (group !== "all") where.categoryGroup = group;

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  function href(next: { status?: string; group?: string; category?: string }) {
    const s = next.status ?? status;
    let g = next.group ?? group;
    let c = next.category ?? category;
    if (next.group !== undefined) c = "all"; // switching group clears the sub-category
    if (c !== "all") g = categoryById(c)?.group ?? g;
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (g !== "all") params.set("group", g);
    if (c !== "all") params.set("category", c);
    const str = params.toString();
    return str ? `/outreach/prospects?${str}` : "/outreach/prospects";
  }

  const chip = (active: boolean, small = false) =>
    (small ? "px-2.5 py-1 rounded-lg text-xs " : "px-3 py-1.5 rounded-lg text-sm ") +
    (active ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Prospects</h1>
        <p className="page-sub">Halifax small businesses we've sourced as potential AI-receptionist customers.</p>
      </div>

      <SourceForm />

      <div className="space-y-2">
        {/* Status */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <Link key={f.key} href={href({ status: f.key })} className={chip(status === f.key)}>
              {f.label}
            </Link>
          ))}
        </div>

        {/* Major category */}
        <div className="flex items-center gap-1 flex-wrap">
          <Link href={href({ group: "all" })} className={chip(group === "all", true)}>
            All types
          </Link>
          {CATEGORY_GROUPS.map(g => (
            <Link key={g.id} href={href({ group: g.id })} className={chip(group === g.id, true)}>
              {g.label}
            </Link>
          ))}
        </div>

        {/* Sub-category — only once a major category is chosen */}
        {group !== "all" && (
          <div className="flex items-center gap-1 flex-wrap pl-3 border-l-2 border-surface-border">
            <Link href={href({ category: "all" })} className={chip(category === "all", true)}>
              All {groupLabel(group).toLowerCase()}
            </Link>
            {categoriesInGroup(group as CategoryGroup).map(c => (
              <Link key={c.id} href={href({ category: c.id })} className={chip(category === c.id, true)}>
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {prospects.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No prospects match this filter</div>
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
