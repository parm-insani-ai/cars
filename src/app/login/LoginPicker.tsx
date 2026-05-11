"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type U = { id: string; name: string; role: string; business: string; vertical: string };

export function LoginPicker({ users }: { users: U[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function pick(id: string) {
    setBusy(id);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    setBusy(null);
    if (res.ok) {
      router.push("/calls");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      {users.map(u => (
        <button
          key={u.id}
          onClick={() => pick(u.id)}
          disabled={busy !== null}
          className="card p-3 w-full text-left hover:border-lane disabled:opacity-50 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">{u.name}</div>
            <div className="text-xs text-ink-muted">
              {u.role} · {u.business} ({u.vertical.replace("_", " ")})
            </div>
          </div>
          <span className="text-xs text-ink-muted">{busy === u.id ? "Signing in…" : "→"}</span>
        </button>
      ))}
    </div>
  );
}
