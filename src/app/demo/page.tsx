import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DemoSimulator } from "./DemoSimulator";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const user = await requireUser();
  const inventory = await prisma.vehicle.findMany({
    where: { rooftopId: user.rooftopId, status: "in_stock" },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Demo simulator</h1>
        <p className="text-sm text-ink-muted">
          Fire synthetic webhook events at the dev instance. Useful for showing the product to a dealer before the real connectors are live.
        </p>
      </div>
      <DemoSimulator
        rooftopId={user.rooftopId}
        sampleStockNumbers={inventory.map((v) => ({
          stockNumber: v.stockNumber,
          label: `${v.year} ${v.make} ${v.model}`,
        }))}
      />
    </div>
  );
}
