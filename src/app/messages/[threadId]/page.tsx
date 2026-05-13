import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ThreadDetail({ params }: { params: { threadId: string } }) {
  const user = await requireUser();
  const thread = await prisma.smsThread.findFirst({
    where: { id: params.threadId, businessId: user.businessId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      toolCalls: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return <div>Conversation not found.</div>;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/messages" className="text-xs text-ink-muted hover:underline">← All conversations</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h1 className="page-title">{thread.phoneNumber}</h1>
            <p className="page-sub">
              {thread.messages.length} messages · {thread.status === "open" ? "Open" : "Closed"} ·
              started {format(thread.createdAt, "PPp")}
            </p>
          </div>

          <div className="card p-5 space-y-2">
            <h2 className="section-title">Conversation</h2>
            {thread.messages.length === 0 ? (
              <p className="text-sm text-ink-muted">(empty)</p>
            ) : (
              thread.messages.map(m => (
                <div key={m.id} className={m.role === "agent" ? "bubble-agent" : "bubble-customer"}>
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                    {m.role === "agent" ? "Agent" : "Customer"} · {format(m.createdAt, "MMM d, h:mm a")}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title mb-3">Tool usage</h2>
            {thread.toolCalls.length === 0 ? (
              <p className="text-sm text-ink-muted">The agent didn't need any tools.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {thread.toolCalls.map(tc => (
                  <li key={tc.id} className="border-t border-surface-border pt-2 first:border-t-0 first:pt-0">
                    <div className="font-mono font-medium">{tc.toolName}</div>
                    <div className="text-ink-muted">
                      {tc.latencyMs}ms{tc.isError && <span className="text-lane-hot ml-1">· error</span>}
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
