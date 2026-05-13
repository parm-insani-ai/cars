"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCampaignForm({ totalCustomers, optedIn }: { totalCustomers: number; optedIn: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [state, setState] = useState({
    name: "",
    goal: "Reach out to customers we haven't seen in 180+ days, offer to book them an appointment, suggest two specific times.",
    lapsedDays: 180,
    requireSmsConsent: true,
    quietStartHour: 20,
    quietEndHour: 9,
    ratePerMinute: 2,
  });

  async function preview() {
    setBusy(true);
    const res = await fetch("/api/actions/campaigns?op=preview", {
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
    const res = await fetch("/api/actions/campaigns?op=create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const j = await res.json();
    setBusy(false);
    if (j.campaignId) router.push(`/campaigns/${j.campaignId}`);
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="kpi-label">Customers on file</div>
          <div className="font-medium">{totalCustomers.toLocaleString()}</div>
        </div>
        <div>
          <div className="kpi-label">With text consent</div>
          <div className="font-medium">{optedIn.toLocaleString()}</div>
        </div>
      </div>

      <Section title="Campaign name" hint="Internal label — customers never see this.">
        <input className="input w-full" value={state.name} onChange={e => setState({ ...state, name: e.target.value })} placeholder="Spring 2026 recall" />
      </Section>

      <Section title="Goal" hint="What the agent should accomplish on the call. Plain English.">
        <textarea className="input-textarea w-full min-h-[100px]" value={state.goal} onChange={e => setState({ ...state, goal: e.target.value })} />
      </Section>

      <Section title="Who to call" hint="We pick customers who haven't had any appointment activity in this many days.">
        <div className="flex items-center gap-2">
          <span className="text-sm">No activity in the last</span>
          <input type="number" className="input w-24" value={state.lapsedDays} onChange={e => setState({ ...state, lapsedDays: Number(e.target.value) })} />
          <span className="text-sm">days</span>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
          <input type="checkbox" checked={state.requireSmsConsent} onChange={e => setState({ ...state, requireSmsConsent: e.target.checked })} />
          Only call customers who have given consent for text/calls
        </label>
      </Section>

      <Section title="Quiet hours" hint="The agent never calls during these hours (business timezone). 24-hour clock.">
        <div className="flex items-center gap-2 text-sm">
          <span>Quiet from</span>
          <input type="number" min={0} max={23} className="input w-20" value={state.quietStartHour} onChange={e => setState({ ...state, quietStartHour: Number(e.target.value) })} />
          <span>to</span>
          <input type="number" min={0} max={23} className="input w-20" value={state.quietEndHour} onChange={e => setState({ ...state, quietEndHour: Number(e.target.value) })} />
        </div>
      </Section>

      <Section title="Throttle" hint="Max number of outbound calls per minute. Keep this low to stay polite and within carrier limits.">
        <input type="number" min={1} max={20} className="input w-24" value={state.ratePerMinute} onChange={e => setState({ ...state, ratePerMinute: Number(e.target.value) })} />
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button className="btn-secondary" onClick={preview} disabled={busy}>{busy ? "Counting…" : "Preview audience"}</button>
        {previewCount != null && (
          <span className="text-sm">
            We'd call <span className="font-semibold">{previewCount.toLocaleString()}</span> customer{previewCount === 1 ? "" : "s"}.
          </span>
        )}
        <button className="btn-primary ml-auto" onClick={create} disabled={busy || !state.name.trim()}>
          {busy ? "Saving…" : "Create campaign"}
        </button>
      </div>

      <p className="text-xs text-ink-muted">
        Creating the campaign saves it as a <em>draft</em>. You can review the target list and then start it from the campaign detail page.
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
