"use client";

import { useState } from "react";

// One-click button that walks the batched backfill endpoint until every
// eligible prospect has been checked. Displays live progress: how many
// processed, how many actually got a name written, how many remaining.
// Safe to run more than once — no-op for prospects already enriched.

export function BackfillOwnersButton() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "running"; processed: number; enriched: number; remaining: number | null }
    | { kind: "done"; processed: number; enriched: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function run() {
    const ok = confirm(
      "Backfill owner names for existing prospects?\n\n" +
      "This will hit Google Places for each un-enriched prospect (about " +
      "$0.02 per API call). Reviews get scanned for owner-referring phrases " +
      "like \"Jennifer was amazing\" and the top-mentioned name is saved.\n\n" +
      "Safe to interrupt or re-run — it picks up where it left off."
    );
    if (!ok) return;

    setState({ kind: "running", processed: 0, enriched: 0, remaining: null });
    let totalProcessed = 0;
    let totalEnriched = 0;

    // Loop until the server says done. Each batch caps at 25 so a single
    // Vercel invocation stays inside its serverless timeout.
    for (let i = 0; i < 40; i++) {   // hard ceiling — 40 * 25 = 1000 prospects max
      let batch: any;
      try {
        const res = await fetch("/api/outreach/actions/prospects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "backfill-owner-names", limit: 25 }),
        });
        batch = await res.json();
        if (!res.ok || !batch.ok) {
          setState({ kind: "error", message: batch?.error ?? `HTTP ${res.status}` });
          return;
        }
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        return;
      }

      totalProcessed += batch.processed ?? 0;
      totalEnriched += batch.enriched ?? 0;
      setState({
        kind: "running",
        processed: totalProcessed,
        enriched: totalEnriched,
        remaining: batch.remaining ?? null,
      });

      if (batch.done) break;
      // Small pause between batches — respectful to Google Places, and gives
      // the UI a moment to render progress.
      await new Promise(r => setTimeout(r, 200));
    }

    setState({ kind: "done", processed: totalProcessed, enriched: totalEnriched });
  }

  return (
    <div className="card p-5 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="section-title">Backfill owner names</h2>
          <p className="text-xs text-ink-muted mt-1">
            Enriches existing prospects with the owner's first name pulled from Google reviews.
            Ava can then open with "Hi, is Jennifer around?" — much better gatekeeper pass-through
            than "the owner or manager please."
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={run}
          disabled={state.kind === "running"}
        >
          {state.kind === "running" ? "Backfilling…" : "Run backfill"}
        </button>
      </div>

      {state.kind === "running" && (
        <div className="text-xs text-ink-muted">
          Processed {state.processed} · enriched {state.enriched}
          {state.remaining != null && ` · roughly ${state.remaining} left`}
        </div>
      )}
      {state.kind === "done" && (
        <div className="text-xs text-lane-cool">
          Done. Enriched {state.enriched} of {state.processed} checked.
        </div>
      )}
      {state.kind === "error" && (
        <div className="text-xs text-lane-hot">Backfill failed: {state.message}</div>
      )}
    </div>
  );
}
