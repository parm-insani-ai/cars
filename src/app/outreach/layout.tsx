import { requireAdminOrRedirect } from "@/lib/auth";

// The GTM / outreach engine is internal operator tooling — admin-gated.
// Navigation lives in the sidebar, so this layout is just the access gate.

export default async function OutreachLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrRedirect();
  return <>{children}</>;
}
