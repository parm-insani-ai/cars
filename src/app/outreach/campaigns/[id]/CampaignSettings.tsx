"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Live-edit the four pacing knobs on a running campaign. Everything else
// (name / goal / pitch / audience) is fixed at create time — those changes
// really do want a new campaign so the audience gets rebuilt.

export function CampaignSettings({
  campaignId,
  quietStartHour,
  quietEndHour,
  ratePerMinute,
  maxAttempts,
}: {
  campaignId: string;
  quietStartHour: number;
  quietEndHour: number;
  ratePerMinute: number;
  maxAttempts: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [form, setForm] = useState({
    quietStartHour,
    quietEndHour,
    ratePerMinute,
    maxAttempts,
  });

  const dirty =
    form.quietStartHour !== quietStartHour ||
    form.quietEndHour !== quietEndHour ||
    form.ratePerMinute !== ratePerMinute ||
    form.maxAttempts !== maxAttempts;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/outreach/actions/campaigns?op=settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, ...form }),
    });
    setBusy(false);
    if (res.ok) {
      setSavedAt(Date.now());
      router.refresh();
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Pacing</h2>
        {savedAt && !dirty && <span className="text-[10px] text-lane-cool font-medium">Saved</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field
          label="Quiet start (24h)"
          hint="Hour (0-23) in prospect's local time when dialing stops."
        >
          <input
            type="number"
            min={0}
            max={23}
            value={form.quietStartHour}
            onChange={e => setForm({ ...form, quietStartHour: Number(e.target.value) })}
            className="input w-full"
          />
        </Field>
        <Field
          label="Quiet end (24h)"
          hint="Hour when dialing resumes. To dial 24/7, set quiet start = quiet end."
        >
          <input
            type="number"
            min={0}
            max={23}
            value={form.quietEndHour}
            onChange={e => setForm({ ...form, quietEndHour: Number(e.target.value) })}
            className="input w-full"
          />
        </Field>
        <Field label="Calls / minute" hint="Cap on dial rate per tick.">
          <input
            type="number"
            min={1}
            max={20}
            value={form.ratePerMinute}
            onChange={e => setForm({ ...form, ratePerMinute: Number(e.target.value) })}
            className="input w-full"
          />
        </Field>
        <Field label="Max attempts" hint="Retries before a target is marked failed.">
          <input
            type="number"
            min={1}
            max={10}
            value={form.maxAttempts}
            onChange={e => setForm({ ...form, maxAttempts: Number(e.target.value) })}
            className="input w-full"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-primary"
          disabled={!dirty || busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save pacing"}
        </button>
        {dirty && (
          <button
            type="button"
            className="text-xs text-ink-muted hover:underline"
            onClick={() =>
              setForm({ quietStartHour, quietEndHour, ratePerMinute, maxAttempts })
            }
          >
            Reset
          </button>
        )}
        <div className="text-[10px] text-ink-muted ml-auto">
          Tip: set start = end (e.g. 0/0) to dial 24/7 for testing.
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
}
