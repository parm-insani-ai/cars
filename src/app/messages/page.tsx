import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();
  const threads = await prisma.smsThread.findMany({
    where: { businessId: user.businessId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Text messages</h1>
        <p className="page-sub">
          Two-way conversations the agent has with customers over SMS. Same brain as voice — just on text.
        </p>
      </div>

      <div className="card overflow-hidden">
        {threads.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div className="empty-title">No messages yet</div>
            <div className="empty-sub">When someone texts your number, the agent will reply and the conversation will land here.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>From</th>
                <th>Last message</th>
                <th className="text-right">Messages</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {threads.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">
                    <Link href={`/messages/${t.id}`} className="text-lane hover:underline">
                      {t.phoneNumber}
                    </Link>
                  </td>
                  <td className="text-xs text-ink-muted max-w-md truncate">{t.messages[0]?.body ?? "—"}</td>
                  <td className="text-right tabular-nums">{t._count.messages}</td>
                  <td><span className={t.status === "open" ? "chip-cool" : "chip-muted"}>{t.status}</span></td>
                  <td className="text-xs text-ink-muted">{formatDistanceToNowStrict(t.updatedAt, { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
