// Calendar adapter. Real Google implementation lights up when
// GOOGLE_OAUTH_CLIENT_ID is set AND a business has stored OAuth tokens.
// Otherwise the mock (no-op) is used, so booking still works end-to-end.

import { prisma } from "@/lib/prisma";

export interface CalendarAdapter {
  readonly provider: "google" | "mock";
  createEvent(args: CreateEventArgs): Promise<{ externalId: string } | null>;
  updateEvent(externalId: string, patch: PatchEventArgs): Promise<void>;
  deleteEvent(externalId: string): Promise<void>;
  // Returns array of busy intervals [start,end] in the requested window.
  // null means "calendar not connected for this business".
  getBusy(businessId: string, start: Date, end: Date): Promise<Array<{ start: Date; end: Date }> | null>;
}

export type CreateEventArgs = {
  businessId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  description?: string;
  attendeeEmail?: string;
};

export type PatchEventArgs = {
  businessId: string;
  startAt?: Date;
  endAt?: Date;
  title?: string;
};

const mock: CalendarAdapter = {
  provider: "mock",
  async createEvent() { return null; },
  async updateEvent() { /* no-op */ },
  async deleteEvent() { /* no-op */ },
  async getBusy() { return null; },
};

export function calendarAdapter(): CalendarAdapter {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) return mock;
  return google;
}

// --- Real Google Calendar -----------------------------------------------

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

async function getValidAccessToken(businessId: string): Promise<string | null> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiresAt: true },
  });
  if (!biz?.googleRefreshToken) return null;

  const expiresSoon =
    !biz.googleTokenExpiresAt || biz.googleTokenExpiresAt.getTime() < Date.now() + 60_000;
  if (!expiresSoon && biz.googleAccessToken) return biz.googleAccessToken;

  // Refresh.
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: biz.googleRefreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    console.error("google token refresh failed", await res.text());
    return null;
  }
  const j = await res.json();
  const accessToken: string = j.access_token;
  const expiresIn: number = j.expires_in ?? 3600;
  await prisma.business.update({
    where: { id: businessId },
    data: {
      googleAccessToken: accessToken,
      googleTokenExpiresAt: new Date(Date.now() + (expiresIn - 30) * 1000),
    },
  });
  return accessToken;
}

const google: CalendarAdapter = {
  provider: "google",

  async createEvent(args) {
    const accessToken = await getValidAccessToken(args.businessId);
    if (!accessToken) return null;
    const calId = await calendarId(args.businessId);
    const body = {
      summary: args.title,
      description: args.description,
      start: { dateTime: args.startAt.toISOString() },
      end: { dateTime: args.endAt.toISOString() },
      attendees: args.attendeeEmail ? [{ email: args.attendeeEmail }] : undefined,
    };
    const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("google createEvent failed", await res.text());
      return null;
    }
    const j = await res.json();
    return { externalId: j.id };
  },

  async updateEvent(externalId, patch) {
    const accessToken = await getValidAccessToken(patch.businessId);
    if (!accessToken) return;
    const calId = await calendarId(patch.businessId);
    const body: any = {};
    if (patch.title) body.summary = patch.title;
    if (patch.startAt) body.start = { dateTime: patch.startAt.toISOString() };
    if (patch.endAt) body.end = { dateTime: patch.endAt.toISOString() };
    await fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${externalId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(err => console.error("google updateEvent failed", err));
  },

  async deleteEvent(externalId) {
    // delete needs businessId — we don't have it here in this signature. For
    // MVP, support delete only by querying every business that has this
    // event id (cheap because events with the same external id are unique).
    const appt = await prisma.appointment.findFirst({
      where: { externalCalEventId: externalId },
      select: { businessId: true },
    });
    if (!appt) return;
    const accessToken = await getValidAccessToken(appt.businessId);
    if (!accessToken) return;
    const calId = await calendarId(appt.businessId);
    await fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(err => console.error("google deleteEvent failed", err));
  },

  async getBusy(businessId, start, end) {
    const accessToken = await getValidAccessToken(businessId);
    if (!accessToken) return null;
    const calId = await calendarId(businessId);
    const res = await fetch(`${CAL_API}/freeBusy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calId }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const busy = j.calendars?.[calId]?.busy ?? [];
    return busy.map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }));
  },
};

async function calendarId(businessId: string): Promise<string> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { googleCalendarId: true },
  });
  return biz?.googleCalendarId || "primary";
}
