"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OutreachCampaignControls({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(op: "start" | "pause" | "cancel") {
    if (op === "cancel" && !confirm("Cancel this campaign? Pending targets will stop being called.")) return;
    setBusy(true);
    await fetch(`/api/outreach/actions/campaigns?op=${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    setBusy(false);
    router.refresh();
  }

  const isTerminal = status === "completed" || status === "canceled";

  return (
    <div className="flex gap-2">
      {(status === "draft" || status === "paused") && (
        <button className="btn-primary" onClick={() => run("start")} disabled={busy}>
          {status === "draft" ? "Start calling" : "Resume"}
        </button>
      )}
      {status === "running" && (
        <button className="btn-secondary" onClick={() => run("pause")} disabled={busy}>Pause</button>
      )}
      {isTerminal && (
        <button className="btn-primary" onClick={() => run("start")} disabled={busy}>
          {status === "canceled" ? "Reopen campaign" : "Restart campaign"}
        </button>
      )}
      {!isTerminal && (
        <button className="btn-danger" onClick={() => run("cancel")} disabled={busy}>Cancel</button>
      )}
    </div>
  );
}
