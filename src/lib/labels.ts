// Plain-English labels and chip styles for status enums.
// Single source of truth so every screen reads the same.

type Chip = "muted" | "cool" | "warm" | "hot";

export const verticalLabel: Record<string, string> = {
  dealership: "Dealership",
  service_shop: "Auto service shop",
  wellness: "Wellness studio",
};

export const callOutcomeLabel: Record<string, string> = {
  in_progress: "Live call",
  booked: "Appointment booked",
  rescheduled: "Appointment moved",
  canceled: "Appointment canceled",
  message_taken: "Message taken",
  transferred: "Transferred to staff",
  voicemail: "Voicemail",
  hung_up: "Caller hung up",
  no_action: "No outcome",
};

export const callOutcomeChip: Record<string, Chip> = {
  in_progress: "warm",
  booked: "cool",
  rescheduled: "cool",
  message_taken: "cool",
  transferred: "warm",
  voicemail: "warm",
  canceled: "hot",
  hung_up: "hot",
  no_action: "muted",
};

export const apptStatusLabel: Record<string, string> = {
  pending: "Pending confirmation",
  confirmed: "Confirmed",
  reminded: "Reminded",
  arrived: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  canceled: "Canceled",
  rescheduled: "Rescheduled",
};

export const apptStatusChip: Record<string, Chip> = {
  pending: "warm",
  confirmed: "cool",
  reminded: "cool",
  arrived: "cool",
  completed: "cool",
  no_show: "hot",
  canceled: "hot",
  rescheduled: "muted",
};

export const followUpKindLabel: Record<string, string> = {
  pre_appt_reminder: "Reminder before appointment",
  no_show_recovery: "No-show recovery",
  missed_call_callback: "Missed call callback",
  post_call_followup: "After-call follow-up",
};

export const followUpStatusChip: Record<string, Chip> = {
  scheduled: "warm",
  sent: "cool",
  failed: "hot",
  skipped: "muted",
  canceled: "muted",
};

export const turnRoleLabel: Record<string, string> = {
  agent: "Agent",
  customer: "Caller",
  tool: "Action",
  system: "System",
};

export const providerKindLabel: Record<string, string> = {
  sales_rep: "Sales rep",
  service_advisor: "Service advisor",
  mechanic: "Mechanic / bay",
  stylist: "Stylist",
  massage_therapist: "Massage therapist",
  esthetician: "Esthetician",
  chiropractor: "Chiropractor",
  dentist: "Dentist",
  room: "Treatment room",
  bay: "Service bay",
};

// --- GTM / outreach engine ---------------------------------------------

export const prospectStatusLabel: Record<string, string> = {
  new: "Unqualified",
  qualified: "Qualified",
  disqualified: "Disqualified",
  queued: "In a campaign",
  contacted: "Contacted",
  converted: "Demo booked",
  lost: "Lost",
  do_not_call: "Do not call",
};

export const prospectStatusChip: Record<string, Chip> = {
  new: "muted",
  qualified: "cool",
  disqualified: "muted",
  queued: "warm",
  contacted: "warm",
  converted: "cool",
  lost: "hot",
  do_not_call: "hot",
};

export const dispositionLabel: Record<string, string> = {
  demo_booked: "Demo booked",
  callback_requested: "Callback requested",
  not_interested: "Not interested",
  no_answer: "No answer",
  voicemail: "Voicemail",
  wrong_number: "Wrong number",
  bad_fit: "Bad fit",
  gatekeeper_blocked: "Gatekeeper blocked",
  do_not_call: "Do not call",
};

export const dispositionChip: Record<string, Chip> = {
  demo_booked: "cool",
  callback_requested: "warm",
  not_interested: "muted",
  no_answer: "muted",
  voicemail: "muted",
  wrong_number: "hot",
  bad_fit: "muted",
  gatekeeper_blocked: "warm",
  do_not_call: "hot",
};

export function chipClass(c: Chip): string {
  switch (c) {
    case "cool": return "chip-cool";
    case "warm": return "chip-warm";
    case "hot": return "chip-hot";
    default: return "chip-muted";
  }
}

export function humanize(s: string): string {
  // Fallback humanizer: snake_case → "Snake case"
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
