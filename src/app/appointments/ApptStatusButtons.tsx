"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT_OPTIONS: Record<string, Array<{ label: string; status: string }>> = {
  set: [
    { label: "Confirm", status: "confirmed" },
    { label: "Cancel", status: "canceled" },
  ],
  confirmed: [
    { label: "Mark shown", status: "shown" },
    { label: "No-show", status: "no_show" },
  ],
  shown: [{ label: "Mark sold", status: "sold" }],
  no_show: [],
  canceled: [],
  sold: [],
};

export function ApptStatusButtons({ apptId, status }: { apptId: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const opts = NEXT_OPTIONS[status] ?? [];

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
      {opts.map((o) => (
        <button
          key={o.status}
          className="btn-secondary"
          disabled={busy}
          onClick={() => update(o.status)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
