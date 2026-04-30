import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const user = await requireUser();
  const q = (searchParams?.q ?? "").trim();

  const where: any = { rooftopId: user.rooftopId };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { leads: true, opportunities: true } },
      vehiclesOwned: { take: 1, orderBy: { purchaseDate: "desc" } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customers</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, email…"
          className="border border-surface-border rounded-md px-3 h-9 text-sm flex-1"
        />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Drives</th>
              <th className="text-left p-3">Consent</th>
              <th className="text-right p-3">Leads</th>
              <th className="text-right p-3">Opps</th>
              <th className="text-left p-3">Last contact</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-muted">No customers match.</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-t border-surface-border">
                  <td className="p-3">
                    <Link href={`/customers/${c.id}`} className="text-lane hover:underline">
                      {c.firstName ?? ""} {c.lastName ?? "(no name)"}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="text-xs">{c.phone ?? "—"}</div>
                    <div className="text-xs text-ink-muted">{c.email ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    {c.vehiclesOwned[0]
                      ? `${c.vehiclesOwned[0].year} ${c.vehiclesOwned[0].make} ${c.vehiclesOwned[0].model}`
                      : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="p-3 text-xs">
                    <span className={c.smsConsent ? "chip-cool" : "chip-muted"}>
                      SMS {c.smsConsent ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c._count.leads}</td>
                  <td className="p-3 text-right tabular-nums">{c._count.opportunities}</td>
                  <td className="p-3 text-ink-muted">
                    {c.lastContactAt
                      ? formatDistanceToNowStrict(c.lastContactAt, { addSuffix: true })
                      : "—"}
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
