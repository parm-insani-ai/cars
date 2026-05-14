import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/auth";

// The GTM / outreach engine is internal operator tooling. Everything under
// /outreach is admin-gated and visually fenced off from the customer-facing app.

const TABS = [
  { href: "/outreach", label: "Overview" },
  { href: "/outreach/prospects", label: "Prospects" },
  { href: "/outreach/campaigns", label: "Campaigns" },
];

export default async function OutreachLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrRedirect();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap border-b border-surface-border pb-3">
        <span className="chip-warm">Internal · GTM engine</span>
        <nav className="flex items-center gap-1 text-sm">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className="px-3 py-1.5 rounded-lg hover:bg-surface-sub text-ink">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
