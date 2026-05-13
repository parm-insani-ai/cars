import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

// Kicks off the Google OAuth flow. We carry the businessId through `state`
// so the callback can attribute tokens to the right business.

export async function GET() {
  const user = await requireUser();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "google_oauth_not_configured" }, { status: 400 });
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state: user.businessId,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
