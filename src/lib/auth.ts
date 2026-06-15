import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "insani_session";

export async function getCurrentUser() {
  const c = cookies().get(SESSION_COOKIE)?.value;
  if (!c) return null;
  return prisma.user.findUnique({
    where: { id: c },
    include: { business: true },
  });
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireUserOrRedirect(redirectUrl = "/login") {
  const u = await getCurrentUser();
  if (!u) {
    const { redirect } = await import("next/navigation");
    redirect(redirectUrl);
  }
  return u!;
}

export async function requireRole(roles: Array<"owner" | "manager" | "staff" | "admin">) {
  const u = await requireUser();
  if (!roles.includes(u.role as any)) throw new Error("FORBIDDEN");
  return u;
}

// The GTM / outreach engine is internal operator tooling, gated to admins so
// it never surfaces in a customer's nav. Redirects non-admins to the app home.
export async function requireAdminOrRedirect(redirectUrl = "/") {
  const u = await requireUserOrRedirect();
  if (u.role !== "admin") {
    const { redirect } = await import("next/navigation");
    redirect(redirectUrl);
  }
  return u;
}
