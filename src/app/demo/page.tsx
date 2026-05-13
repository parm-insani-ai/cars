import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DemoChat } from "./DemoChat";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const user = await requireUser();
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    include: { agentConfig: true, services: { where: { active: true }, take: 3 } },
  });
  if (!business || !business.agentConfig) return <div>Agent isn't configured.</div>;

  const exampleQuestion = business.vertical === "dealership"
    ? "Hi, I'd love to test drive a Toyota RAV4 sometime this week"
    : business.vertical === "service_shop"
    ? "My check engine light came on, when can you take a look?"
    : "Can I book a massage with Sara on Friday afternoon?";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Try the agent</h1>
        <p className="page-sub">
          A text-mode conversation with your real voice agent. Same brain, same tools — just no audio. Use this to test prompt changes or demo to someone before your phone number is live.
        </p>
      </div>

      <div className="card p-4 text-sm text-ink-muted">
        <span className="font-medium text-ink">Try saying something like: </span>
        <span className="italic">&ldquo;{exampleQuestion}&rdquo;</span>
      </div>

      <DemoChat businessId={business.id} greeting={business.agentConfig.greeting} businessName={business.name} />
    </div>
  );
}
