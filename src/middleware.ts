import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/signup",
  "/api/voice/llm",
  "/api/voice/webhook",
  "/api/voice/simulate",
  "/api/outreach/llm",
  "/api/outreach/webhook",
  "/api/health",
  "/api/webhooks/sms",
  "/api/webhooks/stripe",
  "/api/auth/google/start",
  "/api/auth/google/callback",
  "/api/mock-checkout/confirm",
  "/api/inngest",
  "/api/cron/outreach-dispatch",
  "/api/cron/outreach-digest",
  "/manifest.json",
  "/icon.svg",
  "/apple-icon",
  "/mock-checkout",
  "/deposit",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
