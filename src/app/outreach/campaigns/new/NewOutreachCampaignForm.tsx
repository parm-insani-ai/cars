"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VERTICALS = [
  { value: "dealership", label: "Dealerships" },
  { value: "service_shop", label: "Auto service shops" },
  { value: "wellness", label: "Wellness / med spas" },
] as const;

type Vertical = (typeof VERTICALS)[number]["value"];

export function NewOutreachCampaignForm({ qualifiedCount }: { qualifiedCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [state, setState] = useState({
    name: "",
    repName: "Alex",
    goal: "Introduce Frontdesk, find out if they miss inbound calls, and book a 15-minute demo.",
    pitch:
      "Frontdesk is an AI phone receptionist that answers every call, books appointments straight into your calendar, and follows up on missed calls — so you never lose a customer to a ringing phone. It sounds natural, works 24/7, and sets up in a day.",
    offer: "First 14 days free, no card required.",
    verticals: ["service_shop"] as Vertical[],
    minScore: 60,
    quietStartHour: 20,
    quietEndHour: 9,
    ratePerMinute: 2,
    maxAttempts: 3,
  });

  function toggleVertical(v: Vertical) {
    setState(s => ({
      ...s,
      verticals: s.verticals.includes(v) ? s.verticals.filter(x => x !== v) : [...s.verticals, v],
    }));
    setPreviewCount(null);
  }

  async function preview() {
    setBusy(true);
    const res = await fetch("/api/outreach/actions/campaigns?op=preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const j = await res.json();
    setBusy(false);
    setPreviewCount(j.count ?? 0);
  }

  async function create() {
    setBusy(true);
    const res = await fetch("/api/outreach/actions/campaigns?op=create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const j = await res.json();
    setBusy(false);
    if (j.campaignId) router.push(`/outreach/campaigns/${j.campaignId}`);
  }

  const canSubmit = state.name.trim() && state.pitch.trim() && state.verticals.length > 0;

  return (
    <div className="space-y-4">
      <div className="card p-5 text-sm">
        <div className="kpi-label">Qualified prospects on file</div>
        <div className="font-medium">{qualifiedCount.toLocaleString()}</div>
        <p className="text-xs text-ink-muted mt-1">
          Campaigns only call prospects with status “Qualified”. Source and qualify more from the Prospects tab.
        </p>
      </div>

      <Section title="Campaign name" hint="Internal label.">
        <input className="input w-full" value={state.name} onChange={e => setState({ ...state, name: e.target.value })} placeholder="Austin auto shops — Q2" />
      </Section>

      <Section title="AI rep name" hint="The name the AI sales rep introduces itself with on the call.">
        <input className="input w-48" value={state.repName} onChange={e => setState({ ...state, repName: e.target.value })} />
      </Section>

      <Section title="Goal" hint="What the rep should accomplish. Plain English — goes into the call prompt.">
        <textarea className="input-textarea w-full min-h-[70px]" value={state.goal} onChange={e => setState({ ...state, goal: e.target.value })} />
      </Section>

      <Section title="Pitch" hint="The core value proposition the rep leads with.">
        <textarea className="input-textarea w-full min-h-[110px]" value={state.pitch} onChange={e => setState({ ...state, pitch: e.target.value })} />
      </Section>

      <Section title="Offer" hint="Optional incentive to close the demo.">
        <input className="input w-full" value={state.offer} onChange={e => setState({ ...state, offer: e.target.value })} />
      </Section>

      <Section title="Who to call" hint="Qualified prospects in these verticals, at or above this fit score.">
        <div className="flex flex-wrap gap-2 mb-3">
          {VERTICALS.map(v => (
            <button
              key={v.value}
              type="button"
              onClick={() => toggleVertical(v.value)}
              className={
                "px-3 py-1.5 rounded-lg text-sm border " +
                (state.verticals.includes(v.value)
                  ? "bg-ink text-white border-ink"
                  : "bg-white border-surface-border hover:bg-surface-sub")
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Minimum fit score</span>
          <input
            type="number"
            min={0}
            max={100}
            className="input w-24"
            value={state.minScore}
            onChange={e => { setState({ ...state, minScore: Number(e.target.value) }); setPreviewCount(null); }}
          />
        </div>
      </Section>

      <Section title="Quiet hours" hint="The rep never calls during these hours — evaluated in each prospect's own timezone. 24-hour clock.">
        <div className="flex items-center gap-2 text-sm">
          <span>Quiet from</span>
          <input type="number" min={0} max={23} className="input w-20" value={state.quietStartHour} onChange={e => setState({ ...state, quietStartHour: Number(e.target.value) })} />
          <span>to</span>
          <input type="number" min={0} max={23} className="input w-20" value={state.quietEndHour} onChange={e => setState({ ...state, quietEndHour: Number(e.target.value) })} />
        </div>
      </Section>

      <Section title="Pacing" hint="Outbound calls per minute, and how many times to retry a prospect with no contact.">
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span>Calls/min</span>
            <input type="number" min={1} max={20} className="input w-20" value={state.ratePerMinute} onChange={e => setState({ ...state, ratePerMinute: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2">
            <span>Max attempts</span>
            <input type="number" min={1} max={10} className="input w-20" value={state.maxAttempts} onChange={e => setState({ ...state, maxAttempts: Number(e.target.value) })} />
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button className="btn-secondary" onClick={preview} disabled={busy || state.verticals.length === 0}>
          {busy ? "Counting…" : "Preview audience"}
        </button>
        {previewCount != null && (
          <span className="text-sm">
            We'd call <span className="font-semibold">{previewCount.toLocaleString()}</span> prospect{previewCount === 1 ? "" : "s"}.
          </span>
        )}
        <button className="btn-primary ml-auto" onClick={create} disabled={busy || !canSubmit}>
          {busy ? "Saving…" : "Create campaign"}
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        Creating saves the campaign as a <em>draft</em>. Review the target list, then start it from the campaign page.
      </p>
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
