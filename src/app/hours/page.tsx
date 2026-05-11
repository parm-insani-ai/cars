import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { HoursEditor } from "./HoursEditor";

export const dynamic = "force-dynamic";

export default async function HoursPage() {
  const user = await requireUser();
  const hours = await prisma.businessHours.findMany({
    where: { businessId: user.businessId },
    orderBy: { dayOfWeek: "asc" },
  });
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Business hours</h1>
        <p className="text-xs text-ink-muted">The agent only proposes appointment times inside these windows.</p>
      </div>
      <HoursEditor hours={hours.map(h => ({ dayOfWeek: h.dayOfWeek, openMin: h.openMin, closeMin: h.closeMin }))} />
    </div>
  );
}
