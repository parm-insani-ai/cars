"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_GROUPS,
  CATEGORIES,
  HRM_AREAS,
  DEFAULT_AREAS,
} from "@/outreach/categories";

export function SourceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // Default: every category selected, the three biggest HRM communities.
  const [categories, setCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [areas, setAreas] = useState<string[]>(DEFAULT_AREAS);
  const [perQuery, setPerQuery] = useState(8);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    setResult(null);
  }

  function setGroup(groupId: string, on: boolean) {
    const ids = CATEGORIES.filter(c => c.group === groupId).map(c => c.id);
    setCategories(prev => (on ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id))));
    setResult(null);
  }

  const searches = categories.length * areas.length;

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/outreach/actions/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories, areas, perQuery }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setResult(j.error === "bad_request" ? "Pick at least one category and one area." : "Sourcing failed.");
      return;
    }
    setResult(
      `Imported ${j.imported} new prospect${j.imported === 1 ? "" : "s"}` +
        (j.skipped ? `, skipped ${j.skipped} already on file` : "") +
        ` (ran ${j.searches} searches).` +
        (j.truncated ? " Sweep was capped — run again to go deeper." : "") +
        (j.mock ? " Mock data — set GOOGLE_PLACES_API_KEY for real Halifax listings." : "") +
        " Scoring the prospects now — refresh this page in a minute to see fit scores.",
    );
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <div className="font-semibold">Find Halifax prospects</div>
        <div className="text-xs text-ink-muted">
          Sweeps Google Places for small businesses across Halifax Regional Municipality, then auto-qualifies them for fit.
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORY_GROUPS.map(g => {
          const groupCats = CATEGORIES.filter(c => c.group === g.id);
          const allOn = groupCats.every(c => categories.includes(c.id));
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold">{g.label}</div>
                <button
                  type="button"
                  className="text-xs text-lane hover:underline"
                  onClick={() => setGroup(g.id, !allOn)}
                >
                  {allOn ? "Clear" : "Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groupCats.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(categories, setCategories, c.id)}
                    className={
                      "px-2.5 py-1 rounded-lg text-xs border " +
                      (categories.includes(c.id)
                        ? "bg-ink text-white border-ink"
                        : "bg-white border-surface-border hover:bg-surface-sub")
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Halifax communities
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HRM_AREAS.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggle(areas, setAreas, a)}
              className={
                "px-2.5 py-1 rounded-lg text-xs border " +
                (areas.includes(a)
                  ? "bg-ink text-white border-ink"
                  : "bg-white border-surface-border hover:bg-surface-sub")
              }
            >
              {a.replace(", NS", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-ink-muted mb-1">Results per search</div>
          <input
            type="number"
            min={1}
            max={20}
            className="input w-24"
            value={perQuery}
            onChange={e => setPerQuery(Number(e.target.value))}
          />
        </label>
        <div className="text-xs text-ink-muted">
          {categories.length} categories x {areas.length} areas = <span className="font-semibold">{searches}</span> searches
        </div>
        <button
          className="btn-primary ml-auto"
          onClick={run}
          disabled={busy || categories.length === 0 || areas.length === 0}
        >
          {busy ? "Sourcing…" : "Source prospects"}
        </button>
      </div>

      {result && <p className="text-sm text-ink-muted">{result}</p>}
    </div>
  );
}
