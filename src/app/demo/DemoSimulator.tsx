"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stock = { stockNumber: string; label: string };

export function DemoSimulator({ rooftopId, sampleStockNumbers }: { rooftopId: string; sampleStockNumbers: Stock[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <LeadCard rooftopId={rooftopId} stocks={sampleStockNumbers} />
      <MissedCallCard rooftopId={rooftopId} />
      <ServiceROCard rooftopId={rooftopId} />
      <SmsReplyCard rooftopId={rooftopId} />
    </div>
  );
}

function Card({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-xs text-ink-muted">{blurb}</p>
      </div>
      {children}
    </div>
  );
}

function LeadCard({ rooftopId, stocks }: { rooftopId: string; stocks: Stock[] }) {
  const [first, setFirst] = useState("Casey");
  const [last, setLast] = useState("Demo");
  const [phone, setPhone] = useState("+14155550900");
  const [stock, setStock] = useState(stocks[0]?.stockNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const router = useRouter();

  async function fire() {
    setBusy(true);
    setOut(null);
    const res = await fetch("/api/webhooks/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rooftopId,
        source: "cargurus",
        customer: { firstName: first, lastName: last, phone },
        vehicle: stock ? { stockNumber: stock } : undefined,
      }),
    });
    const j = await res.json();
    setBusy(false);
    setOut(res.ok ? `Lead created: ${j.leadId}` : `Error: ${JSON.stringify(j)}`);
    router.refresh();
  }

  return (
    <Card title="New CarGurus lead" blurb="Triggers ingest + AI first-response draft.">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input className="border border-surface-border rounded-md px-2 h-9" placeholder="First" value={first} onChange={(e) => setFirst(e.target.value)} />
        <input className="border border-surface-border rounded-md px-2 h-9" placeholder="Last" value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <input className="border border-surface-border rounded-md px-2 h-9 w-full text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <select className="border border-surface-border rounded-md px-2 h-9 w-full text-sm" value={stock} onChange={(e) => setStock(e.target.value)}>
        <option value="">No specific vehicle</option>
        {stocks.map((s) => (
          <option key={s.stockNumber} value={s.stockNumber}>{s.label} (#{s.stockNumber})</option>
        ))}
      </select>
      <button className="btn-primary w-full" onClick={fire} disabled={busy}>
        {busy ? "Firing…" : "Fire lead webhook"}
      </button>
      {out && <p className="text-xs text-ink-muted">{out}</p>}
    </Card>
  );
}

function MissedCallCard({ rooftopId }: { rooftopId: string }) {
  const [phone, setPhone] = useState("+14155550901");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const router = useRouter();

  async function fire() {
    setBusy(true);
    setOut(null);
    const res = await fetch("/api/webhooks/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rooftopId,
        direction: "inbound",
        outcome: "missed",
        fromNumber: phone,
        toNumber: "+14155557777",
        startedAt: new Date().toISOString(),
        durationSec: 22,
        department: "sales",
      }),
    });
    const j = await res.json();
    setBusy(false);
    setOut(res.ok ? `Call: ${j.callId}` : `Error: ${JSON.stringify(j)}`);
    router.refresh();
  }

  return (
    <Card title="Missed sales call" blurb="Triggers recovery workflow + drafted callback SMS.">
      <input className="border border-surface-border rounded-md px-2 h-9 w-full text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button className="btn-primary w-full" onClick={fire} disabled={busy}>
        {busy ? "Firing…" : "Fire missed-call webhook"}
      </button>
      {out && <p className="text-xs text-ink-muted">{out}</p>}
    </Card>
  );
}

function ServiceROCard({ rooftopId }: { rooftopId: string }) {
  const [first, setFirst] = useState("Robin");
  const [last, setLast] = useState("Servicedrop");
  const [phone, setPhone] = useState("+14155550902");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const router = useRouter();

  async function fire() {
    setBusy(true);
    setOut(null);
    const res = await fetch("/api/webhooks/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rooftopId,
        roNumber: `RO-${Date.now()}`,
        openedAt: new Date().toISOString(),
        customer: { firstName: first, lastName: last, phone },
        vehicle: {
          year: 2020,
          make: "Toyota",
          model: "RAV4",
          mileage: 71000,
          estimatedPayoff: 8500,
          estimatedValue: 22000,
        },
        repairTotal: 1450,
      }),
    });
    const j = await res.json();
    setBusy(false);
    setOut(res.ok ? `RO created: ${j.serviceROId}` : `Error: ${JSON.stringify(j)}`);
    router.refresh();
  }

  return (
    <Card title="Service RO opened" blurb="Equity + inventory match → service-drive opportunity.">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input className="border border-surface-border rounded-md px-2 h-9" placeholder="First" value={first} onChange={(e) => setFirst(e.target.value)} />
        <input className="border border-surface-border rounded-md px-2 h-9" placeholder="Last" value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <input className="border border-surface-border rounded-md px-2 h-9 w-full text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button className="btn-primary w-full" onClick={fire} disabled={busy}>
        {busy ? "Firing…" : "Fire service-RO webhook"}
      </button>
      {out && <p className="text-xs text-ink-muted">{out}</p>}
    </Card>
  );
}

function SmsReplyCard({ rooftopId }: { rooftopId: string }) {
  const [body, setBody] = useState("Yeah, can we do tomorrow at 11am?");
  const [phone, setPhone] = useState("+14155550201");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const router = useRouter();

  async function fire() {
    setBusy(true);
    setOut(null);
    const res = await fetch("/api/webhooks/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rooftopId, fromNumber: phone, body }),
    });
    const j = await res.json();
    setBusy(false);
    setOut(res.ok ? `Classified: intent=${j.intent}, urgency=${j.urgency}` : `Error: ${JSON.stringify(j)}`);
    router.refresh();
  }

  return (
    <Card title="Inbound SMS reply" blurb="Classifies intent (Haiku) and updates the lead status.">
      <input className="border border-surface-border rounded-md px-2 h-9 w-full text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <textarea className="border border-surface-border rounded-md px-2 py-1.5 w-full text-sm min-h-[60px]" value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn-primary w-full" onClick={fire} disabled={busy}>
        {busy ? "Firing…" : "Fire inbound SMS"}
      </button>
      {out && <p className="text-xs text-ink-muted">{out}</p>}
    </Card>
  );
}
