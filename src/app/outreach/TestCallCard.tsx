"use client";

import { useState } from "react";

export function TestCallCard() {
  const [phone, setPhone] = useState("+1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function call() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/outreach/actions/test-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const j = await res.json();
    setBusy(false);
    setOk(res.ok);
    setMsg(res.ok ? "Calling your phone now — pick up to hear the AI rep." : (j.detail || "Call failed."));
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <div className="font-semibold">Test the AI sales rep</div>
        <div className="text-xs text-ink-muted">
          Places a real call to a number you enter so you can hear the rep. Use a number you've verified in Twilio (your own cell). Format: <span className="font-mono">+19025551234</span>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-ink-muted mb-1">Phone number (E.164)</div>
          <input
            className="input w-48"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+19025551234"
          />
        </label>
        <button className="btn-primary" onClick={call} disabled={busy || phone.replace(/\D/g, "").length < 8}>
          {busy ? "Calling…" : "Call my phone"}
        </button>
      </div>
      {msg && <p className={"text-sm " + (ok ? "text-ink-muted" : "text-lane-hot")}>{msg}</p>}
    </div>
  );
}
