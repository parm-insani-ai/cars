import { prisma } from "@/lib/prisma";
import { SimulatorChat } from "./SimulatorChat";

export const dynamic = "force-dynamic";

export default async function OutreachSimulatePage() {
  const campaigns = await prisma.outreachCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Try the sales rep</h1>
        <p className="page-sub">
          A free, text-mode rehearsal of the AI sales rep — same brain and script as a real call. Tune the persona and pitch here before spending call minutes.
        </p>
      </div>
      <SimulatorChat campaigns={campaigns} />
    </div>
  );
}
