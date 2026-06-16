import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { isAdminEmail } from "@/lib/env";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same response for "no user" and "wrong password" so we don't leak which.
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Upgrade existing accounts to admin if their email is in the allowlist
  // — covers the case where you (the operator) signed up before adding
  // your email to ADMIN_EMAILS.
  if (user.role !== "admin" && isAdminEmail(email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
