import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { AgentEditor } from "./AgentEditor";
import { verticalLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await requireUser();
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    include: { agentConfig: true },
  });
  if (!business) return <div>No business found.</div>;
  if (!business.agentConfig) return <div>Agent isn't configured yet. Re-run the seed.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Voice agent</h1>
        <p className="page-sub">How your agent sounds, what it's allowed to do, and where to transfer when it needs a human.</p>
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
        vertical={verticalLabel[business.vertical] ?? business.vertical}
      />
    </div>
  );
}
