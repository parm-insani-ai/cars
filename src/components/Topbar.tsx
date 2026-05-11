"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Topbar({ user }: { user: { name: string; role: string; business: string; vertical: string } | null }) {
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
        <span className="text-ink-muted">Business:</span>{" "}
        <span className="font-medium">{user?.business ?? "—"}</span>
        {user?.vertical && (
          <span className="text-ink-muted ml-2 text-xs">· {user.vertical.replace("_", " ")}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user && (
          <div className="text-right">
            <div className="font-medium leading-tight">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted leading-tight">
              {user.role}
            </div>
          </div>
        )}
        <button onClick={logout} disabled={busy} className="btn-secondary">Sign out</button>
      </div>
    </div>
  );
}
