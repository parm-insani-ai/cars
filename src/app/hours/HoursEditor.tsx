"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type H = { dayOfWeek: number; openMin: number; closeMin: number };
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export function HoursEditor({ hours }: { hours: H[] }) {
  const router = useRouter();
  const map = new Map(hours.map(h => [h.dayOfWeek, h]));
  const [state, setState] = useState(
    DAYS.map((_, i) => {
      const h = map.get(i);
      return {
        dayOfWeek: i,
        open: h ? mToHHMM(h.openMin) : "",
        close: h ? mToHHMM(h.closeMin) : "",
        closed: !h,
      };
    })
  );
  const [busy, setBusy] = useState(false);

  function setDay(i: number, patch: Partial<typeof state[number]>) {
    setState(prev => prev.map((d, j) => j === i ? { ...d, ...patch } : d));
  }

  async function save() {
    setBusy(true);
    await fetch("/api/actions/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: state.map(d => ({
          dayOfWeek: d.dayOfWeek,
          closed: d.closed || !d.open || !d.close,
          openMin: hhmmToMin(d.open),
          closeMin: hhmmToMin(d.close),
        })),
      }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-3">
      {state.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-sm">{DAYS[d.dayOfWeek]}</div>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={d.closed} onChange={e => setDay(i, { closed: e.target.checked })} />
            Closed
          </label>
          <input type="time" value={d.open} disabled={d.closed} className="border border-surface-border rounded-md px-2 h-9 text-sm" onChange={e => setDay(i, { open: e.target.value })} />
          <span className="text-xs">to</span>
          <input type="time" value={d.close} disabled={d.closed} className="border border-surface-border rounded-md px-2 h-9 text-sm" onChange={e => setDay(i, { close: e.target.value })} />
        </div>
      ))}
      <div className="pt-2">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save hours"}</button>
      </div>
    </div>
  );
}

function mToHHMM(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function hhmmToMin(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
