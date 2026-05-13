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
