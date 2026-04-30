import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const user = await requireUser();
  const q = (searchParams?.q ?? "").trim();
  const status = searchParams?.status ?? "all";

  const where: any = { rooftopId: user.rooftopId };
  if (status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { customer: true, assignedRep: true, interestVehicle: true },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const counts = await prisma.lead.groupBy({
    by: ["status"],
    where: { rooftopId: user.rooftopId },
    _count: true,
  });
  const total = counts.reduce((s, c) => s + c._count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-xs text-ink-muted">{total.toLocaleString()} total</p>
        </div>
      </div>

      <form className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, email…"
          className="border border-surface-border rounded-md px-3 h-9 text-sm flex-1 min-w-[200px]"
        />
        <select
          name="status"
          defaultValue={status}
          className="border border-surface-border rounded-md px-2 h-9 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="engaged">Engaged</option>
          <option value="appointment_set">Appointment set</option>
          <option value="appointment_shown">Shown</option>
          <option value="sold">Sold</option>
          <option value="lost">Lost</option>
          <option value="dead">Dead</option>
        </select>
        <button className="btn-primary" type="submit">Filter</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Interest</th>
              <th className="text-left p-3">Rep</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Score</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-muted">
                  No leads match.
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="border-t border-surface-border hover:bg-surface-sub/60">
                  <td className="p-3">
                    <Link href={`/rep/lead/${l.id}`} className="text-lane hover:underline">
                      {l.customer.firstName ?? ""} {l.customer.lastName ?? "(unknown)"}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {l.customer.phone ?? l.customer.email ?? "—"}
                    </div>
                  </td>
                  <td className="p-3">{l.source.replace("_", " ")}</td>
                  <td className="p-3">
                    {l.interestVehicle
                      ? `${l.interestVehicle.year} ${l.interestVehicle.make} ${l.interestVehicle.model}`
                      : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="p-3">{l.assignedRep?.name ?? <span className="text-ink-muted">unassigned</span>}</td>
                  <td className="p-3">
                    <span className="chip-muted">{l.status.replace("_", " ")}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{Math.round(l.score * 100)}</td>
                  <td className="p-3 text-ink-muted">
                    {formatDistanceToNowStrict(l.createdAt, { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
