"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT: Record<string, Array<{ label: string; status: string }>> = {
  pending: [{ label: "Confirm", status: "confirmed" }, { label: "Cancel", status: "canceled" }],
  confirmed: [{ label: "Mark arrived", status: "arrived" }, { label: "No-show", status: "no_show" }, { label: "Cancel", status: "canceled" }],
  reminded: [{ label: "Mark arrived", status: "arrived" }, { label: "No-show", status: "no_show" }],
  arrived: [{ label: "Mark completed", status: "completed" }],
  no_show: [],
  canceled: [],
  completed: [],
  rescheduled: [],
};

export function ApptStatusButtons({ apptId, status }: { apptId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const opts = NEXT[status] ?? [];

  async function update(newStatus: string) {
    setBusy(true);
    await fetch("/api/actions/appointment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apptId, status: newStatus }),
    });
    setBusy(false);
    router.refresh();
  }

  if (opts.length === 0) return null;
  return (
    <div className="flex gap-1">
      {opts.map(o => (
        <button key={o.status} className="btn-secondary" disabled={busy} onClick={() => update(o.status)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
