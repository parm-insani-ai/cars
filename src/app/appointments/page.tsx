import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import Link from "next/link";
import { ApptStatusButtons } from "./ApptStatusButtons";
import { apptStatusLabel, apptStatusChip, chipClass } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams?: { range?: string } }) {
  const user = await requireUser();
  const range = searchParams?.range === "week" ? "week" : "today";
  const start = startOfDay(new Date());
  const end = range === "week" ? endOfDay(addDays(start, 7)) : endOfDay(start);

  const appts = await prisma.appointment.findMany({
    where: { businessId: user.businessId, scheduledAt: { gte: start, lte: end } },
    include: { customer: true, service: true, provider: true },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-sub">Everything your AI agent has booked. You can confirm, check people in, or mark them complete here.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/appointments?range=today" className={range === "today" ? "btn-primary" : "btn-secondary"}>Today</Link>
          <Link href="/appointments?range=week" className={range === "week" ? "btn-primary" : "btn-secondary"}>Next 7 days</Link>
        </div>
      </div>

      <div className="space-y-2">
        {appts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div className="empty-title">{range === "today" ? "Nothing booked today" : "Nothing booked this week"}</div>
            <div className="empty-sub">When a caller books, you'll see it here. Want to test it now?</div>
            <Link href="/demo" className="btn-primary">Try the agent</Link>
          </div>
        ) : (
          appts.map(a => (
            <div key={a.id} className="card p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-none w-32">
                <div className="font-medium">{format(a.scheduledAt, "h:mm a")}</div>
                <div className="text-xs text-ink-muted">{format(a.scheduledAt, "EEE MMM d")}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {a.customer
                    ? `${a.customer.firstName ?? ""} ${a.customer.lastName ?? ""}`.trim() || "(no name)"
                    : "(unlinked)"}
                </div>
                <div className="text-xs text-ink-muted">
                  {a.service.name} · {a.durationMin} min
                  {a.provider && ` · with ${a.provider.name}`}
                </div>
              </div>
              <span className={chipClass(apptStatusChip[a.status])}>{apptStatusLabel[a.status]}</span>
              <ApptStatusButtons apptId={a.id} status={a.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
