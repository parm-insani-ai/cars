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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Services</h1>
        <p className="text-xs text-ink-muted">What the voice agent can book. The agent only mentions services from this list.</p>
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
