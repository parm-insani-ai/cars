// Smart retry scheduling for outbound campaign attempts.
//
// The naive scheduler retries every N hours regardless of what time it is now
// or what time the last attempt was. That wastes attempts — if the owner
// didn't answer at 10am, retrying at 2pm the SAME day is basically the same
// bucket of "daytime dials." Better: rotate through different windows of the
// day across the max-attempts budget, so we sample different "when might they
// actually answer" moments.
//
// Windows (Halifax-local, so we're always inside business hours no matter
// what the prospect's timezone is):
//   MORNING     9-11am    — first thing, before the day gets busy
//   MIDDAY      11am-1pm  — pre-lunch lull, front desk more likely idle
//   AFTERNOON   2pm-4pm   — post-lunch, most SMBs are dialed-in
//   LATE_AFT    4pm-6pm   — end-of-day, owner tying up loose ends
//
// Rule: pick the earliest future window we HAVEN'T tried yet, rotating so
// consecutive attempts land in different halves of the day and different
// days when possible.

type Window = { label: string; startHour: number; endHour: number };

const WINDOWS: Window[] = [
  { label: "MORNING",   startHour: 9,  endHour: 11 },
  { label: "MIDDAY",    startHour: 11, endHour: 13 },
  { label: "AFTERNOON", startHour: 14, endHour: 16 },
  { label: "LATE_AFT",  startHour: 16, endHour: 18 },
];

// Which window index to try on each attempt. Rotates diagonally so we hit a
// morning slot, then afternoon, then next-day morning, etc. — never two
// consecutive attempts in the same window on the same day.
const ATTEMPT_WINDOWS = [
  { window: 0, dayOffset: 0 },   // 1st retry: morning, today (or tomorrow if it's already past)
  { window: 2, dayOffset: 0 },   // 2nd retry: afternoon, today or tomorrow
  { window: 1, dayOffset: 1 },   // 3rd retry: midday, next day
  { window: 3, dayOffset: 1 },   // 4th retry: late afternoon, next day
  { window: 0, dayOffset: 2 },   // 5th retry: morning, 2 days out
  { window: 2, dayOffset: 2 },
  { window: 1, dayOffset: 3 },
  { window: 3, dayOffset: 3 },
];

// Return the next-attempt Date for a target, rotating through time-of-day
// windows so we sample "when the owner might actually be near the phone"
// rather than blasting the same slot every 4 hours.
export function nextAttemptTime(args: {
  attemptsSoFar: number;   // includes the just-failed attempt
  now: Date;
  timezone: string;        // prospect's tz (falls back to America/Halifax if unrecognized)
}): Date {
  const { attemptsSoFar, now, timezone } = args;
  const plan = ATTEMPT_WINDOWS[Math.min(attemptsSoFar - 1, ATTEMPT_WINDOWS.length - 1)];
  const win = WINDOWS[plan.window];

  // Compute "today" in the prospect's timezone. We format-then-parse so DST
  // and offset shifts are always correct.
  const { year, month, day, hour } = partsIn(now, timezone);

  // Start with today at the target window's start. If that's already in the
  // past AND the window's end has also passed, roll forward one day.
  let targetDay = day + plan.dayOffset;
  if (plan.dayOffset === 0 && hour >= win.endHour) targetDay += 1;

  return fromZonedParts({ year, month, day: targetDay, hour: win.startHour, timezone });
}

function partsIn(d: Date, tz: string): { year: number; month: number; day: number; hour: number } {
  // Intl gives us stable numeric fields in an arbitrary timezone.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  return {
    year:  Number(parts.year),
    month: Number(parts.month),
    day:   Number(parts.day),
    hour:  Number(parts.hour),
  };
}

function fromZonedParts(p: { year: number; month: number; day: number; hour: number; timezone: string }): Date {
  // Construct a UTC date corresponding to the given wall-clock time in tz.
  // We do this by iterating once — a Date guess, measure its offset in tz,
  // and correct. Handles DST cleanly because we always ask Intl for the
  // offset applied AT the target moment.
  const naive = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0);
  const guess = new Date(naive);
  const measured = partsIn(guess, p.timezone);
  const measuredUtc = Date.UTC(measured.year, measured.month - 1, measured.day, measured.hour, 0, 0);
  const offsetMs = measuredUtc - guess.getTime();
  return new Date(naive - offsetMs);
}
