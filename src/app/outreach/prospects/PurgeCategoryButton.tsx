"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small danger button that appears when the prospects list is filtered to a
// specific sub-category. Confirms with a count and calls the admin purge
// endpoint. Cascades everything (calls, turns, tool calls, targets) — the
// prospect and its whole call history are gone. Reusable for any category
// the operator decides isn't worth pursuing.

export function PurgeCategoryButton({
  categoryId,
  categoryLabel,
  matchingCount,
}: {
  categoryId: string;
  categoryLabel: string;
  matchingCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    const ok = confirm(
      `Delete every prospect in the "${categoryLabel}" category?\n\n` +
      `This will remove ${matchingCount} prospect${matchingCount === 1 ? "" : "s"} ` +
      `AND all of their call history, transcripts, and campaign targets. ` +
      `This cannot be undone.`,
    );
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/outreach/actions/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "purge-category", category: categoryId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg(`Purge failed: ${j.error ?? "unknown error"}`);
        setBusy(false);
        return;
      }
      setMsg(`Deleted ${j.deleted} prospect${j.deleted === 1 ? "" : "s"}.`);
      // Clear the URL back to the plain prospects list — the current filter
      // is now empty, and staying on it would look like something broke.
      router.push("/outreach/prospects");
      router.refresh();
    } catch (err) {
      setMsg(`Network error: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy || matchingCount === 0}
        className="btn-danger text-xs"
      >
        {busy ? "Deleting…" : `Delete all ${matchingCount} ${categoryLabel.toLowerCase()} prospect${matchingCount === 1 ? "" : "s"}`}
      </button>
      {msg && <span className="text-xs text-ink-muted">{msg}</span>}
    </div>
  );
}
