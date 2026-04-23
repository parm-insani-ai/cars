"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AppointmentBooker({
  leadId,
  userId,
  suggestedSlots,
}: {
  leadId: string;
  userId: string;
  suggestedSlots: string[];
}) {
  const [slot, setSlot] = useState(suggestedSlots[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function book() {
    if (!slot) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/actions/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, userId, scheduledAt: slot }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(j.error?.toString() ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="text-xs text-ink-muted uppercase tracking-wide">Book appointment</div>
      <div className="flex flex-wrap gap-2">
        {suggestedSlots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            className={
              "h-9 px-3 rounded-md text-sm border " +
              (slot === s ? "bg-ink text-white border-ink" : "bg-white border-surface-border")
            }
          >
            {new Date(s).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </button>
        ))}
      </div>
      {err && <div className="text-xs text-lane-hot">{err}</div>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={book} disabled={busy || !slot}>
          {busy ? "Booking…" : "Book &amp; confirm"}
        </button>
      </div>
    </div>
  );
}
