"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "rep" | "prospect" | "note"; text: string };

export function SimulatorChat({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [campaignId, setCampaignId] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only the real rep/prospect turns get sent to the model (notes are local).
  function conversation(list: Turn[]) {
    return list
      .filter(t => t.role !== "note")
      .map(t => ({ role: t.role as "rep" | "prospect", text: t.text }));
  }

  async function send(history: Turn[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/outreach/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaignId || undefined, messages: conversation(history) }),
      });
      const j = await res.json();
      const added: Turn[] = [];
      if (j.reply) added.push({ role: "rep", text: j.reply });
      for (const tc of j.toolCalls ?? []) {
        added.push({ role: "note", text: `→ ${tc.name}(${JSON.stringify(tc.input)})` });
      }
      setTurns(prev => [...prev, ...added]);
    } catch {
      setTurns(prev => [...prev, { role: "note", text: "(error reaching the rep — is the app running?)" }]);
    } finally {
      setBusy(false);
    }
  }

  // Kick off the rep's opener whenever the simulation (re)starts.
  function restart() {
    setTurns([]);
    setInput("");
    void send([]);
  }

  // Start once on mount, and again whenever the campaign changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    restart();
  }, [campaignId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "prospect", text }];
    setTurns(next);
    setInput("");
    void send(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Pitch from campaign:</span>
        <select className="input" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
          <option value="">Default pitch</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary ml-auto" onClick={restart} disabled={busy}>Restart</button>
      </div>

      <p className="text-xs text-ink-muted">
        You're playing the prospect — a Halifax day spa, "Bloom Day Spa". Reply as them and see how the rep handles it.
      </p>

      <div ref={scrollRef} className="card p-4 h-[460px] overflow-y-auto space-y-3">
        {turns.map((t, i) => (
          <div key={i} className={bubble(t.role)}>
            <div className="text-[10px] uppercase tracking-wider mb-1 opacity-60">
              {t.role === "rep" ? "AI rep" : t.role === "prospect" ? "You (prospect)" : "Action"}
            </div>
            <div className="text-sm whitespace-pre-wrap">{t.text}</div>
          </div>
        ))}
        {busy && <div className="text-xs text-ink-muted">…</div>}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Reply as the prospect…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          disabled={busy}
        />
        <button className="btn-primary" onClick={submit} disabled={busy || !input.trim()}>Send</button>
      </div>
    </div>
  );
}

function bubble(role: Turn["role"]) {
  if (role === "rep") return "bubble-agent";
  if (role === "prospect") return "bubble-customer";
  return "bubble-tool";
}
