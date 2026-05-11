"use client";

import { useState } from "react";

type Turn = { role: "agent" | "customer"; text: string };

export function DemoChat({ businessId, greeting, businessName }: { businessId: string; greeting: string; businessName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);

  async function start() {
    setBusy(true);
    setEnded(false);
    setTurns([]);
    const res = await fetch("/api/voice/simulate?op=start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.callSessionId) {
      setSessionId(j.callSessionId);
      setTurns([{ role: "agent", text: j.greeting ?? greeting }]);
    }
  }

  async function send() {
    if (!sessionId || !input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setTurns(prev => [...prev, { role: "customer", text }]);
    setBusy(true);
    const res = await fetch("/api/voice/simulate?op=turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callSessionId: sessionId, text }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.reply) setTurns(prev => [...prev, { role: "agent", text: j.reply }]);
    if (j.ended) setEnded(true);
  }

  async function end() {
    if (!sessionId) return;
    setBusy(true);
    await fetch("/api/voice/simulate?op=end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callSessionId: sessionId }),
    });
    setBusy(false);
    setEnded(true);
  }

  return (
    <div className="space-y-3">
      {!sessionId ? (
        <button className="btn-primary" onClick={start} disabled={busy}>
          {busy ? "Starting…" : `Call ${businessName}`}
        </button>
      ) : (
        <>
          <div className="card p-4 space-y-2 min-h-[300px]">
            {turns.map((t, i) => (
              <div key={i} className={"text-sm p-2 rounded-md " + (t.role === "agent" ? "bg-ink/5" : "bg-lane/10")}>
                <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{t.role}</div>
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            ))}
            {busy && <div className="text-xs text-ink-muted italic">Agent is thinking…</div>}
            {ended && <div className="text-xs text-ink-muted italic">— call ended —</div>}
          </div>

          {!ended && (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-surface-border rounded-md px-3 h-9 text-sm"
                placeholder="Type what the caller would say…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(); }}
                disabled={busy}
              />
              <button className="btn-primary" onClick={send} disabled={busy || !input.trim()}>Send</button>
              <button className="btn-secondary" onClick={end} disabled={busy}>Hang up</button>
            </div>
          )}

          {sessionId && (
            <p className="text-xs text-ink-muted">
              Call session: <a className="text-lane hover:underline" href={`/calls/${sessionId}`}>view transcript and tool calls →</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
