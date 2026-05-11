import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { format } from "date-fns";

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">
                {session.customer
                  ? `${session.customer.firstName ?? ""} ${session.customer.lastName ?? ""}`.trim() || session.fromNumber
                  : session.fromNumber}
              </h1>
              <p className="text-xs text-ink-muted">
                {format(session.startedAt, "PPpp")} · {session.direction} · {session.durationSec ? `${session.durationSec}s` : "—"}
                {session.cost != null && ` · $${session.cost.toFixed(2)}`}
              </p>
            </div>
            <span className={chipFor(session.outcome)}>{session.outcome.replace("_", " ")}</span>
          </div>
          {session.summary && (
            <p className="mt-3 text-sm bg-surface-sub p-3 rounded-md">{session.summary}</p>
          )}
          {session.recordingUrl && (
            <audio controls src={session.recordingUrl} className="mt-3 w-full" />
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold">Transcript</h2>
          {session.turns.length === 0 ? (
            <p className="text-sm text-ink-muted">(empty)</p>
          ) : (
            session.turns.map(t => (
              <div key={t.id} className={"p-3 rounded-md text-sm " + bubbleFor(t.role)}>
                <div className="text-[10px] uppercase tracking-wider mb-1 opacity-60">
                  {t.role} · {format(t.startedAt, "h:mm:ss a")}
                </div>
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-3">Tool calls</h2>
          {session.toolCalls.length === 0 ? (
            <p className="text-sm text-ink-muted">No tool calls.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {session.toolCalls.map(tc => (
                <li key={tc.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                  <div className="font-mono font-medium">{tc.toolName}</div>
                  <div className="text-ink-muted">{tc.latencyMs}ms{tc.isError && <span className="text-lane-hot ml-1">error</span>}</div>
                  <details className="mt-1">
                    <summary className="cursor-pointer">args / result</summary>
                    <pre className="bg-surface-sub p-2 rounded-md mt-1 overflow-x-auto">{JSON.stringify(tc.input, null, 2)}</pre>
                    <pre className="bg-surface-sub p-2 rounded-md mt-1 overflow-x-auto">{JSON.stringify(tc.output, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/calls" className="btn-secondary w-full">← All calls</Link>
      </div>
    </div>
  );
}

function bubbleFor(role: string) {
  if (role === "agent") return "bg-ink/5";
  if (role === "customer") return "bg-lane/10";
  if (role === "tool") return "bg-surface-sub font-mono text-xs";
  return "bg-surface-sub";
}
function chipFor(o: string) {
  if (o === "booked" || o === "rescheduled" || o === "message_taken") return "chip-cool";
  if (o === "transferred" || o === "voicemail" || o === "in_progress") return "chip-warm";
  if (o === "canceled" || o === "hung_up" || o === "no_action") return "chip-hot";
  return "chip-muted";
}
