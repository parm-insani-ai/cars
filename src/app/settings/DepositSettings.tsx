"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DepositSettings({ enabled, defaultDepositCents, stripeConfigured }: {
  enabled: boolean;
  defaultDepositCents: number | null;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState({
    enabled,
    defaultDepositDollars: defaultDepositCents != null ? (defaultDepositCents / 100).toFixed(2) : "",
  });
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save() {
    setBusy(true);
    const cents = s.defaultDepositDollars ? Math.round(Number(s.defaultDepositDollars) * 100) : null;
    await fetch("/api/actions/deposit-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: s.enabled, defaultDepositCents: cents }),
    });
    setBusy(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      {!stripeConfigured && (
        <div className="text-xs text-ink-muted bg-surface-sub border border-surface-border rounded-md p-2">
          Stripe isn't configured yet — payments will use a mock checkout URL. Add STRIPE_SECRET_KEY in .env to take real cards.
        </div>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={s.enabled} onChange={e => setS({ ...s, enabled: e.target.checked })} />
        Enable deposits — when on, the agent will text a payment link mid-call to lock the appointment.
      </label>
      <div className="space-y-1">
        <label className="block text-sm font-medium">Default deposit amount</label>
        <div className="flex items-center gap-2">
          <span className="text-sm">$</span>
          <input className="input w-24" inputMode="decimal" value={s.defaultDepositDollars} onChange={e => setS({ ...s, defaultDepositDollars: e.target.value })} />
          <span className="text-xs text-ink-muted">USD. Services can override this individually.</span>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {savedAt && <span className="text-xs text-ink-muted">Saved at {savedAt.toLocaleTimeString()}.</span>}
      </div>
    </div>
  );
}
