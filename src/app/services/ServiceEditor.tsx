"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type S = {
  id: string;
  name: string;
  category: string | null;
  durationMin: number;
  priceUsd: number | null;
  description: string | null;
  providerKind: string | null;
  active: boolean;
};

export function ServiceEditor({ services }: { services: S[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "", category: "", durationMin: 30, priceUsd: "", description: "", providerKind: "",
  });

  async function create() {
    if (!draft.name.trim()) return;
    setBusy(true);
    await fetch("/api/actions/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "create",
        name: draft.name,
        category: draft.category || null,
        durationMin: Number(draft.durationMin),
        priceUsd: draft.priceUsd ? Number(draft.priceUsd) : null,
        description: draft.description || null,
        providerKind: draft.providerKind || null,
      }),
    });
    setBusy(false);
    setDraft({ name: "", category: "", durationMin: 30, priceUsd: "", description: "", providerKind: "" });
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    setBusy(true);
    await fetch("/api/actions/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "toggle", id, active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this service?")) return;
    setBusy(true);
    await fetch("/api/actions/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "delete", id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold">Add a service</h2>
        <p className="text-xs text-ink-muted">
          The more accurate the description, the better the agent explains it to callers.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className="input" placeholder="Name (required)" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          <input className="input" placeholder="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
          <input type="number" className="input" placeholder="Duration (min)" value={draft.durationMin} onChange={e => setDraft({ ...draft, durationMin: Number(e.target.value) })} />
          <input type="number" className="input" placeholder="Price ($)" value={draft.priceUsd} onChange={e => setDraft({ ...draft, priceUsd: e.target.value })} />
          <input className="input md:col-span-2" placeholder="Staff kind (e.g. mechanic, stylist, sales rep)" value={draft.providerKind} onChange={e => setDraft({ ...draft, providerKind: e.target.value })} />
          <input className="input md:col-span-2" placeholder="Description — the agent says this aloud" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div>
          <button className="btn-primary" onClick={create} disabled={busy || !draft.name.trim()}>
            {busy ? "Saving…" : "Add service"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {services.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No services yet</div>
            <div className="empty-sub">Add at least one so callers have something to book.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Price</th>
                <th>Description</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-xs text-ink-muted">{s.category ?? "—"}</td>
                  <td className="text-right tabular-nums">{s.durationMin}m</td>
                  <td className="text-right tabular-nums">{s.priceUsd ? `$${s.priceUsd}` : "—"}</td>
                  <td className="text-xs text-ink-muted max-w-md">{s.description ?? "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-secondary mr-1" onClick={() => toggle(s.id, !s.active)} disabled={busy}>
                      {s.active ? "Disable" : "Enable"}
                    </button>
                    <button className="btn-danger" onClick={() => remove(s.id)} disabled={busy}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
