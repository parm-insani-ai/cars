"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verticalLabel } from "@/lib/labels";

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
    <div className="h-14 border-b border-surface-border bg-white px-5 flex items-center justify-between">
      <div className="text-sm">
        <span className="text-ink-muted">Signed in to</span>{" "}
        <span className="font-semibold">{user?.business ?? "—"}</span>
        {user?.vertical && (
          <span className="ml-2 text-xs text-ink-muted">
            · {verticalLabel[user.vertical] ?? user.vertical}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user && (
          <div className="text-right leading-tight">
            <div className="font-medium">{user.name}</div>
            <div className="text-[11px] text-ink-muted capitalize">{user.role}</div>
          </div>
        )}
        <button onClick={logout} disabled={busy} className="btn-secondary">Sign out</button>
      </div>
    </div>
  );
}
