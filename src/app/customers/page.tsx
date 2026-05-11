import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const user = await requireUser();
  const q = (searchParams?.q ?? "").trim();

  const where: any = { businessId: user.businessId };
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
    include: { _count: { select: { appointments: true, callSessions: true } } },
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
              <th className="text-left p-3">Consent</th>
              <th className="text-right p-3">Appts</th>
              <th className="text-right p-3">Calls</th>
              <th className="text-left p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No customers match.</td></tr>
            ) : (
              customers.map(c => (
                <tr key={c.id} className="border-t border-surface-border hover:bg-surface-sub/60">
                  <td className="p-3">
                    <Link href={`/customers/${c.id}`} className="text-lane hover:underline">
                      {c.firstName ?? ""} {c.lastName ?? "(no name)"}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="text-xs">{c.phone ?? "—"}</div>
                    <div className="text-xs text-ink-muted">{c.email ?? "—"}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className={c.smsConsent ? "chip-cool" : "chip-muted"}>SMS {c.smsConsent ? "yes" : "no"}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c._count.appointments}</td>
                  <td className="p-3 text-right tabular-nums">{c._count.callSessions}</td>
                  <td className="p-3 text-ink-muted">{formatDistanceToNowStrict(c.updatedAt, { addSuffix: true })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
