"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Top-of-page progress bar that appears the instant a link is clicked and
// hides when the new route is rendered. Pure cosmetics — pages aren't
// actually faster, but the perceived "click to first visual change" delay
// drops from ~300ms to ~0ms.

export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const startedAt = useRef<number | null>(null);

  // When the pathname changes, the new page has rendered — hide the bar
  // (but enforce a tiny minimum so the bar is always visible long enough
  // for the eye to catch it).
  useEffect(() => {
    if (!startedAt.current) {
      setActive(false);
      return;
    }
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, 200 - elapsed);
    const t = setTimeout(() => {
      setActive(false);
      startedAt.current = null;
    }, remaining);
    return () => clearTimeout(t);
  }, [pathname]);

  // Listen for clicks on any in-app link. Bail on:
  // - modified clicks (cmd, ctrl, shift, alt) — opens new tab
  // - external links
  // - anchor-only links (same path, different hash)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      if (!target) return;
      const link = target.closest("a") as HTMLAnchorElement | null;
      if (!link || !link.href) return;
      try {
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      startedAt.current = Date.now();
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[100] pointer-events-none overflow-hidden">
      <div className="h-full bg-lane animate-[navprogress_1.4s_ease-in-out_infinite] origin-left" />
      <style jsx>{`
        @keyframes navprogress {
          0%   { transform: translateX(-100%) scaleX(0.35); }
          50%  { transform: translateX(0%) scaleX(0.6); }
          100% { transform: translateX(100%) scaleX(0.35); }
        }
      `}</style>
    </div>
  );
}
