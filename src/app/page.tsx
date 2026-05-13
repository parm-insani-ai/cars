import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserOrRedirect } from "@/lib/auth";
import { startOfDay, endOfDay, formatDistanceToNowStrict, format } from "date-fns";
import { callOutcomeLabel, callOutcomeChip, chipClass, apptStatusLabel, apptStatusChip } from "@/lib/labels";
import { listIntegrations } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUserOrRedirect();
  const businessId = user.businessId;

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [
    callsToday,
    callsBooked,
    apptsToday,
    apptsUpcoming,
    customerCount,
    recentCalls,
    todaysAppts,
  ] = await Promise.all([
    prisma.callSession.count({ where: { businessId, startedAt: { gte: today } } }),
    prisma.callSession.count({ where: { businessId, startedAt: { gte: today }, outcome: "booked" } }),
    prisma.appointment.count({ where: { businessId, scheduledAt: { gte: today, lte: todayEnd } } }),
    prisma.appointment.count({ where: { businessId, scheduledAt: { gt: todayEnd }, status: { in: ["pending", "confirmed", "reminded"] } } }),
    prisma.customer.count({ where: { businessId } }),
    prisma.callSession.findMany({
      where: { businessId },
      include: { customer: true },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: { businessId, scheduledAt: { gte: today, lte: todayEnd } },
      include: { customer: true, service: true, provider: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  const integrations = listIntegrations();
  const optionalConnected = integrations.filter(i => !i.required && i.connected).length;
  const optionalTotal = integrations.filter(i => !i.required).length;
  const needsSetup = integrations.filter(i => !i.connected);

  const bookingRate = callsToday > 0 ? Math.round((callsBooked / callsToday) * 100) : null;

  return (
    <div className="space-y-8">
      {/* Welcome ------------------------------------------------------- */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{greet()}, {user.name.split(" ")[0]}.</h1>
          <p className="page-sub">Here's what's happening at {user.business.name} today.</p>
        </div>
        <Link href="/demo" className="btn-primary">
          <span className="text-base">▶</span> Try the agent
        </Link>
      </div>

      {/* KPI strip ---------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Calls today" value={callsToday} sub={callsToday === 0 ? "Quiet so far" : undefined} />
        <Kpi label="Booked today" value={callsBooked} sub={bookingRate != null ? `${bookingRate}% of calls` : undefined} accent="cool" />
        <Kpi label="Appointments today" value={apptsToday} />
        <Kpi label="Upcoming appointments" value={apptsUpcoming} />
      </div>

      {/* Setup nudge -------------------------------------------------- */}
      {needsSetup.length > 0 && (
        <div className="card p-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Finish setting up Frontdesk</h2>
            <p className="text-sm text-ink-muted mt-1">
              {optionalConnected === 0
                ? "Connect your phone provider and text messaging to take real calls and send confirmations."
                : `${optionalConnected} of ${optionalTotal} optional integrations connected. Add the rest when you're ready.`}
            </p>
          </div>
          <Link href="/settings" className="btn-primary flex-none">Open settings</Link>
        </div>
      )}

      {/* Two-column: today's appts + recent calls -------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Today's appointments" href="/appointments" cta="View all">
          {todaysAppts.length === 0 ? (
            <Empty
              title="Nothing booked today"
              sub="When a caller books, it'll show up here automatically."
              actionLabel="Try the agent →"
              actionHref="/demo"
            />
          ) : (
            <ul className="divide-y divide-surface-border">
              {todaysAppts.map(a => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <div className="text-sm font-medium w-20 flex-none">{format(a.scheduledAt, "h:mm a")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {a.customer ? `${a.customer.firstName ?? ""} ${a.customer.lastName ?? ""}`.trim() || "(no name)" : "Unknown caller"}
                    </div>
                    <div className="text-xs text-ink-muted truncate">
                      {a.service.name}{a.provider && ` · ${a.provider.name}`}
                    </div>
                  </div>
                  <span className={chipClass(apptStatusChip[a.status])}>{apptStatusLabel[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent calls" href="/calls" cta="View all">
          {recentCalls.length === 0 ? (
            <Empty
              title="No calls yet"
              sub="Open the simulator to have a test conversation with your agent."
              actionLabel="Try the agent →"
              actionHref="/demo"
            />
          ) : (
            <ul className="divide-y divide-surface-border">
              {recentCalls.map(c => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="w-20 flex-none text-xs text-ink-muted">
                    {formatDistanceToNowStrict(c.startedAt, { addSuffix: true })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/calls/${c.id}`} className="text-sm font-medium hover:underline">
                      {c.customer
                        ? `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || c.fromNumber
                        : c.fromNumber}
                    </Link>
                    {c.summary && <div className="text-xs text-ink-muted truncate">{c.summary}</div>}
                  </div>
                  <span className={chipClass(callOutcomeChip[c.outcome])}>{callOutcomeLabel[c.outcome]}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Helpful footer ------------------------------------------------ */}
      <div className="text-xs text-ink-muted text-center pt-4">
        {customerCount.toLocaleString()} customers on file.
      </div>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: "cool" | "warm" | "hot" }) {
  return (
    <div className={"kpi " + (accent ? `kpi-${accent}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Panel({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-xs text-lane hover:underline">{cta}</Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ title, sub, actionLabel, actionHref }: { title: string; sub: string; actionLabel: string; actionHref: string }) {
  return (
    <div className="py-6 text-center space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
      <Link href={actionHref} className="inline-block text-sm text-lane hover:underline">{actionLabel}</Link>
    </div>
  );
}
