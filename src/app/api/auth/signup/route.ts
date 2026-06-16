import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isAdminEmail } from "@/lib/env";

const Body = z.object({
  businessName: z.string().min(1).max(120),
  yourName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // One signup = one Account + one Business + one owner User. Owners can
  // invite staff later from inside the app.
  const account = await prisma.account.create({
    data: { name: parsed.data.businessName },
  });
  const business = await prisma.business.create({
    data: {
      accountId: account.id,
      name: parsed.data.businessName,
      vertical: "service_shop",
      agentConfig: {
        create: {
          greeting: "",
          personality: "",
        },
      },
    },
  });
  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      email,
      name: parsed.data.yourName,
      role: isAdminEmail(email) ? "admin" : "owner",
      passwordHash,
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
