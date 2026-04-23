import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { SendComposer } from "@/components/SendComposer";
import { AppointmentBooker } from "@/components/AppointmentBooker";
import { addDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: { leadId: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      customer: { include: { vehiclesOwned: { take: 3 } } },
      assignedRep: true,
      interestVehicle: true,
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
      rooftop: true,
      appointments: { orderBy: { scheduledAt: "desc" }, take: 3 },
    },
  });
  if (!lead) return <div className="p-4">Lead not found.</div>;

  const rec = await prisma.recommendation.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const slots = [
    addDays(now, 1).setHours(11, 0, 0, 0),
    addDays(now, 1).setHours(17, 0, 0, 0),
    addDays(now, 2).setHours(10, 0, 0, 0),
  ].map((ms) => new Date(ms).toISOString());

  const disabledReason =
    rec?.draftChannel === "sms" && !lead.customer.smsConsent
      ? "No SMS consent on file — confirm opt-in before sending."
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-ink-muted">{lead.rooftop.name} · {lead.source} · {formatDistanceToNowStrict(lead.createdAt, { addSuffix: true })}</div>
              <h1 className="text-lg font-semibold mt-1">
                {lead.customer.firstName ?? ""} {lead.customer.lastName ?? ""}
                {!lead.customer.firstName && !lead.customer.lastName && <span>Unknown caller</span>}
              </h1>
              <div className="text-sm text-ink-muted">
                {lead.customer.phone ?? "—"} · {lead.customer.email ?? "—"} · {lead.customer.smsConsent ? "SMS opt-in" : "no SMS consent"}
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="chip-muted">{lead.status}</span>
              {lead.score > 0.6 && <span className="chip-hot">hot</span>}
              {lead.expectedGross > 0 && (
                <span className="text-xs text-ink-muted">est ${lead.expectedGross.toLocaleString()} gross</span>
              )}
            </div>
          </div>
        </div>

        {lead.interestVehicle && (
          <div className="card p-4">
            <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Vehicle of interest</div>
            <div className="text-sm">
              {lead.interestVehicle.year} {lead.interestVehicle.make} {lead.interestVehicle.model} {lead.interestVehicle.trim ?? ""}
              {" · "}
              <span className="text-ink-muted">stock #{lead.interestVehicle.stockNumber}</span>
              {" · "}
              <span>${lead.interestVehicle.price.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="card p-4 space-y-3">
          <div className="text-xs text-ink-muted uppercase tracking-wide">Thread</div>
          {lead.messages.length === 0 && (
            <div className="text-sm text-ink-muted">No messages yet.</div>
          )}
          {lead.messages.map((m) => (
            <div key={m.id} className={"p-3 rounded-md " + (m.direction === "outbound" ? "bg-ink/5" : "bg-lane/10")}>
              <div className="text-xs text-ink-muted mb-1">
                {m.channel} · {m.direction} · {formatDistanceToNowStrict(m.createdAt, { addSuffix: true })}
              </div>
              <div className="text-sm whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {rec && (
          <SendComposer
            recommendationId={rec.id}
            userId={lead.assignedRepId ?? ""}
            initialBody={rec.draftBody ?? ""}
            channel={rec.draftChannel}
            disabledReason={disabledReason}
          />
        )}
        {lead.assignedRepId && <AppointmentBooker leadId={lead.id} userId={lead.assignedRepId} suggestedSlots={slots} />}
        <div className="card p-4 text-sm">
          <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">Prior</div>
          <div className="text-ink-muted">
            {lead.customer.vehiclesOwned.length > 0
              ? lead.customer.vehiclesOwned
                  .map((v) => `${v.year} ${v.make} ${v.model}`)
                  .join(", ")
              : "No prior vehicles on file."}
          </div>
        </div>
        <Link href={`/rep/${lead.assignedRepId ?? ""}`} className="btn-secondary w-full">
          ← Back to feed
        </Link>
      </div>
    </div>
  );
}
