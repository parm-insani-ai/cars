"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "agent" | "customer"; text: string };

export function DemoChat({ businessId, greeting, businessName }: { businessId: string; greeting: string; businessName: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, busy]);

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

  if (!sessionId) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.97.37 1.92.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.5 12.5 0 0 0 2.81.72A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <div className="empty-title">Place a test call to your agent</div>
        <div className="empty-sub">No phone needed. You type what a real caller would say, the agent responds the same way it would on a phone call.</div>
        <button className="btn-primary" onClick={start} disabled={busy}>
          {busy ? "Connecting…" : `Call ${businessName}`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="card p-5 space-y-2 min-h-[300px] max-h-[60vh] overflow-y-auto">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "agent" ? "bubble-agent" : "bubble-customer"}>
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{t.role === "agent" ? "Agent" : "You"}</div>
            <div className="text-sm whitespace-pre-wrap">{t.text}</div>
          </div>
        ))}
        {busy && <div className="text-xs text-ink-muted italic px-1">Agent is thinking…</div>}
        {ended && <div className="text-xs text-ink-muted italic px-1">— call ended —</div>}
      </div>

      {!ended && (
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Type what the caller would say…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            disabled={busy}
            autoFocus
          />
          <button className="btn-primary" onClick={send} disabled={busy || !input.trim()}>Send</button>
          <button className="btn-secondary" onClick={end} disabled={busy}>Hang up</button>
        </div>
      )}

      {sessionId && (
        <p className="text-xs text-ink-muted text-center">
          <a className="text-lane hover:underline" href={`/calls/${sessionId}`}>View this call's transcript and tool calls →</a>
        </p>
      )}
    </div>
  );
}
