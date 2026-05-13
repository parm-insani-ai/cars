import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ServiceEditor } from "./ServiceEditor";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await requireUser();
  const services = await prisma.service.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Services</h1>
        <p className="page-sub">
          What the agent is allowed to book. If a service isn't on this list, the agent won't mention it or schedule it.
        </p>
      </div>
      <ServiceEditor
        services={services.map(s => ({
          id: s.id, name: s.name, category: s.category, durationMin: s.durationMin,
          priceUsd: s.priceUsd, description: s.description, providerKind: s.providerKind, active: s.active,
        }))}
      />
    </div>
  );
}
