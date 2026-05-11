import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AgentEditor } from "./AgentEditor";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await requireUser();
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    include: { agentConfig: true },
  });
  if (!business) return <div>No business.</div>;
  if (!business.agentConfig) return <div>Agent not configured. Seed should run.</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Voice agent</h1>
        <p className="text-xs text-ink-muted">How your agent sounds, what it&apos;s allowed to do, and where to transfer when it can&apos;t help.</p>
      </div>
      <AgentEditor
        config={{
          greeting: business.agentConfig.greeting,
          personality: business.agentConfig.personality,
          voiceProvider: business.agentConfig.voiceProvider,
          voiceId: business.agentConfig.voiceId,
          language: business.agentConfig.language,
          canBook: business.agentConfig.canBook,
          canReschedule: business.agentConfig.canReschedule,
          canCancel: business.agentConfig.canCancel,
          canTransfer: business.agentConfig.canTransfer,
          transferTo: business.agentConfig.transferTo,
          smsFooter: business.agentConfig.smsFooter,
        }}
        phoneNumber={business.phoneNumber}
        vertical={business.vertical}
      />
    </div>
  );
}
