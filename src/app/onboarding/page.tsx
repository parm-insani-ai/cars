import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const rooftop = await prisma.rooftop.findUnique({ where: { id: user.rooftopId } });
  if (!rooftop) return <div>No rooftop.</div>;

  const [users, vehicles, leads, ROs] = await Promise.all([
    prisma.user.count({ where: { rooftopId: rooftop.id, role: "rep" } }),
    prisma.vehicle.count({ where: { rooftopId: rooftop.id } }),
    prisma.lead.count({ where: { rooftopId: rooftop.id } }),
    prisma.serviceRO.count({ where: { rooftopId: rooftop.id } }),
  ]);

  const steps = [
    {
      title: "Connect your CRM",
      done: rooftop.crmProvider !== "mock",
      detail: `Currently: ${rooftop.crmProvider}. We start with VinSolutions; DealerSocket follows.`,
      cta: "Settings →",
      href: "/settings",
    },
    {
      title: "Connect your phone system",
      done: rooftop.phoneProvider !== "mock",
      detail: `Currently: ${rooftop.phoneProvider}. CallRevu, Car Wars, Dialpad, RingCentral supported.`,
      cta: "Settings →",
      href: "/settings",
    },
    {
      title: "Pull inventory",
      done: vehicles > 0,
      detail: `${vehicles} vehicles in stock. HomeNet feed or nightly CSV.`,
      cta: vehicles ? "View →" : "Settings →",
      href: vehicles ? "/inventory" : "/settings",
    },
    {
      title: "Add reps",
      done: users > 0,
      detail: `${users} sales reps active.`,
      cta: "View →",
      href: "/manager",
    },
    {
      title: "Set voice & SOPs",
      done: Boolean(rooftop.voiceProfile),
      detail: rooftop.voiceProfile ? "Configured." : "Customize how Revline writes for you.",
      cta: "Settings →",
      href: "/settings",
    },
    {
      title: "Verify TCPA consent flow",
      done: false,
      detail: "Confirm SMS opt-in is captured at point of sale and synced to the customer record.",
      cta: "Customers →",
      href: "/customers",
    },
    {
      title: "Run the demo simulator",
      done: leads > 0 && ROs > 0,
      detail: `${leads} leads, ${ROs} service ROs ingested. Trigger more from the demo simulator.`,
      cta: "Demo →",
      href: "/demo",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="text-sm text-ink-muted">
          {completed} of {steps.length} steps complete. Aim for green within 48 hours of pilot kickoff.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className={"w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium " + (s.done ? "bg-lane-cool text-white" : "bg-surface-sub border border-surface-border text-ink-muted")}>
              {s.done ? "✓" : i + 1}
            </div>
            <div className="flex-1">
              <div className="font-medium">{s.title}</div>
              <div className="text-xs text-ink-muted">{s.detail}</div>
            </div>
            <Link href={s.href} className="btn-secondary">{s.cta}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
