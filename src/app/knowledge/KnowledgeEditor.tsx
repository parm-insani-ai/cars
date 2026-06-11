"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type A = { id: string; title: string; body: string; tags: string[] };

// Quick-start templates — the questions every business gets asked.
// Clicking one pre-fills the form so the owner just edits to fit their reality.
const TEMPLATES: Array<{ title: string; body: string; tag: string }> = [
  {
    title: "Pricing",
    body: "Our pricing depends on the service — most appointments range from $X to $Y. If you'd like an exact price for what you need, I can look it up.",
    tag: "Pricing",
  },
  {
    title: "Cancellation policy",
    body: "We ask for at least 24 hours' notice for cancellations or reschedules. Inside that window we may charge a small fee. If something urgent comes up, just let us know and we'll do our best to help.",
    tag: "Policies",
  },
  {
    title: "Parking & directions",
    body: "Free street parking is usually easy to find within a block. The entrance is on [street], look for our sign.",
    tag: "Location",
  },
  {
    title: "What to expect on a first visit",
    body: "First-time visits include a short intake so we can tailor the service. Plan for about 10 extra minutes — feel free to come a bit early to fill out forms.",
    tag: "First visit",
  },
  {
    title: "Payment methods",
    body: "We accept all major credit and debit cards, plus e-transfer. Deposits, when needed, can be paid by a text link we send you.",
    tag: "Pricing",
  },
  {
    title: "Holiday hours",
    body: "We're closed on [list holidays]. Otherwise our regular hours apply.",
    tag: "Hours",
  },
];

export function KnowledgeEditor({ articles }: { articles: A[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", tags: "" });

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setDraft({ title: t.title, body: t.body, tags: t.tag });
  }

  async function add() {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setBusy(true);
    await fetch("/api/actions/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "create",
        title: draft.title,
        body: draft.body,
        tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean),
      }),
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

  // Group articles by their first tag (or "General" if no tags).
  const grouped = new Map<string, A[]>();
  for (const a of articles) {
    const key = a.tags[0] || "General";
    const list = grouped.get(key) ?? [];
    list.push(a);
    grouped.set(key, list);
  }
  const groupedSorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="font-semibold">Add an article</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Pick a starter below to fill in the basics, then edit to fit your business.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.title}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-2.5 py-1 rounded-lg text-xs bg-white border border-surface-border hover:bg-surface-sub"
            >
              + {t.title}
            </button>
          ))}
        </div>

        <input
          className="input w-full"
          placeholder="Title — e.g. 'Cancellation policy'"
          value={draft.title}
          onChange={e => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="input-textarea w-full min-h-[120px]"
          placeholder="Body — what the agent says when this topic comes up. Keep it short and natural."
          value={draft.body}
          onChange={e => setDraft({ ...draft, body: e.target.value })}
        />
        <input
          className="input w-full"
          placeholder="Tags (comma-separated) — used to group articles"
          value={draft.tags}
          onChange={e => setDraft({ ...draft, tags: e.target.value })}
        />
        <div className="pt-1">
          <button
            className="btn-primary"
            onClick={add}
            disabled={busy || !draft.title.trim() || !draft.body.trim()}
          >
            {busy ? "Saving…" : "Add article"}
          </button>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No articles yet</div>
          <div className="empty-sub">
            Use one of the starters above to write your first article — pricing and cancellation policy are the questions Ava gets most.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedSorted.map(([groupLabel, items]) => (
            <div key={groupLabel} className="space-y-2">
              <h3 className="section-title">{groupLabel} <span className="text-ink-muted/60">({items.length})</span></h3>
              {items.map(a => (
                <div key={a.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{a.title}</h4>
                      {a.tags.length > 0 && (
                        <div className="text-xs text-ink-muted mt-0.5">
                          {a.tags.map(t => `#${t}`).join(" ")}
                        </div>
                      )}
                    </div>
                    <button className="btn-danger" onClick={() => remove(a.id)} disabled={busy}>Delete</button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-3">{a.body}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
