import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "revline",
  // Event taxonomy. Extend as needed — keep names stable.
});

export type Events = {
  "lead/created": { data: { leadId: string } };
  "lead/reply.received": { data: { leadId: string; messageId: string } };
  "call/missed": { data: { callId: string } };
  "service-ro/created": { data: { serviceROId: string } };
  "task/escalate": { data: { taskId: string } };
};
