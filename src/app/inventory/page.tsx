import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: { q?: string; body?: string; condition?: string };
}) {
  const user = await requireUser();
  const q = (searchParams?.q ?? "").trim();
  const bodyFilter = searchParams?.body ?? "all";
  const conditionFilter = searchParams?.condition ?? "all";

  const where: any = { rooftopId: user.rooftopId, status: "in_stock" };
  if (bodyFilter !== "all") where.bodyType = bodyFilter;
  if (conditionFilter === "new") where.isNew = true;
  if (conditionFilter === "used") where.isNew = false;
  if (q) {
    where.OR = [
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { stockNumber: { contains: q, mode: "insensitive" } },
      { trim: { contains: q, mode: "insensitive" } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: [{ isNew: "desc" }, { price: "asc" }],
    take: 60,
  });

  const counts = await prisma.vehicle.groupBy({
    by: ["bodyType"],
    where: { rooftopId: user.rooftopId, status: "in_stock" },
    _count: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <div className="text-xs text-ink-muted">
            {vehicles.length} matching · {counts.reduce((s, c) => s + c._count, 0).toLocaleString()} in stock
          </div>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search make, model, stock #…"
          className="border border-surface-border rounded-md px-3 h-9 text-sm flex-1 min-w-[200px]"
        />
        <select
          name="body"
          defaultValue={bodyFilter}
          className="border border-surface-border rounded-md px-2 h-9 text-sm"
        >
          <option value="all">All body types</option>
          <option value="suv">SUV</option>
          <option value="sedan">Sedan</option>
          <option value="truck">Truck</option>
          <option value="coupe">Coupe</option>
          <option value="hatchback">Hatchback</option>
          <option value="minivan">Minivan</option>
        </select>
        <select
          name="condition"
          defaultValue={conditionFilter}
          className="border border-surface-border rounded-md px-2 h-9 text-sm"
        >
          <option value="all">New + used</option>
          <option value="new">New only</option>
          <option value="used">Used only</option>
        </select>
        <button className="btn-primary" type="submit">Filter</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {vehicles.length === 0 ? (
          <div className="card p-6 col-span-full text-center text-ink-muted">No matches.</div>
        ) : (
          vehicles.map((v) => (
            <div key={v.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{v.year} {v.make} {v.model}</div>
                  <div className="text-xs text-ink-muted">{v.trim ?? ""} · stock #{v.stockNumber}</div>
                </div>
                <span className={v.isNew ? "chip-cool" : "chip-muted"}>
                  {v.isNew ? "New" : "Used"}
                </span>
              </div>
              <div className="text-lg font-semibold">${v.price.toLocaleString()}</div>
              <div className="text-xs text-ink-muted">
                {v.bodyType ?? "—"} · {v.fuel ?? "—"}
                {v.mileage ? ` · ${v.mileage.toLocaleString()} mi` : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
