"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Lightweight custom-event channel so the Topbar's hamburger can ask the
// Sidebar to slide in on mobile without a React context or a state library.
const MOBILE_NAV_OPEN_EVENT = "mobile-nav-open";

type Item = { href: string; label: string; icon: ReactNode; section: "work" | "data" | "ops" | "growth" };

// Sidebar items, in display order. Icons are inline SVG (no dep).
const ITEMS: Item[] = [
  { href: "/",             label: "Home",            icon: <HomeIcon />, section: "work" },
  { href: "/calls",        label: "Calls",           icon: <PhoneIcon />, section: "work" },
  { href: "/messages",     label: "Messages",        icon: <ChatIcon />, section: "work" },
  { href: "/appointments", label: "Appointments",    icon: <CalendarIcon />, section: "work" },
  { href: "/follow-ups",   label: "Follow-ups",      icon: <BellIcon />, section: "work" },
  { href: "/campaigns",    label: "Campaigns",       icon: <MegaphoneIcon />, section: "work" },
  { href: "/customers",    label: "Customers",       icon: <UsersIcon />, section: "data" },
  { href: "/services",     label: "Services",        icon: <TagIcon />, section: "data" },
  { href: "/providers",    label: "Staff",           icon: <UserCircleIcon />, section: "data" },
  { href: "/knowledge",    label: "Knowledge base",  icon: <BookIcon />, section: "data" },
  { href: "/agent",        label: "Voice agent",     icon: <MicIcon />, section: "ops" },
  { href: "/hours",        label: "Business hours",  icon: <ClockIcon />, section: "ops" },
  { href: "/reports",      label: "Reports",         icon: <ChartIcon />, section: "ops" },
  { href: "/settings",     label: "Settings",        icon: <CogIcon />, section: "ops" },
  { href: "/demo",         label: "Try the agent",   icon: <PlayIcon />, section: "ops" },
  { href: "/outreach",          label: "GTM overview",  icon: <RocketIcon />, section: "growth" },
  { href: "/outreach/prospects", label: "Prospects",    icon: <TargetIcon />, section: "growth" },
  { href: "/outreach/campaigns", label: "Outreach campaigns", icon: <MegaphoneIcon />, section: "growth" },
  { href: "/outreach/demos",     label: "Booked demos",  icon: <CalendarIcon />, section: "growth" },
  { href: "/outreach/simulate",  label: "Try the rep",   icon: <PlayIcon />, section: "growth" },
];

export function Sidebar({ setupComplete, showOutreach }: { setupComplete?: boolean; showOutreach?: boolean }) {
  const pathname = usePathname() ?? "";

  // Mobile drawer state — Topbar's hamburger dispatches a custom event, we
  // listen for it. Closes automatically on navigate or overlay tap.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener(MOBILE_NAV_OPEN_EVENT, handler);
    return () => window.removeEventListener(MOBILE_NAV_OPEN_EVENT, handler);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const close = () => setMobileOpen(false);

  const asideCls =
    "w-60 flex-none border-r border-surface-border bg-white h-screen overflow-y-auto p-3 flex flex-col " +
    "md:static md:translate-x-0 " +
    "fixed inset-y-0 left-0 z-50 transition-transform " +
    (mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0");

  // The operator (GTM admin) only needs the outreach tools — none of the
  // customer-facing modules (calls, appointments, customers, services, ...).
  if (showOutreach) {
    return (
      <>
        <MobileOverlay open={mobileOpen} onClose={close} />
        <aside className={asideCls}>
          <BrandHeader title="insani GTM" onClose={close} />
          <Section title="Halifax outreach">
            {ITEMS.filter(i => i.section === "growth").map(i => (
              <NavLink key={i.href} {...i} active={isActive(pathname, i.href)} onClick={close} />
            ))}
          </Section>
          <div className="mt-auto pt-4 px-2 text-[11px] text-ink-muted">
            Operator console · {new Date().getFullYear()}
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <MobileOverlay open={mobileOpen} onClose={close} />
      <aside className={asideCls}>
        <BrandHeader title="insani" onClose={close} />
        <Section title="Today">
          {ITEMS.filter(i => i.section === "work").map(i => (
            <NavLink key={i.href} {...i} active={isActive(pathname, i.href)} onClick={close} />
          ))}
        </Section>
        <Section title="Your business">
          {ITEMS.filter(i => i.section === "data").map(i => (
            <NavLink key={i.href} {...i} active={isActive(pathname, i.href)} onClick={close} />
          ))}
        </Section>
        <Section title="Set up & insights">
          {ITEMS.filter(i => i.section === "ops").map(i => (
            <NavLink
              key={i.href}
              {...i}
              active={isActive(pathname, i.href)}
              onClick={close}
              badge={i.href === "/settings" && setupComplete === false ? "Setup" : undefined}
            />
          ))}
        </Section>

        <div className="mt-auto pt-4 px-2 text-[11px] text-ink-muted">
          Powered by Claude · {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}

function MobileOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <button
      aria-label="Close menu"
      onClick={onClose}
      className="md:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
    />
  );
}

function BrandHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 px-2 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <Logo />
        <span className="font-semibold tracking-tight">{title}</span>
      </span>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="md:hidden text-ink-muted hover:text-ink p-1"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function isActive(p: string, href: string) {
  if (href === "/") return p === "/";
  return p === href || p.startsWith(href + "/");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted px-2 mb-1">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ href, label, icon, active, badge, onClick }: Item & { active: boolean; badge?: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors " +
        (active
          ? "bg-ink text-white"
          : "text-ink hover:bg-surface-sub")
      }
    >
      <span className="flex items-center gap-2">
        <span className={active ? "text-white" : "text-ink-muted"}>{icon}</span>
        <span>{label}</span>
      </span>
      {badge && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-lane-warm/15 text-amber-700">
          {badge}
        </span>
      )}
    </Link>
  );
}

// --- Icons (16x16 inline SVG) -----------------------------------------

const ic = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
function Logo() {
  return (
    <span className="w-7 h-7 rounded-lg bg-ink text-white flex items-center justify-center">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
function HomeIcon() { return ic(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></>); }
function PhoneIcon() { return ic(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.97.37 1.92.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.5 12.5 0 0 0 2.81.72A2 2 0 0 1 22 16.92z" />); }
function CalendarIcon() { return ic(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>); }
function BellIcon() { return ic(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>); }
function UsersIcon() { return ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" transform="translate(2,0)" /><circle cx="9" cy="7" r="4" /></>); }
function TagIcon() { return ic(<><path d="M20.59 13.41 13 21a2 2 0 0 1-2.83 0L3 13.83V3h10.83L21 10.17a2 2 0 0 1-.41 3.24z" /><circle cx="7.5" cy="7.5" r="1.5" /></>); }
function UserCircleIcon() { return ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M6.5 19a7 7 0 0 1 11 0" /></>); }
function BookIcon() { return ic(<><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /></>); }
function MicIcon() { return ic(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></>); }
function ClockIcon() { return ic(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>); }
function ChartIcon() { return ic(<><path d="M3 3v18h18" /><path d="M7 14l3-3 4 4 5-7" /></>); }
function CogIcon() { return ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09c0 .66.39 1.25 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" /></>); }
function PlayIcon() { return ic(<polygon points="6 4 20 12 6 20 6 4" />); }
function ChatIcon() { return ic(<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />); }
function MegaphoneIcon() { return ic(<><path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4l-8 5H5a2 2 0 0 0-2 2z" /><path d="M19 5a4 4 0 0 1 0 14" /></>); }
function RocketIcon() { return ic(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>); }
function TargetIcon() { return ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>); }
