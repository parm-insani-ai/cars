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
      <div className="card p-4 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-ink-muted uppercase tracking-wider">Vertical</div>
            <div className="font-medium">{vertical.replace("_", " ")}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted uppercase tracking-wider">Phone number</div>
            <div className="font-medium">{phoneNumber ?? "Not provisioned"}</div>
          </div>
        </div>
      </div>

      <Section title="Greeting" hint="What the agent says when picking up. First impression.">
        <textarea className="border border-surface-border rounded-md px-3 py-2 text-sm w-full min-h-[60px]"
          value={c.greeting} onChange={e => setC({ ...c, greeting: e.target.value })} />
      </Section>

      <Section title="Personality" hint="How the agent talks. Tone, pacing, level of formality.">
        <textarea className="border border-surface-border rounded-md px-3 py-2 text-sm w-full min-h-[120px]"
          value={c.personality} onChange={e => setC({ ...c, personality: e.target.value })} />
      </Section>

      <Section title="Voice" hint="Provider + voice id. (11labs is the default; we'll add a picker.)">
        <div className="grid grid-cols-2 gap-2">
          <select className="border border-surface-border rounded-md px-2 h-9 text-sm"
            value={c.voiceProvider} onChange={e => setC({ ...c, voiceProvider: e.target.value })}>
            <option value="11labs">ElevenLabs</option>
            <option value="playht">PlayHT</option>
            <option value="azure">Azure</option>
            <option value="openai">OpenAI</option>
          </select>
          <input className="border border-surface-border rounded-md px-2 h-9 text-sm"
            value={c.voiceId} onChange={e => setC({ ...c, voiceId: e.target.value })} placeholder="Voice id" />
        </div>
      </Section>

      <Section title="Capabilities" hint="What the agent is allowed to do.">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Toggle label="Book appointments" checked={c.canBook} onChange={v => setC({ ...c, canBook: v })} />
          <Toggle label="Reschedule" checked={c.canReschedule} onChange={v => setC({ ...c, canReschedule: v })} />
          <Toggle label="Cancel" checked={c.canCancel} onChange={v => setC({ ...c, canCancel: v })} />
          <Toggle label="Transfer to human" checked={c.canTransfer} onChange={v => setC({ ...c, canTransfer: v })} />
        </div>
      </Section>

      <Section title="Transfer number" hint="Where to send the call when a caller asks for a human.">
        <input className="border border-surface-border rounded-md px-2 h-9 text-sm w-full"
          placeholder="+1 415 555 0123"
          value={c.transferTo ?? ""} onChange={e => setC({ ...c, transferTo: e.target.value || null })}
          disabled={!c.canTransfer} />
      </Section>

      <Section title="SMS footer" hint="Appended to every outbound SMS for TCPA compliance.">
        <input className="border border-surface-border rounded-md px-2 h-9 text-sm w-full"
          value={c.smsFooter} onChange={e => setC({ ...c, smsFooter: e.target.value })} />
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {savedAt && <span className="text-xs text-ink-muted">Saved {savedAt.toLocaleTimeString()}.</span>}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-2">
      <div>
        <div className="font-medium">{title}</div>
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
