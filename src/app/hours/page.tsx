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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Business hours</h1>
        <p className="page-sub">The agent only offers appointment times that fall within these hours.</p>
      </div>
      <HoursEditor hours={hours.map(h => ({ dayOfWeek: h.dayOfWeek, openMin: h.openMin, closeMin: h.closeMin }))} />
    </div>
  );
}
