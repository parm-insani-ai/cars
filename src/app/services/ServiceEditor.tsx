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
      <div className="card p-4 space-y-3">
        <h2 className="font-medium">Add a service</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className="border border-surface-border rounded-md px-2 h-9 text-sm" placeholder="Name (required)"
            value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          <input className="border border-surface-border rounded-md px-2 h-9 text-sm" placeholder="Category"
            value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
          <input type="number" className="border border-surface-border rounded-md px-2 h-9 text-sm" placeholder="Duration (min)"
            value={draft.durationMin} onChange={e => setDraft({ ...draft, durationMin: Number(e.target.value) })} />
          <input type="number" className="border border-surface-border rounded-md px-2 h-9 text-sm" placeholder="Price ($)"
            value={draft.priceUsd} onChange={e => setDraft({ ...draft, priceUsd: e.target.value })} />
          <input className="border border-surface-border rounded-md px-2 h-9 text-sm md:col-span-2" placeholder="Provider kind (e.g. mechanic, stylist, sales_rep)"
            value={draft.providerKind} onChange={e => setDraft({ ...draft, providerKind: e.target.value })} />
          <input className="border border-surface-border rounded-md px-2 h-9 text-sm md:col-span-2" placeholder="Description (the agent says this aloud)"
            value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div>
          <button className="btn-primary" onClick={create} disabled={busy || !draft.name.trim()}>
            {busy ? "Saving…" : "Add service"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-sub text-ink-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Duration</th>
              <th className="text-right p-3">Price</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-ink-muted">No services yet.</td></tr>
            ) : services.map(s => (
              <tr key={s.id} className={"border-t border-surface-border " + (s.active ? "" : "opacity-50")}>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-xs text-ink-muted">{s.category ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">{s.durationMin}m</td>
                <td className="p-3 text-right tabular-nums">{s.priceUsd ? `$${s.priceUsd}` : "—"}</td>
                <td className="p-3 text-xs text-ink-muted line-clamp-2 max-w-md">{s.description ?? "—"}</td>
                <td className="p-3 text-right">
                  <button className="btn-secondary mr-1" onClick={() => toggle(s.id, !s.active)} disabled={busy}>
                    {s.active ? "Disable" : "Enable"}
                  </button>
                  <button className="btn-danger" onClick={() => remove(s.id)} disabled={busy}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
