import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { providerKindLabel, humanize } from "@/lib/labels";

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
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Staff &amp; resources</h1>
        <p className="page-sub">People (or rooms / bays) the agent can book appointments with. Editing comes from the admin API for now.</p>
      </div>

      <div className="card overflow-hidden">
        {providers.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No staff yet</div>
            <div className="empty-sub">Add at least one so the agent has someone to book.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Schedule</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-xs">{providerKindLabel[p.kind] ?? humanize(p.kind)}</td>
                  <td className="text-xs text-ink-muted">
                    {p.shifts.length === 0
                      ? "Not scheduled"
                      : p.shifts.map(s => `${DAYS[s.dayOfWeek]} ${fmt(s.startMin)}–${fmt(s.endMin)}`).join(", ")}
                  </td>
                  <td>
                    <span className={p.active ? "chip-cool" : "chip-muted"}>{p.active ? "Active" : "Inactive"}</span>
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

function fmt(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? ":" + m.toString().padStart(2, "0") : ""}${ampm.toLowerCase()}`;
}
