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
        open: h ? mToHHMM(h.openMin) : "09:00",
        close: h ? mToHHMM(h.closeMin) : "18:00",
        closed: !h,
      };
    })
  );
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

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
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-2">
      {state.map((d, i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <div className="w-24 text-sm font-medium">{DAYS[d.dayOfWeek]}</div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={d.closed} onChange={e => setDay(i, { closed: e.target.checked })} />
            Closed
          </label>
          <input type="time" value={d.open} disabled={d.closed} className="input w-28" onChange={e => setDay(i, { open: e.target.value })} />
          <span className="text-xs text-ink-muted">to</span>
          <input type="time" value={d.close} disabled={d.closed} className="input w-28" onChange={e => setDay(i, { close: e.target.value })} />
        </div>
      ))}
      <div className="pt-3 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save hours"}</button>
        {savedAt && <span className="text-xs text-ink-muted">Saved at {savedAt.toLocaleTimeString()}.</span>}
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
