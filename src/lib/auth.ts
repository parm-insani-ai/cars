import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "revline_session";

// Dev-mode session: cookie carries a userId. In production, swap this for
// WorkOS — the surface area below stays the same.
export async function getCurrentUser() {
  const c = cookies().get(SESSION_COOKIE)?.value;
  if (!c) return null;
  return prisma.user.findUnique({
    where: { id: c },
    include: { rooftop: true },
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

export async function requireRole(roles: Array<"rep" | "bdc" | "sales_manager" | "gm" | "admin">) {
  const u = await requireUser();
  if (!roles.includes(u.role as any)) throw new Error("FORBIDDEN");
  return u;
}
