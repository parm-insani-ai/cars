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
      <div className="card p-5 space-y-2">
        <h2 className="font-semibold">Add an article</h2>
        <input className="input w-full" placeholder="Title — e.g. 'Cancellation policy'" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
        <textarea
          className="input-textarea w-full min-h-[120px]"
          placeholder="Body — what the agent says when this topic comes up. Keep it short and natural."
          value={draft.body}
          onChange={e => setDraft({ ...draft, body: e.target.value })}
        />
        <input className="input w-full" placeholder="Tags (comma-separated) — optional" value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} />
        <div className="pt-1">
          <button className="btn-primary" onClick={add} disabled={busy || !draft.title.trim() || !draft.body.trim()}>
            {busy ? "Saving…" : "Add article"}
          </button>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No articles yet</div>
          <div className="empty-sub">Add the FAQs callers ask most often — pricing, parking, cancellation, anything specific.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(a => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold">{a.title}</h3>
                  {a.tags.length > 0 && (
                    <div className="text-xs text-ink-muted mt-0.5">{a.tags.map(t => `#${t}`).join(" ")}</div>
                  )}
                </div>
                <button className="btn-danger" onClick={() => remove(a.id)} disabled={busy}>Delete</button>
              </div>
              <p className="text-sm whitespace-pre-wrap mt-3">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
