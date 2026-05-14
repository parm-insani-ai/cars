"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProspectActions({ prospectId, doNotCall }: { prospectId: string; doNotCall: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(op: "suppress" | "unsuppress" | "requalify") {
    if (op === "suppress" && !confirm("Add this prospect's number to the do-not-call list?")) return;
    setBusy(true);
    await fetch("/api/outreach/actions/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId, op }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button className="btn-secondary" onClick={() => run("requalify")} disabled={busy}>
        Re-qualify
      </button>
      {doNotCall ? (
        <button className="btn-secondary" onClick={() => run("unsuppress")} disabled={busy}>
          Remove from do-not-call
        </button>
      ) : (
        <button className="btn-danger" onClick={() => run("suppress")} disabled={busy}>
          Do not call
        </button>
      )}
    </div>
  );
}
