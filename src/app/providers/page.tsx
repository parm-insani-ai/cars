import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default async function ProvidersPage() {
  const user = await requireUser();
  const providers = await prisma.provider.findMany({
    where: { businessId: user.businessId },
    include: { shifts: { orderBy: { dayOfWeek: "asc" } } },
    orderBy: [{ active: "desc" }, { kind: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Providers</h1>
        <p className="text-xs text-ink-muted">People or resources the agent books appointments with (stylist, mechanic, sales rep, room, bay…).</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Kind</th>
              <th className="text-left p-3">Shifts</th>
              <th className="text-left p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-ink-muted">No providers yet.</td></tr>
            ) : providers.map(p => (
              <tr key={p.id} className={"border-t border-surface-border " + (p.active ? "" : "opacity-50")}>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-xs">{p.kind}</td>
                <td className="p-3 text-xs text-ink-muted">
                  {p.shifts.length === 0 ? "—" :
                    p.shifts.map(s => `${DAYS[s.dayOfWeek]} ${fmt(s.startMin)}–${fmt(s.endMin)}`).join(", ")}
                </td>
                <td className="p-3 text-xs">
                  <span className={p.active ? "chip-cool" : "chip-muted"}>{p.active ? "active" : "inactive"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">Add and edit providers via the admin API (coming soon to this screen). For now, seed data uses the vertical pack defaults.</p>
    </div>
  );
}

function fmt(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? ":" + m.toString().padStart(2, "0") : ""}${ampm.toLowerCase()}`;
}
