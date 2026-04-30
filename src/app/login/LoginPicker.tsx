"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type U = { id: string; name: string; role: string; rooftop: string };

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
      const next =
        users.find((u) => u.id === id)?.role === "sales_manager" ||
        users.find((u) => u.id === id)?.role === "gm"
          ? "/manager"
          : `/rep/${id}`;
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => pick(u.id)}
          disabled={busy !== null}
          className="card p-3 w-full text-left hover:border-lane disabled:opacity-50 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">{u.name}</div>
            <div className="text-xs text-ink-muted">
              {roleLabel[u.role] ?? u.role} · {u.rooftop}
            </div>
          </div>
          <span className="text-xs text-ink-muted">
            {busy === u.id ? "Signing in…" : "→"}
          </span>
        </button>
      ))}
    </div>
  );
}

const roleLabel: Record<string, string> = {
  rep: "Sales rep",
  bdc: "BDC",
  sales_manager: "Sales manager",
  gm: "GM",
  admin: "Admin",
};
