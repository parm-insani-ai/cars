import { prisma } from "@/lib/prisma";
import { NewOutreachCampaignForm } from "./NewOutreachCampaignForm";

export const dynamic = "force-dynamic";

export default async function NewOutreachCampaignPage() {
  const qualifiedCount = await prisma.prospect.count({ where: { status: "qualified" } });
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Create outreach campaign</h1>
        <p className="page-sub">
          Define the pitch and the audience. The AI sales rep calls each qualified prospect in order, respecting quiet hours and your throttle.
        </p>
      </div>
      <NewOutreachCampaignForm qualifiedCount={qualifiedCount} />
    </div>
  );
}
