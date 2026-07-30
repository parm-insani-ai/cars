"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verticalLabel } from "@/lib/labels";

// Keep in sync with Sidebar.tsx — the custom event the hamburger dispatches
// to ask the sidebar drawer to slide in on mobile.
const MOBILE_NAV_OPEN_EVENT = "mobile-nav-open";

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

  function openNav() {
    window.dispatchEvent(new Event(MOBILE_NAV_OPEN_EVENT));
  }

  function initialsOf(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? "")
      .join("") || "·";
  }

  return (
    <div className="h-14 border-b border-surface-border bg-white/80 backdrop-blur-sm px-3 md:px-6 flex items-center justify-between gap-3 sticky top-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          aria-label="Open menu"
          onClick={openNav}
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-surface-sub text-ink"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div className="text-sm min-w-0 truncate flex items-baseline gap-2">
          <span className="text-ink-muted hidden sm:inline text-[13px]">Signed in to</span>
          <span className="font-semibold text-ink">{user?.business ?? "—"}</span>
          {user?.vertical && (
            <span className="text-xs text-ink-muted hidden md:inline">
              · {verticalLabel[user.vertical] ?? user.vertical}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm flex-none">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="text-right leading-tight hidden sm:block">
              <div className="font-medium text-ink">{user.name}</div>
              <div className="text-[11px] text-ink-muted capitalize">{user.role}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lane to-lane-soft text-white text-xs font-semibold flex items-center justify-center shadow-elev-1">
              {initialsOf(user.name)}
            </div>
          </div>
        )}
        <button onClick={logout} disabled={busy} className="btn-ghost">Sign out</button>
      </div>
    </div>
  );
}
