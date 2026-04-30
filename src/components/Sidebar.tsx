"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; section: "work" | "data" | "ops" };

const ITEMS: Item[] = [
  { href: "/rep/me", label: "My feed", section: "work" },
  { href: "/leads", label: "Leads", section: "work" },
  { href: "/appointments", label: "Appointments", section: "work" },
  { href: "/service", label: "Service drive", section: "work" },
  { href: "/customers", label: "Customers", section: "data" },
  { href: "/inventory", label: "Inventory", section: "data" },
  { href: "/manager", label: "Manager", section: "ops" },
  { href: "/reports", label: "Reports", section: "ops" },
  { href: "/onboarding", label: "Onboarding", section: "ops" },
  { href: "/settings", label: "Settings", section: "ops" },
  { href: "/demo", label: "Demo simulator", section: "ops" },
];

export function Sidebar({ currentRepId }: { currentRepId?: string | null }) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-56 flex-none border-r border-surface-border bg-white min-h-screen p-3 hidden md:block">
      <div className="mb-4 px-2">
        <Link href="/" className="font-semibold tracking-tight">Revline</Link>
      </div>
      <Section title="Work">
        {ITEMS.filter((i) => i.section === "work").map((i) => (
          <NavLink
            key={i.href}
            href={i.href === "/rep/me" && currentRepId ? `/rep/${currentRepId}` : i.href}
            label={i.label}
            active={isActive(pathname, i.href === "/rep/me" && currentRepId ? `/rep/${currentRepId}` : i.href)}
          />
        ))}
      </Section>
      <Section title="Data">
        {ITEMS.filter((i) => i.section === "data").map((i) => (
          <NavLink key={i.href} href={i.href} label={i.label} active={isActive(pathname, i.href)} />
        ))}
      </Section>
      <Section title="Ops">
        {ITEMS.filter((i) => i.section === "ops").map((i) => (
          <NavLink key={i.href} href={i.href} label={i.label} active={isActive(pathname, i.href)} />
        ))}
      </Section>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
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
        (active
          ? "bg-ink text-white"
          : "text-ink hover:bg-surface-sub")
      }
    >
      {label}
    </Link>
  );
}
