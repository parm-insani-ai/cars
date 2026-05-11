// Calendar adapter. Real implementations write to provider-specific calendars
// (Google, Cal.com, Microsoft, Apple/CalDAV). MVP uses the mock — our DB is
// the source of truth.

export interface CalendarAdapter {
  readonly provider: "google" | "cal_com" | "mock";
  createEvent(args: CalendarEvent): Promise<{ externalId: string }>;
  updateEvent(externalId: string, patch: Partial<CalendarEvent>): Promise<void>;
  deleteEvent(externalId: string): Promise<void>;
}

export type CalendarEvent = {
  calendarId: string;          // provider-side calendar id (e.g. Google calendar)
  title: string;
  startAt: Date;
  endAt: Date;
  description?: string;
  attendees?: { email: string; name?: string }[];
  location?: string;
};

const mock: CalendarAdapter = {
  provider: "mock",
  async createEvent() {
    return { externalId: `mock_evt_${Date.now()}` };
  },
  async updateEvent() { /* no-op */ },
  async deleteEvent() { /* no-op */ },
};

// Stub for Google. Real implementation wires the Google APIs Node client and
// per-business OAuth credentials. Falls back to mock if not configured.
const googleStub: CalendarAdapter = {
  provider: "google",
  async createEvent() {
    // TODO: implement when GOOGLE_OAUTH_* is configured.
    return { externalId: `google_stub_${Date.now()}` };
  },
  async updateEvent() { /* TODO */ },
  async deleteEvent() { /* TODO */ },
};

export function calendarAdapter(): CalendarAdapter {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID) return googleStub;
  return mock;
}
