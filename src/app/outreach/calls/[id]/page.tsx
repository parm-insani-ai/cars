import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format, formatDistanceStrict } from "date-fns";
import { chipClass, dispositionChip, dispositionLabel, prospectStatusChip, prospectStatusLabel, turnRoleLabel } from "@/lib/labels";
import { categoryLabel, groupLabel } from "@/outreach/categories";
import { CallRecordingPlayer, TurnSeekButton, ProspectActionsInline } from "./CallDetailClient";

export const dynamic = "force-dynamic";

export default async function OutreachCallDetail({ params }: { params: { id: string } }) {
  const call = await prisma.outreachCall.findUnique({
    where: { id: params.id },
    include: {
      turns: { orderBy: { startedAt: "asc" } },
      toolCalls: { orderBy: { createdAt: "asc" } },
      prospect: true,
      campaign: true,
      target: true,
    },
  });
  if (!call) return <div>Call not found.</div>;

  // Every other call to this same prospect — chronological, newest first.
  const relatedCalls = await prisma.outreachCall.findMany({
    where: { prospectId: call.prospectId, id: { not: call.id } },
    orderBy: { startedAt: "desc" },
    take: 15,
    select: {
      id: true,
      startedAt: true,
      durationSec: true,
      status: true,
      disposition: true,
      campaign: { select: { name: true } },
    },
  });

  // Detected signals — colored chips summarizing the call at a glance. Kept
  // as a derived view over the fields we already store; a schema-level
  // "signals" column would be nicer but this ships today.
  const signals = deriveSignals(call);

  // What Vapi told us happened (ended reason isn't stored yet — we surface
  // "how it wrapped up" from the fields we do have). Once we start capturing
  // Vapi's `endedReason` this becomes verbatim; until then, best-effort.
  const wrapUp =
    call.disposition === "voicemail" ? "Went to voicemail" :
    call.disposition === "no_answer" ? "No answer" :
    call.status === "completed"      ? "Call completed" :
    call.status === "failed"         ? "Call failed" :
                                       "In progress";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/outreach/calls" className="text-xs text-ink-muted hover:underline">← All calls</Link>
        <span className="text-ink-muted/40">/</span>
        <Link href={`/outreach/prospects/${call.prospectId}`} className="text-xs text-ink-muted hover:underline">
          {call.prospect.businessName}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* HEADER: business + time + duration + disposition + signals */}
          <div className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="page-title">{call.prospect.businessName}</h1>
                <p className="page-sub">
                  {format(call.startedAt, "PPpp")} · {wrapUp}
                  {call.durationSec ? ` · ${call.durationSec}s` : ""}
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

            {/* Signals — chips summarizing important things about this call. */}
            {signals.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {signals.map(s => (
                  <span key={s.label} className={chipClass(s.tone)}>{s.label}</span>
                ))}
              </div>
            )}

            {/* Call metadata: numbers, attempt count, next retry. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Meta label="From" value={call.fromNumber} />
              <Meta label="To"   value={call.toNumber} />
              <Meta
                label="Attempt"
                value={
                  call.target && call.campaign
                    ? `${call.target.attempts} of ${call.campaign.maxAttempts}`
                    : "—"
                }
              />
              <Meta
                label="Next retry"
                value={
                  call.target?.nextAttemptAt
                    ? formatDistanceStrict(call.target.nextAttemptAt, new Date(), { addSuffix: true })
                    : "—"
                }
              />
            </div>

            {call.summary && (
              <div className="rounded-lg bg-surface-sub border border-surface-border p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Summary</div>
                <p className="text-sm">{call.summary}</p>
              </div>
            )}
            {call.demoAt && (
              <div className="rounded-lg bg-lane-cool/10 ring-1 ring-inset ring-lane-cool/20 p-3">
                <div className="text-xs uppercase tracking-wider text-lane-cool font-semibold mb-1">Demo booked</div>
                <p className="text-sm">
                  {format(call.demoAt, "PPpp")}
                  {call.demoContactName && ` · ${call.demoContactName}`}
                  {call.demoContactEmail && ` · ${call.demoContactEmail}`}
                </p>
              </div>
            )}
            {call.recordingUrl && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Recording</div>
                <CallRecordingPlayer src={call.recordingUrl} />
                {call.recordingUrl && (
                  <div className="text-[10px] text-ink-muted mt-1">Click any transcript timestamp to jump.</div>
                )}
              </div>
            )}
          </div>

          {/* TRANSCRIPT — each turn's timestamp is clickable to seek the audio. */}
          <div className="card p-5 space-y-3">
            <h2 className="section-title">Transcript</h2>
            {call.turns.length === 0 ? (
              <p className="text-sm text-ink-muted">(empty — this call had no recorded turns)</p>
            ) : (
              call.turns.map(t => {
                const offsetSec = Math.max(0, Math.floor((t.startedAt.getTime() - call.startedAt.getTime()) / 1000));
                return (
                  <div key={t.id} className={bubbleFor(t.role)}>
                    <div className="text-[10px] uppercase tracking-wider mb-1 opacity-60">
                      {turnRoleLabel[t.role] ?? t.role} ·{" "}
                      {call.recordingUrl ? (
                        <TurnSeekButton seconds={offsetSec}>
                          {formatOffset(offsetSec)}
                        </TurnSeekButton>
                      ) : (
                        <span>{format(t.startedAt, "h:mm:ss a")}</span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{t.text}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SIDEBAR: prospect card, actions, related calls, tools */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Prospect</h2>
              <span className={chipClass(prospectStatusChip[call.prospect.status])}>
                {prospectStatusLabel[call.prospect.status]}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <ProspectField label="Type">
                {categoryLabel(call.prospect.category)}
                <span className="text-ink-muted/60"> · {groupLabel(call.prospect.categoryGroup)}</span>
              </ProspectField>
              {call.prospect.phone && (
                <ProspectField label="Phone">
                  <a href={`tel:${call.prospect.phone}`} className="text-lane hover:underline">
                    {call.prospect.phone}
                  </a>
                </ProspectField>
              )}
              {call.prospect.website && (
                <ProspectField label="Website">
                  <a href={ensureHttp(call.prospect.website)} target="_blank" rel="noopener noreferrer" className="text-lane hover:underline break-all">
                    {stripProtocol(call.prospect.website)}
                  </a>
                </ProspectField>
              )}
              {call.prospect.address && (
                <ProspectField label="Address">
                  {call.prospect.address}
                  {call.prospect.city && `, ${call.prospect.city}`}
                </ProspectField>
              )}
              {call.prospect.rating != null && (
                <ProspectField label="Rating">
                  {call.prospect.rating.toFixed(1)}
                  {call.prospect.reviewsCount != null && (
                    <span className="text-ink-muted"> · {call.prospect.reviewsCount} reviews</span>
                  )}
                </ProspectField>
              )}
              {call.prospect.score != null && (
                <ProspectField label="Fit score">{call.prospect.score}/100</ProspectField>
              )}
            </div>

            <div className="pt-2 border-t border-surface-border flex items-center gap-2 flex-wrap">
              <Link
                href={`/outreach/prospects/${call.prospect.id}`}
                className="btn-secondary text-xs"
              >
                Full profile
              </Link>
              <ProspectActionsInline prospectId={call.prospect.id} doNotCall={call.prospect.doNotCall} />
            </div>
          </div>

          {relatedCalls.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title mb-3">Other calls to this business</h2>
              <ul className="space-y-2 text-xs">
                {relatedCalls.map(rc => (
                  <li key={rc.id} className="flex items-center justify-between gap-2 border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                    <Link href={`/outreach/calls/${rc.id}`} className="hover:underline min-w-0 truncate">
                      {format(rc.startedAt, "MMM d, h:mm a")}
                      {rc.durationSec ? ` · ${rc.durationSec}s` : ""}
                    </Link>
                    {rc.disposition ? (
                      <span className={chipClass(dispositionChip[rc.disposition])}>{dispositionLabel[rc.disposition]}</span>
                    ) : (
                      <span className="chip-warm text-[10px]">{rc.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ProspectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold w-16 shrink-0">{label}</div>
      <div className="text-sm min-w-0 flex-1">{children}</div>
    </div>
  );
}

function bubbleFor(role: string) {
  if (role === "agent") return "bubble-agent";
  if (role === "customer") return "bubble-customer";
  return "bubble-tool";
}

// Format a second offset as m:ss (e.g. 65 → "1:05").
function formatOffset(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function ensureHttp(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

// Derive a small set of colored chips summarizing what happened on this call.
type Chip = "muted" | "cool" | "warm" | "hot";
type Signal = { label: string; tone: Chip };
function deriveSignals(call: {
  disposition: string | null;
  demoAt: Date | null;
  status: string;
  turns: { role: string }[];
}): Signal[] {
  const out: Signal[] = [];
  if (call.demoAt) out.push({ label: "Demo booked", tone: "cool" });
  if (call.disposition === "not_interested") out.push({ label: "Not interested", tone: "warm" });
  if (call.disposition === "callback_requested") out.push({ label: "Callback requested", tone: "warm" });
  if (call.disposition === "voicemail") out.push({ label: "Voicemail", tone: "muted" });
  if (call.disposition === "no_answer") out.push({ label: "No answer", tone: "muted" });
  if (call.disposition === "do_not_call") out.push({ label: "Opted out", tone: "hot" });
  const customerTurns = call.turns.filter(t => t.role === "customer").length;
  if (customerTurns >= 3 && !call.demoAt && call.disposition !== "not_interested") {
    out.push({ label: "Engaged", tone: "cool" });
  }
  if (call.status === "failed") out.push({ label: "Call failed", tone: "hot" });
  return out;
}
