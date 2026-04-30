"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReassignButton({
  taskId,
  reps,
  currentUserId,
}: {
  taskId: string;
  reps: Array<{ id: string; name: string }>;
  currentUserId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reassign(toUserId: string) {
    setBusy(true);
    await fetch("/api/actions/reassign-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, toUserId }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button className="btn-secondary" onClick={() => setOpen((v) => !v)}>
        Reassign
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 card p-1 w-48">
          {reps.map((r) => (
            <button
              key={r.id}
              onClick={() => reassign(r.id)}
              disabled={busy || r.id === currentUserId}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-surface-sub disabled:opacity-50"
            >
              {r.name}
              {r.id === currentUserId && <span className="text-xs text-ink-muted"> (current)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
