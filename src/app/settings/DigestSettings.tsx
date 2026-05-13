"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DigestSettings({
  enabled, recipientPhone, recipientEmail, hourLocal, timezone,
}: {
  enabled: boolean;
  recipientPhone: string | null;
  recipientEmail: string | null;
  hourLocal: number;
  timezone: string;
}) {
  const router = useRouter();
  const [s, setS] = useState({
    enabled,
    recipientPhone: recipientPhone ?? "",
    recipientEmail: recipientEmail ?? "",
    hourLocal,
  });
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save() {
    setBusy(true);
    await fetch("/api/actions/digest-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: s.enabled,
        recipientPhone: s.recipientPhone || null,
        recipientEmail: s.recipientEmail || null,
        hourLocal: Number(s.hourLocal),
      }),
    });
    setBusy(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={s.enabled} onChange={e => setS({ ...s, enabled: e.target.checked })} />
        Send me an end-of-day text every evening
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Phone (for SMS digest)</label>
          <input className="input w-full" placeholder="+1 415 555 0123" value={s.recipientPhone} onChange={e => setS({ ...s, recipientPhone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email (optional)</label>
          <input className="input w-full" placeholder="you@example.com" value={s.recipientEmail} onChange={e => setS({ ...s, recipientEmail: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium">Send at</label>
        <div className="flex items-center gap-2">
          <select className="input w-32" value={s.hourLocal} onChange={e => setS({ ...s, hourLocal: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, i) => i).map(h => (
              <option key={h} value={h}>{fmtHour(h)}</option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">{timezone}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {savedAt && <span className="text-xs text-ink-muted">Saved at {savedAt.toLocaleTimeString()}.</span>}
      </div>
    </div>
  );
}

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:00 ${ampm}`;
}
