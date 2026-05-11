import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import Link from "next/link";
import { ApptStatusButtons } from "./ApptStatusButtons";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams?: { range?: string } }) {
  const user = await requireUser();
  const range = searchParams?.range === "week" ? "week" : "today";
  const start = startOfDay(new Date());
  const end = range === "week" ? endOfDay(addDays(start, 7)) : endOfDay(start);

  const appts = await prisma.appointment.findMany({
    where: { businessId: user.businessId, scheduledAt: { gte: start, lte: end } },
    include: { customer: true, service: true, provider: true, callSession: true } as any,
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Appointments</h1>
          <p className="text-xs text-ink-muted">{appts.length} {range === "week" ? "this week" : "today"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/appointments?range=today" className={range === "today" ? "btn-primary" : "btn-secondary"}>Today</Link>
          <Link href="/appointments?range=week" className={range === "week" ? "btn-primary" : "btn-secondary"}>Next 7 days</Link>
        </div>
      </div>

      <div className="space-y-2">
        {appts.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted">No appointments scheduled.</div>
        ) : (
          appts.map((a: any) => (
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
                  {a.service.name} ({a.durationMin}m){a.provider && ` · with ${a.provider.name}`}
                </div>
              </div>
              <span className={chipFor(a.status)}>{a.status.replace("_", " ")}</span>
              <ApptStatusButtons apptId={a.id} status={a.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
function chipFor(s: string) {
  if (s === "completed" || s === "arrived" || s === "confirmed") return "chip-cool";
  if (s === "no_show" || s === "canceled") return "chip-hot";
  if (s === "pending" || s === "reminded") return "chip-warm";
  return "chip-muted";
}
