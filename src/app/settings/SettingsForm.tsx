"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function SettingsForm({
  businessName,
  phoneNumber,
  smsFromNumber,
  timezone,
}: {
  businessName: string;
  phoneNumber: string | null;
  smsFromNumber: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [s, setS] = useState({
    name: businessName,
    phoneNumber: phoneNumber ?? "",
    smsFromNumber: smsFromNumber ?? "",
    timezone,
  });
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save() {
    setBusy(true);
    await fetch("/api/actions/business-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        phoneNumber: s.phoneNumber || null,
        smsFromNumber: s.smsFromNumber || null,
        timezone: s.timezone,
      }),
    });
    setBusy(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <Field
        label="Business name"
        hint="Used in your agent's greeting and on outbound texts."
      >
        <input className="input w-full" value={s.name} onChange={e => setS({ ...s, name: e.target.value })} />
      </Field>

      <Field
        label="Main phone number"
        hint="The number callers dial. Once connected to Vapi, this is what the agent picks up."
      >
        <input className="input w-full" placeholder="+1 415 555 0123" value={s.phoneNumber} onChange={e => setS({ ...s, phoneNumber: e.target.value })} />
      </Field>

      <Field
        label="SMS sender number"
        hint="Number used when sending reminders and confirmations. Defaults to your main number."
      >
        <input className="input w-full" placeholder="+1 415 555 0123" value={s.smsFromNumber} onChange={e => setS({ ...s, smsFromNumber: e.target.value })} />
      </Field>

      <Field
        label="Timezone"
        hint="The agent proposes appointment times in this timezone."
      >
        <select className="input w-full" value={s.timezone} onChange={e => setS({ ...s, timezone: e.target.value })}>
          {TIMEZONES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button className="btn-primary" onClick={save} disabled={busy || !s.name.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
        {savedAt && <span className="text-xs text-ink-muted">Saved at {savedAt.toLocaleTimeString()}.</span>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      <p className="text-xs text-ink-muted">{hint}</p>
    </div>
  );
}
