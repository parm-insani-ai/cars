"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; section: "work" | "data" | "ops" };

const ITEMS: Item[] = [
  { href: "/calls", label: "Calls", section: "work" },
  { href: "/appointments", label: "Appointments", section: "work" },
  { href: "/follow-ups", label: "Follow-ups", section: "work" },
  { href: "/customers", label: "Customers", section: "data" },
  { href: "/services", label: "Services", section: "data" },
  { href: "/providers", label: "Providers", section: "data" },
  { href: "/knowledge", label: "Knowledge base", section: "data" },
  { href: "/agent", label: "Agent", section: "ops" },
  { href: "/hours", label: "Hours", section: "ops" },
  { href: "/reports", label: "Reports", section: "ops" },
  { href: "/demo", label: "Demo simulator", section: "ops" },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="w-56 flex-none border-r border-surface-border bg-white min-h-screen p-3 hidden md:block">
      <div className="mb-4 px-2">
        <Link href="/" className="font-semibold tracking-tight">Frontdesk</Link>
      </div>
      <Section title="Work">
        {ITEMS.filter(i => i.section === "work").map(i => (
          <NavLink key={i.href} href={i.href} label={i.label} active={isActive(pathname, i.href)} />
        ))}
      </Section>
      <Section title="Data">
        {ITEMS.filter(i => i.section === "data").map(i => (
          <NavLink key={i.href} href={i.href} label={i.label} active={isActive(pathname, i.href)} />
        ))}
      </Section>
      <Section title="Ops">
        {ITEMS.filter(i => i.section === "ops").map(i => (
          <NavLink key={i.href} href={i.href} label={i.label} active={isActive(pathname, i.href)} />
        ))}
      </Section>
    </aside>
  );
}

function isActive(p: string, href: string) {
  if (href === "/") return p === "/";
  return p === href || p.startsWith(href + "/");
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted px-2 mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "block px-2 py-1.5 rounded-md text-sm transition-colors " +
        (active ? "bg-ink text-white" : "text-ink hover:bg-surface-sub")
      }
    >
      {label}
    </Link>
  );
}
