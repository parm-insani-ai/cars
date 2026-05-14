import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { chipClass, prospectStatusChip, prospectStatusLabel, verticalLabel } from "@/lib/labels";
import { SourceForm } from "./SourceForm";

export const dynamic = "force-dynamic";

const FILTERS = [
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
  searchParams: { status?: string };
}) {
  const status = searchParams.status ?? "all";
  const where: Prisma.ProspectWhereInput = status === "all" ? {} : { status: status as any };
  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Prospects</h1>
        <p className="page-sub">SMBs we've sourced as potential Frontdesk customers.</p>
      </div>

      <SourceForm />

      <div className="flex items-center gap-1 flex-wrap text-sm">
        {FILTERS.map(f => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/outreach/prospects" : `/outreach/prospects?status=${f.key}`}
            className={
              "px-3 py-1.5 rounded-lg " +
              (status === f.key ? "bg-ink text-white" : "hover:bg-surface-sub text-ink")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        {prospects.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No prospects here yet</div>
            <div className="empty-sub">Use “Source prospects” above to pull a batch of SMBs to call.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>Vertical</th>
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
                  <td className="text-xs text-ink-muted">{verticalLabel[p.vertical] ?? p.vertical}</td>
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
