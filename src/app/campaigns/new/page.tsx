import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NewCampaignForm } from "./NewCampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await requireUser();
  const totalCustomers = await prisma.customer.count({ where: { businessId: user.businessId } });
  const optedIn = await prisma.customer.count({
    where: { businessId: user.businessId, smsConsent: true },
  });
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Create campaign</h1>
        <p className="page-sub">
          Pick a list of customers and a goal. The agent will call each one in order, respecting quiet hours and your throttle limit.
        </p>
      </div>
      <NewCampaignForm totalCustomers={totalCustomers} optedIn={optedIn} />
    </div>
  );
}
