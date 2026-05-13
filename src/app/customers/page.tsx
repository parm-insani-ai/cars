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
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Customers</h1>
        <p className="page-sub">Everyone who's called or been booked. We add them automatically.</p>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name, phone, or email…" className="input flex-1" />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      <div className="card overflow-hidden">
        {customers.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{q ? "No customers match" : "No customers yet"}</div>
            <div className="empty-sub">
              {q ? "Try a different name, phone, or email." : "Your first caller will appear here."}
            </div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Text consent</th>
                <th className="text-right">Appointments</th>
                <th className="text-right">Calls</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`} className="text-lane hover:underline">
                      {c.firstName ?? ""} {c.lastName ?? "(no name)"}
                    </Link>
                  </td>
                  <td>
                    <div className="text-xs">{c.phone ?? "—"}</div>
                    <div className="text-xs text-ink-muted">{c.email ?? "—"}</div>
                  </td>
                  <td>
                    <span className={c.smsConsent ? "chip-cool" : "chip-muted"}>
                      {c.smsConsent ? "Opted in" : "Not opted in"}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{c._count.appointments}</td>
                  <td className="text-right tabular-nums">{c._count.callSessions}</td>
                  <td className="text-ink-muted text-xs">{formatDistanceToNowStrict(c.updatedAt, { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
