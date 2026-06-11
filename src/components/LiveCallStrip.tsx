"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Live = {
  id: string;
  direction: "inbound" | "outbound";
  name: string;
  fromNumber: string;
  startedAt: string;
};

// Pulsing strip on the home page that lights up when there's a call in
// progress. Polls every 4 seconds — voice calls are short, so cheap polling
// is plenty.
export function LiveCallStrip() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/actions/active-call");
        if (!res.ok) return;
        const j = (await res.json()) as { live: Live | null };
        if (!cancelled) setLive(j.live);
      } catch {
        /* network blip — ignore, next tick will retry */
      }
    }
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!live) return null;

  const elapsedSec = Math.max(0, Math.round((Date.now() - new Date(live.startedAt).getTime()) / 1000));

  return (
    <Link
      href={`/calls/${live.id}`}
      className="card p-4 flex items-center gap-3 flex-wrap border-l-4 border-lane-cool bg-lane-cool/5 hover:bg-lane-cool/10 transition-colors"
    >
      <span className="relative inline-flex h-3 w-3 flex-none">
        <span className="absolute inline-flex h-full w-full rounded-full bg-lane-cool opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-lane-cool" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {live.direction === "inbound" ? "Incoming call" : "Outbound call"} — {live.name}
        </div>
        <div className="text-xs text-ink-muted">on the line · {elapsedSec}s elapsed</div>
      </div>
      <span className="text-xs text-lane font-medium">View live →</span>
    </Link>
  );
}
