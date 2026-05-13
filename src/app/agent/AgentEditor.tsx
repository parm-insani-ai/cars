"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Cfg = {
  greeting: string;
  personality: string;
  voiceProvider: string;
  voiceId: string;
  language: string;
  canBook: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  canTransfer: boolean;
  transferTo: string | null;
  smsFooter: string;
};

export function AgentEditor({ config, phoneNumber, vertical }: { config: Cfg; phoneNumber: string | null; vertical: string }) {
  const [c, setC] = useState(config);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const router = useRouter();

  async function save() {
    setBusy(true);
    await fetch("/api/actions/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    setBusy(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="kpi-label">Business type</div>
          <div className="font-medium">{vertical}</div>
        </div>
        <div>
          <div className="kpi-label">Phone number</div>
          <div className="font-medium">{phoneNumber ?? "Not connected"}</div>
        </div>
      </div>

      <Section title="Greeting" hint="The first thing callers hear when the agent picks up.">
        <textarea className="input-textarea w-full min-h-[60px]" value={c.greeting} onChange={e => setC({ ...c, greeting: e.target.value })} />
      </Section>

      <Section title="Personality" hint="How the agent talks — tone, pacing, level of formality. Write it like instructions to a new hire.">
        <textarea className="input-textarea w-full min-h-[140px]" value={c.personality} onChange={e => setC({ ...c, personality: e.target.value })} />
      </Section>

      <Section title="Voice" hint="Which text-to-speech voice to use. Defaults work for most businesses.">
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={c.voiceProvider} onChange={e => setC({ ...c, voiceProvider: e.target.value })}>
            <option value="11labs">ElevenLabs</option>
            <option value="playht">PlayHT</option>
            <option value="azure">Azure</option>
            <option value="openai">OpenAI</option>
          </select>
          <input className="input" value={c.voiceId} onChange={e => setC({ ...c, voiceId: e.target.value })} placeholder="Voice id" />
        </div>
      </Section>

      <Section title="What the agent can do" hint="Turn things off if you'd rather your staff handle them.">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Toggle label="Book new appointments" checked={c.canBook} onChange={v => setC({ ...c, canBook: v })} />
          <Toggle label="Reschedule appointments" checked={c.canReschedule} onChange={v => setC({ ...c, canReschedule: v })} />
          <Toggle label="Cancel appointments" checked={c.canCancel} onChange={v => setC({ ...c, canCancel: v })} />
          <Toggle label="Transfer to a person" checked={c.canTransfer} onChange={v => setC({ ...c, canTransfer: v })} />
        </div>
      </Section>

      <Section title="Transfer number" hint="When the caller asks for a human, this is who the agent calls.">
        <input className="input w-full" placeholder="+1 415 555 0123" value={c.transferTo ?? ""}
          onChange={e => setC({ ...c, transferTo: e.target.value || null })} disabled={!c.canTransfer} />
      </Section>

      <Section title="Text message footer" hint="Added to every text we send for legal compliance (the STOP-to-opt-out line).">
        <input className="input w-full" value={c.smsFooter} onChange={e => setC({ ...c, smsFooter: e.target.value })} />
      </Section>

      <div className="flex items-center gap-3 pt-1">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        {savedAt && <span className="text-xs text-ink-muted">Saved at {savedAt.toLocaleTimeString()}.</span>}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-2">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-ink-muted">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
