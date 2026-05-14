import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  chipClass,
  prospectStatusChip,
  prospectStatusLabel,
  dispositionLabel,
  dispositionChip,
  verticalLabel,
} from "@/lib/labels";
import { ProspectActions } from "./ProspectActions";

export const dynamic = "force-dynamic";

export default async function ProspectDetail({ params }: { params: { id: string } }) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: params.id },
    include: {
      calls: { orderBy: { startedAt: "desc" }, include: { campaign: true } },
      targets: { include: { campaign: true } },
    },
  });
  if (!prospect) return <div>Prospect not found.</div>;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/outreach/prospects" className="text-xs text-ink-muted hover:underline">← All prospects</Link>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">{prospect.businessName}</h1>
          <p className="page-sub">
            {verticalLabel[prospect.vertical] ?? prospect.vertical}
            {prospect.city || prospect.region ? ` · ${[prospect.city, prospect.region].filter(Boolean).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={chipClass(prospectStatusChip[prospect.status])}>{prospectStatusLabel[prospect.status]}</span>
          <ProspectActions prospectId={prospect.id} doNotCall={prospect.doNotCall} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="section-title">Contact & sourcing</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Phone" value={prospect.phone ?? "—"} />
              <Field label="Website" value={prospect.website ?? "—"} />
              <Field label="Address" value={prospect.address ?? "—"} />
              <Field label="Timezone" value={prospect.timezone} />
              <Field label="Google rating" value={prospect.rating != null ? `${prospect.rating} (${prospect.reviewsCount ?? 0} reviews)` : "—"} />
              <Field label="Source" value={prospect.source} />
              <Field label="Fit score" value={prospect.score != null ? String(prospect.score) : "not scored"} />
              <Field label="Call attempts" value={String(prospect.attempts)} />
            </dl>
            {prospect.qualificationNote && (
              <div className="rounded-lg bg-surface-sub border border-surface-border p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Qualification notes</div>
                <p className="text-sm whitespace-pre-wrap">{prospect.qualificationNote}</p>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="section-title">Call history</h2>
            {prospect.calls.length === 0 ? (
              <p className="text-sm text-ink-muted">No calls placed yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {prospect.calls.map(c => (
                  <li key={c.id} className="flex items-center justify-between gap-2 border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                    <Link href={`/outreach/calls/${c.id}`} className="text-lane hover:underline">
                      {format(c.startedAt, "MMM d, yyyy · h:mm a")}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      {c.campaign?.name ?? "—"}
                      {c.disposition && (
                        <span className={chipClass(dispositionChip[c.disposition])}>{dispositionLabel[c.disposition]}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {prospect.disposition && (
            <div className="card p-5">
              <h2 className="section-title mb-2">Latest disposition</h2>
              <span className={chipClass(dispositionChip[prospect.disposition])}>{dispositionLabel[prospect.disposition]}</span>
            </div>
          )}
          {prospect.demoAt && (
            <div className="card p-5">
              <h2 className="section-title mb-2">Demo booked</h2>
              <p className="text-sm font-medium">{format(prospect.demoAt, "PPpp")}</p>
              {prospect.demoContactName && <p className="text-sm text-ink-muted">{prospect.demoContactName}</p>}
              {prospect.demoContactEmail && <p className="text-sm text-ink-muted">{prospect.demoContactEmail}</p>}
            </div>
          )}
          <div className="card p-5">
            <h2 className="section-title mb-2">Campaigns</h2>
            {prospect.targets.length === 0 ? (
              <p className="text-sm text-ink-muted">Not in any campaign.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {prospect.targets.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Link href={`/outreach/campaigns/${t.campaignId}`} className="text-lane hover:underline truncate">
                      {t.campaign.name}
                    </Link>
                    <span className="text-xs text-ink-muted">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted uppercase tracking-wider">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
