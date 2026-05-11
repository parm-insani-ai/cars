"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type A = { id: string; title: string; body: string; tags: string[] };

export function KnowledgeEditor({ articles }: { articles: A[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", tags: "" });

  async function add() {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setBusy(true);
    await fetch("/api/actions/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "create", title: draft.title, body: draft.body, tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean) }),
    });
    setBusy(false);
    setDraft({ title: "", body: "", tags: "" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this article?")) return;
    setBusy(true);
    await fetch("/api/actions/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "delete", id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-2">
        <h2 className="font-medium">Add an article</h2>
        <input className="border border-surface-border rounded-md px-2 h-9 text-sm w-full" placeholder="Title"
          value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
        <textarea className="border border-surface-border rounded-md px-2 py-1.5 text-sm w-full min-h-[120px]" placeholder="Body — what the agent says when this comes up."
          value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
        <input className="border border-surface-border rounded-md px-2 h-9 text-sm w-full" placeholder="Tags (comma-separated)"
          value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} />
        <div>
          <button className="btn-primary" onClick={add} disabled={busy || !draft.title.trim() || !draft.body.trim()}>
            {busy ? "Saving…" : "Add article"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {articles.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted">No articles yet.</div>
        ) : articles.map(a => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-medium">{a.title}</h3>
                {a.tags.length > 0 && (
                  <div className="text-xs text-ink-muted mt-0.5">{a.tags.join(" · ")}</div>
                )}
              </div>
              <button className="btn-danger" onClick={() => remove(a.id)} disabled={busy}>Delete</button>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-2">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
