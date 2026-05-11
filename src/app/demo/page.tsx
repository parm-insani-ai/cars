import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DemoChat } from "./DemoChat";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const user = await requireUser();
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    include: { agentConfig: true },
  });
  if (!business || !business.agentConfig) return <div>Agent not configured.</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Demo simulator</h1>
        <p className="text-xs text-ink-muted">
          Have a text-mode conversation with your voice agent. Same brain, same tools — just no audio. Use it to test prompt
          changes, knowledge base updates, or to demo to a customer before the phone number is live.
        </p>
      </div>
      <DemoChat businessId={business.id} greeting={business.agentConfig.greeting} businessName={business.name} />
    </div>
  );
}
