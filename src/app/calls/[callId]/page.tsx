import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { format } from "date-fns";
import { callOutcomeLabel, callOutcomeChip, chipClass, turnRoleLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CallDetail({ params }: { params: { callId: string } }) {
  const user = await requireUser();
  const session = await prisma.callSession.findFirst({
    where: { id: params.callId, businessId: user.businessId },
    include: {
      turns: { orderBy: { startedAt: "asc" } },
      toolCalls: { orderBy: { createdAt: "asc" } },
      customer: true,
    },
  });
  if (!session) return <div>Call not found.</div>;

  const headlineName =
    session.customer
      ? `${session.customer.firstName ?? ""} ${session.customer.lastName ?? ""}`.trim() || session.fromNumber
      : session.fromNumber;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/calls" className="text-xs text-ink-muted hover:underline">← All calls</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="page-title">{headlineName}</h1>
                <p className="page-sub">
                  {format(session.startedAt, "PPpp")} ·{" "}
                  {session.direction === "inbound" ? "Incoming call" : "Outbound call"} ·{" "}
                  {session.durationSec ? `${session.durationSec}s` : "—"}
                  {session.cost != null && ` · $${session.cost.toFixed(2)}`}
                </p>
              </div>
              <span className={chipClass(callOutcomeChip[session.outcome])}>{callOutcomeLabel[session.outcome]}</span>
            </div>
            {session.summary && (
              <div className="mt-4 rounded-lg bg-surface-sub border border-surface-border p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Summary</div>
                <p className="text-sm">{session.summary}</p>
              </div>
            )}
            {session.recordingUrl && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">Recording</div>
                <audio controls src={session.recordingUrl} className="w-full" />
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="section-title">Transcript</h2>
            {session.turns.length === 0 ? (
              <p className="text-sm text-ink-muted">(empty — this call had no recorded turns)</p>
            ) : (
              session.turns.map(t => (
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
            <h2 className="section-title mb-3">Tools the agent used</h2>
            {session.toolCalls.length === 0 ? (
              <p className="text-sm text-ink-muted">
                The agent didn't need any tools for this call.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {session.toolCalls.map(tc => (
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
  if (role === "tool") return "bubble-tool";
  return "bubble-tool";
}
