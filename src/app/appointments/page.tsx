import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { ApptStatusButtons } from "./ApptStatusButtons";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const user = await requireUser();
  const range = searchParams?.range === "week" ? "week" : "today";

  const start = startOfDay(new Date());
  const end = range === "week" ? endOfDay(addDays(start, 7)) : endOfDay(start);

  const appts = await prisma.appointment.findMany({
    where: {
      rooftopId: user.rooftopId,
      scheduledAt: { gte: start, lte: end },
    },
    include: { rep: true, lead: { include: { customer: true, interestVehicle: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Appointments</h1>
          <div className="text-xs text-ink-muted">{appts.length} {range === "week" ? "this week" : "today"}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/appointments?range=today"
            className={range === "today" ? "btn-primary" : "btn-secondary"}
          >
            Today
          </Link>
          <Link
            href="/appointments?range=week"
            className={range === "week" ? "btn-primary" : "btn-secondary"}
          >
            Next 7 days
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        {appts.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted">No appointments scheduled.</div>
        ) : (
          appts.map((a) => (
            <div key={a.id} className="card p-4 flex items-center gap-4">
              <div className="flex-none w-32">
                <div className="font-medium">{format(a.scheduledAt, "h:mm a")}</div>
                <div className="text-xs text-ink-muted">{format(a.scheduledAt, "EEE MMM d")}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {a.lead?.customer
                    ? `${a.lead.customer.firstName ?? ""} ${a.lead.customer.lastName ?? ""}`.trim()
                    : "(unlinked)"}
                </div>
                <div className="text-xs text-ink-muted">
                  with {a.rep?.name ?? "—"}
                  {a.lead?.interestVehicle &&
                    ` · ${a.lead.interestVehicle.year} ${a.lead.interestVehicle.make} ${a.lead.interestVehicle.model}`}
                </div>
              </div>
              <div className="flex-none">
                <span className={statusChip(a.status)}>{a.status.replace("_", " ")}</span>
              </div>
              <ApptStatusButtons apptId={a.id} status={a.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function statusChip(status: string): string {
  if (status === "sold") return "chip-cool";
  if (status === "shown" || status === "confirmed") return "chip-cool";
  if (status === "no_show" || status === "canceled") return "chip-hot";
  return "chip-muted";
}
