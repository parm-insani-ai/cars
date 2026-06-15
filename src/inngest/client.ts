import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "insani",
});

export type Events = {
  "call/ended": { data: { callSessionId: string } };
  "call/missed": { data: { callSessionId: string } };
  "appointment/booked": { data: { appointmentId: string } };
  "appointment/no_show": { data: { appointmentId: string } };
  "followup/scheduled": { data: { followUpId: string } };
  // GTM / outreach engine
  "outreach/prospects.sourced": { data: { prospectIds: string[] } };
};
