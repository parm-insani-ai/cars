"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Live = {
  id: string;
  prospectId: string;
  businessName: string;
  city: string | null;
  toNumber: string;
  campaignName: string | null;
  startedAt: string;
};

// GTM overview "on the line right now" panel. Polls /api/outreach/actions/
// live-calls every 4 seconds — voice calls are short-lived and we want the
// list to feel real-time without needing a websocket. Renders nothing when
// nothing is dialing, so the panel is invisible during idle periods.

export function LiveOutreachCalls() {
  const [live, setLive] = useState<Live[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/outreach/actions/live-calls", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { live: Live[] };
        if (!cancelled) setLive(j.live);
      } catch {
        /* transient network blip — next tick will refresh */
      }
    }
    tick();
    const pollId = setInterval(tick, 4000);
    // Independent 1s tick just for the elapsed counter — keeps it smooth
    // without hammering the API.
    const clockId = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(clockId);
    };
  }, []);

  if (live.length === 0) return null;

  return (
    <div className="card p-4 border-l-4 border-lane-cool bg-lane-cool/5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-3 w-3 flex-none">
          <span className="absolute inline-flex h-full w-full rounded-full bg-lane-cool opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-lane-cool" />
        </span>
        <div className="text-sm font-semibold">
          On the line right now — {live.length} {live.length === 1 ? "call" : "calls"}
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {live.map(c => {
          const elapsed = Math.max(0, Math.round((now - new Date(c.startedAt).getTime()) / 1000));
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 border-t border-lane-cool/20 pt-1.5 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/outreach/calls/${c.id}`}
                  className="font-medium text-ink hover:underline truncate block"
                >
                  {c.businessName}
                </Link>
                <div className="text-xs text-ink-muted truncate">
                  {c.toNumber}
                  {c.city && ` · ${c.city}`}
                  {c.campaignName && ` · ${c.campaignName}`}
                </div>
              </div>
              <span className="text-xs text-lane font-medium tabular-nums flex-none">
                {formatElapsed(elapsed)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
