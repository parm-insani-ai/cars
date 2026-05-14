import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { chipClass, dispositionChip, dispositionLabel, turnRoleLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function OutreachCallDetail({ params }: { params: { id: string } }) {
  const call = await prisma.outreachCall.findUnique({
    where: { id: params.id },
    include: {
      turns: { orderBy: { startedAt: "asc" } },
      toolCalls: { orderBy: { createdAt: "asc" } },
      prospect: true,
      campaign: true,
    },
  });
  if (!call) return <div>Call not found.</div>;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/outreach/prospects/${call.prospectId}`} className="text-xs text-ink-muted hover:underline">
          ← {call.prospect.businessName}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="page-title">{call.prospect.businessName}</h1>
                <p className="page-sub">
                  {format(call.startedAt, "PPpp")} · Outbound sales call ·{" "}
                  {call.durationSec ? `${call.durationSec}s` : "—"}
                  {call.cost != null && ` · $${call.cost.toFixed(2)}`}
                  {call.campaign && ` · ${call.campaign.name}`}
                </p>
              </div>
              {call.disposition ? (
                <span className={chipClass(dispositionChip[call.disposition])}>{dispositionLabel[call.disposition]}</span>
              ) : (
                <span className="chip-warm">{call.status}</span>
              )}
            </div>
            {call.summary && (
              <div className="mt-4 rounded-lg bg-surface-sub border border-surface-border p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Summary</div>
                <p className="text-sm">{call.summary}</p>
              </div>
            )}
            {call.demoAt && (
              <div className="mt-4 rounded-lg bg-lane-cool/10 ring-1 ring-inset ring-lane-cool/20 p-3">
                <div className="text-xs uppercase tracking-wider text-lane-cool font-semibold mb-1">Demo booked</div>
                <p className="text-sm">
                  {format(call.demoAt, "PPpp")}
                  {call.demoContactName && ` · ${call.demoContactName}`}
                  {call.demoContactEmail && ` · ${call.demoContactEmail}`}
                </p>
              </div>
            )}
            {call.recordingUrl && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Recording</div>
                <audio controls src={call.recordingUrl} className="w-full" />
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="section-title">Transcript</h2>
            {call.turns.length === 0 ? (
              <p className="text-sm text-ink-muted">(empty — this call had no recorded turns)</p>
            ) : (
              call.turns.map(t => (
                <div key={t.id} className={bubbleFor(t.role)}>
                  <div className="text-[10px] uppercase tracking-wider mb-1 opacity-60">
                    {turnRoleLabel[t.role] ?? t.role} · {format(t.startedAt, "h:mm:ss a")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{t.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title mb-3">Tools the rep used</h2>
            {call.toolCalls.length === 0 ? (
              <p className="text-sm text-ink-muted">The rep didn't record any actions on this call.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {call.toolCalls.map(tc => (
                  <li key={tc.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                    <div className="font-mono font-medium">{tc.toolName}</div>
                    <div className="text-ink-muted">
                      {tc.latencyMs}ms
                      {tc.isError && <span className="text-lane-hot ml-1">· error</span>}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-ink-muted">show input / result</summary>
                      <pre className="bg-surface-sub p-2 rounded-md mt-1 overflow-x-auto">{JSON.stringify(tc.input, null, 2)}</pre>
                      <pre className="bg-surface-sub p-2 rounded-md mt-1 overflow-x-auto">{JSON.stringify(tc.output, null, 2)}</pre>
                    </details>
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

function bubbleFor(role: string) {
  if (role === "agent") return "bubble-agent";
  if (role === "customer") return "bubble-customer";
  return "bubble-tool";
}
