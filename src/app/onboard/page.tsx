import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const user = await requireUser();
  const businessId = user.businessId;

  const [hoursCount, servicesCount, providersCount, business, knowledgeCount, callCount] = await Promise.all([
    prisma.businessHours.count({ where: { businessId } }),
    prisma.service.count({ where: { businessId, active: true } }),
    prisma.provider.count({ where: { businessId, active: true } }),
    prisma.business.findUnique({
      where: { id: businessId },
      include: { agentConfig: true },
    }),
    prisma.knowledgeArticle.count({ where: { businessId } }),
    prisma.callSession.count({ where: { businessId } }),
  ]);

  const greeting = business?.agentConfig?.greeting?.trim() ?? "";
  const personality = business?.agentConfig?.personality?.trim() ?? "";
  // The packs seed in a default greeting; an owner has only really configured
  // the agent once they've written their OWN greeting (or kept the default
  // intentionally — we can't tell, so we accept any non-empty value).
  const agentConfigured = Boolean(greeting.length > 0 && personality.length > 0);

  const steps = [
    {
      key: "hours",
      label: "Set your business hours",
      sub: "Ava will only offer appointment times that fall inside these.",
      href: "/hours",
      done: hoursCount > 0,
    },
    {
      key: "services",
      label: "List the services you offer",
      sub: "Each one becomes something Ava can book — with the right duration and price.",
      href: "/services",
      done: servicesCount > 0,
    },
    {
      key: "providers",
      label: "Add your staff (or treatment rooms / bays)",
      sub: "Even if it's just you, add yourself so Ava knows who delivers services.",
      href: "/providers",
      done: providersCount > 0,
    },
    {
      key: "agent",
      label: "Configure Ava's greeting and personality",
      sub: "The first sentence every caller hears, and how she carries the conversation.",
      href: "/agent",
      done: agentConfigured,
    },
    {
      key: "knowledge",
      label: "Add the FAQs Ava should know",
      sub: "Parking, cancellation policy, what to expect — anything callers ask often.",
      href: "/knowledge",
      done: knowledgeCount > 0,
      optional: true,
    },
    {
      key: "test",
      label: "Try a test call",
      sub: "Talk to your agent in text mode and make sure she handles real questions well.",
      href: "/demo",
      done: callCount > 0,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const totalRequired = steps.filter(s => !s.optional).length;
  const requiredDone = steps.filter(s => !s.optional && s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Set up your AI receptionist</h1>
        <p className="page-sub">
          Five quick steps and Ava is ready to answer calls for {business?.name ?? "your business"}.
          You can come back to this page any time — it remembers your progress.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{requiredDone} of {totalRequired} required steps done</span>
          <span className="text-ink-muted">{pct}% complete</span>
        </div>
        <div className="h-2 rounded-full bg-surface-sub overflow-hidden">
          <div
            className="h-full bg-lane-cool transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className="card p-4 flex items-start gap-4">
            <span
              className={
                "flex-none mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-semibold " +
                (s.done ? "bg-lane-cool text-white" : "bg-surface-sub text-ink-muted")
              }
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2 flex-wrap">
                {s.label}
                {s.optional && <span className="chip-muted text-[10px]">Optional</span>}
                {s.done && <span className="chip-cool text-[10px]">Done</span>}
              </div>
              <div className="text-xs text-ink-muted mt-0.5">{s.sub}</div>
            </div>
            <Link
              href={s.href}
              className={s.done ? "btn-secondary flex-none" : "btn-primary flex-none"}
            >
              {s.done ? "Review" : "Set up"}
            </Link>
          </li>
        ))}
      </ol>

      {requiredDone === totalRequired && (
        <div className="card p-5 border-l-4 border-lane-cool bg-lane-cool/5">
          <h2 className="font-semibold">You're ready to take calls.</h2>
          <p className="text-sm text-ink-muted mt-1">
            Hand your Twilio number over to your customers and Ava will answer every call. Head to{" "}
            <Link href="/" className="text-lane hover:underline">your dashboard</Link> to watch them come in.
          </p>
        </div>
      )}
    </div>
  );
}
