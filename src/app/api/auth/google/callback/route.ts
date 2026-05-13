import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");   // businessId
  const error = url.searchParams.get("error");
  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?google=error`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/settings?google=token_failed`);
  }
  const t: any = await tokenRes.json();
  const expiresIn = t.expires_in ?? 3600;

  await prisma.business.update({
    where: { id: state },
    data: {
      googleAccessToken: t.access_token,
      googleRefreshToken: t.refresh_token,
      googleTokenExpiresAt: new Date(Date.now() + (expiresIn - 30) * 1000),
      googleCalendarId: "primary",
    },
  });

  return NextResponse.redirect(`${baseUrl}/settings?google=connected`);
}
