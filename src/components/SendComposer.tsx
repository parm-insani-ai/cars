"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SendComposer({
  recommendationId,
  userId,
  initialBody,
  channel,
  disabledReason,
}: {
  recommendationId: string;
  userId: string;
  initialBody: string;
  channel: "sms" | "email" | "note" | null;
  disabledReason?: string | null;
}) {
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function approve() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/actions/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId, userId, overrideBody: body }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(j.error?.toString() ?? "Failed to send");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-muted uppercase tracking-wide">
          AI draft · {channel ?? "note"}
        </div>
        {channel === "sms" && (
          <div className="text-xs text-ink-muted">{body.length} chars</div>
        )}
      </div>
      <textarea
        className="w-full border border-surface-border rounded-md p-3 text-sm font-mono min-h-[120px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={Boolean(disabledReason)}
      />
      {disabledReason && <div className="text-xs text-lane-hot">{disabledReason}</div>}
      {err && <div className="text-xs text-lane-hot">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" disabled={busy}>
          Edit &amp; save
        </button>
        <button
          className="btn-primary"
          onClick={approve}
          disabled={busy || Boolean(disabledReason)}
        >
          {busy ? "Sending…" : "Approve &amp; send"}
        </button>
      </div>
    </div>
  );
}
