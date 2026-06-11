import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import Link from "next/link";
import { ApptStatusButtons } from "./ApptStatusButtons";
import { apptStatusLabel, apptStatusChip, chipClass } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Appt = Awaited<ReturnType<typeof loadAppts>>[number];

async function loadAppts(businessId: string, start: Date, end: Date) {
  return prisma.appointment.findMany({
    where: { businessId, scheduledAt: { gte: start, lte: end } },
    include: { customer: true, service: true, provider: true },
    orderBy: { scheduledAt: "asc" },
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams?: { range?: string; view?: string };
}) {
  const user = await requireUser();
  const view = searchParams?.view === "week" ? "week" : "list";
  const range = view === "week" ? "week" : searchParams?.range === "week" ? "week" : "today";
  const start = startOfDay(new Date());
  const end = view === "week" || range === "week" ? endOfDay(addDays(start, 6)) : endOfDay(start);

  const appts = await loadAppts(user.businessId, start, end);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-sub">
            Everything your AI agent has booked. Confirm, check people in, or mark them complete here.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={view === "week" ? "/appointments?range=today" : "/appointments"}
            className={view === "list" && range === "today" ? "btn-primary" : "btn-secondary"}
          >
            Today
          </Link>
          <Link
            href="/appointments?range=week"
            className={view === "list" && range === "week" ? "btn-primary" : "btn-secondary"}
          >
            Next 7 days
          </Link>
          <Link
            href="/appointments?view=week"
            className={view === "week" ? "btn-primary" : "btn-secondary"}
          >
            Week view
          </Link>
        </div>
      </div>

      {view === "week" ? (
        <WeekView appts={appts} start={start} />
      ) : (
        <ListView appts={appts} range={range as "today" | "week"} />
      )}
    </div>
  );
}

function ListView({ appts, range }: { appts: Appt[]; range: "today" | "week" }) {
  if (appts.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
        <div className="empty-title">{range === "today" ? "Nothing booked today" : "Nothing booked this week"}</div>
        <div className="empty-sub">When a caller books, you'll see it here. Want to test it now?</div>
        <Link href="/demo" className="btn-primary">Try the agent</Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {appts.map(a => (
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
      ))}
    </div>
  );
}

function WeekView({ appts, start }: { appts: Appt[]; start: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDay = days.map(day => {
    const key = day.toDateString();
    return {
      day,
      items: appts.filter(a => a.scheduledAt.toDateString() === key),
    };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
      {byDay.map(({ day, items }) => {
        const isToday = day.toDateString() === new Date().toDateString();
        return (
          <div
            key={day.toISOString()}
            className={
              "card p-3 min-h-[260px] " +
              (isToday ? "border-2 border-lane-cool" : "")
            }
          >
            <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-surface-border">
              <div>
                <div className={"font-semibold " + (isToday ? "text-lane-cool" : "")}>
                  {format(day, "EEE")}
                </div>
                <div className="text-xs text-ink-muted">{format(day, "MMM d")}</div>
              </div>
              <div className="text-xs text-ink-muted">{items.length} booked</div>
            </div>
            {items.length === 0 ? (
              <div className="text-xs text-ink-muted text-center py-6">Nothing booked</div>
            ) : (
              <ul className="space-y-1.5">
                {items.map(a => (
                  <li key={a.id} className="text-xs p-2 rounded-md bg-surface-sub">
                    <div className="font-semibold">{format(a.scheduledAt, "h:mm a")}</div>
                    <div className="truncate">
                      {a.customer
                        ? `${a.customer.firstName ?? ""} ${a.customer.lastName ?? ""}`.trim() || "(no name)"
                        : "(unlinked)"}
                    </div>
                    <div className="text-ink-muted truncate">
                      {a.service.name}
                      {a.provider && ` · ${a.provider.name}`}
                    </div>
                    <span className={chipClass(apptStatusChip[a.status]) + " text-[10px] mt-1 inline-block"}>
                      {apptStatusLabel[a.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
