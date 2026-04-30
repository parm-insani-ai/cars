"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Topbar({ user }: { user: { id: string; name: string; role: string; rooftop: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setBusy(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="h-12 border-b border-surface-border bg-white px-4 flex items-center justify-between">
      <div className="text-sm">
        <span className="text-ink-muted">Rooftop:</span>{" "}
        <span className="font-medium">{user?.rooftop ?? "—"}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user && (
          <div className="text-right">
            <div className="font-medium leading-tight">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted leading-tight">
              {user.role.replace("_", " ")}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          disabled={busy}
          className="btn-secondary"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
