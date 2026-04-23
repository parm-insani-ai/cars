import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rooftop = await prisma.rooftop.findFirst();
  if (!rooftop) return <div>No rooftop yet.</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Integrations</h1>
      <p className="text-sm text-ink-muted">
        Connectors for this rooftop. Mock adapters are active until real credentials are configured.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="CRM" status={rooftop.crmProvider} note="Writebacks: tasks, activities, appointments. VinSolutions first." />
        <Card title="Phone" status={rooftop.phoneProvider} note="Read-only. Pulls call logs, recordings, missed-call events." />
        <Card title="Inventory" status={rooftop.inventoryProvider} note="Nightly snapshot. HomeNet or dealer CSV." />
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-medium">AI voice &amp; SOP</h2>
        <p className="text-xs text-ink-muted">This is cached as the stable prefix of every AI system prompt — don't edit it per-request.</p>
        <pre className="bg-surface-sub p-3 rounded-md text-xs whitespace-pre-wrap">{rooftop.voiceProfile ?? "(using default voice)"}</pre>
        <pre className="bg-surface-sub p-3 rounded-md text-xs whitespace-pre-wrap">TCPA opt-out line: {rooftop.consentTemplate ?? "Reply STOP to opt out."}</pre>
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="font-medium">Test endpoints</h2>
        <ul className="text-sm space-y-1 font-mono">
          <li><code>POST /api/webhooks/leads</code> (JSON or ADF XML)</li>
          <li><code>POST /api/webhooks/phone</code></li>
          <li><code>POST /api/webhooks/service</code></li>
        </ul>
        <p className="text-xs text-ink-muted">Use rooftopId <code className="font-mono">{rooftop.id}</code>.</p>
      </div>
    </div>
  );
}

function Card({ title, status, note }: { title: string; status: string; note: string }) {
  const isMock = status === "mock";
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <span className={isMock ? "chip-muted" : "chip-cool"}>{status}</span>
      </div>
      <p className="text-xs text-ink-muted">{note}</p>
    </div>
  );
}
