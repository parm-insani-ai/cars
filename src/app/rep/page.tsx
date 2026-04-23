import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function RepPickerPage() {
  const reps = await prisma.user.findMany({
    where: { role: "rep", active: true },
    include: { rooftop: true, _count: { select: { tasks: { where: { status: "open" } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Pick a rep to see their feed</h1>
      <div className="space-y-2">
        {reps.map((r) => (
          <Link
            key={r.id}
            href={`/rep/${r.id}`}
            className="card p-4 flex items-center justify-between hover:border-lane"
          >
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-ink-muted">{r.rooftop.name}</div>
            </div>
            <div className="text-sm text-ink-muted">{r._count.tasks} open tasks</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
