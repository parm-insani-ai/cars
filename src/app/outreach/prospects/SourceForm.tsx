"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VERTICALS = [
  { value: "dealership", label: "Car dealerships" },
  { value: "service_shop", label: "Auto service shops" },
  { value: "wellness", label: "Wellness / med spas" },
] as const;

export function SourceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [state, setState] = useState({
    vertical: "service_shop" as (typeof VERTICALS)[number]["value"],
    location: "Austin, TX",
    limit: 10,
  });

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/outreach/actions/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setResult(j.detail ? `Sourcing failed: ${j.detail}` : "Sourcing failed.");
      return;
    }
    setResult(
      `Imported ${j.imported} new prospect${j.imported === 1 ? "" : "s"}` +
        (j.skipped ? `, skipped ${j.skipped} already on file` : "") +
        (j.mock ? " (mock data — no Google Places key set)" : "") +
        ". Qualification runs in the background.",
    );
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <div className="font-semibold">Find new prospects</div>
        <div className="text-xs text-ink-muted">
          Pulls SMBs from Google Places by vertical and location, then auto-qualifies them for fit.
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-ink-muted mb-1">Vertical</div>
          <select
            className="input"
            value={state.vertical}
            onChange={e => setState({ ...state, vertical: e.target.value as typeof state.vertical })}
          >
            {VERTICALS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs text-ink-muted mb-1">Location</div>
          <input
            className="input w-56"
            value={state.location}
            onChange={e => setState({ ...state, location: e.target.value })}
            placeholder="City, State"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-ink-muted mb-1">How many</div>
          <input
            type="number"
            min={1}
            max={20}
            className="input w-24"
            value={state.limit}
            onChange={e => setState({ ...state, limit: Number(e.target.value) })}
          />
        </label>
        <button className="btn-primary" onClick={run} disabled={busy || !state.location.trim()}>
          {busy ? "Sourcing…" : "Source prospects"}
        </button>
      </div>
      {result && <p className="text-sm text-ink-muted">{result}</p>}
    </div>
  );
}
