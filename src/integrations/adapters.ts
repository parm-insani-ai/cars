// Adapter interfaces. Every integration lives behind one of these so we can
// ship a pilot using mock adapters and swap to real providers later without
// touching domain code.

export interface CrmAdapter {
  readonly provider: "vinsolutions" | "dealersocket" | "mock";
  // Writebacks we care about for MVP:
  createTask(args: { rooftopId: string; externalCustomerId?: string; title: string; body?: string; dueAt?: Date }): Promise<{ externalTaskId: string }>;
  createActivity(args: { rooftopId: string; externalLeadId?: string; kind: "sms" | "email" | "note" | "appointment"; body: string }): Promise<{ externalActivityId: string }>;
  createAppointment(args: { rooftopId: string; externalCustomerId: string; scheduledAt: Date; repId?: string; notes?: string }): Promise<{ externalApptId: string }>;
  tagAsRevlineInfluenced(args: { rooftopId: string; externalCustomerId: string }): Promise<void>;
}

export interface PhoneAdapter {
  readonly provider: "callrevu" | "carwars" | "dialpad" | "ringcentral" | "mock";
  // Pull-based: for providers that don't push webhooks, we poll on a schedule.
  // Push-based providers post to /api/webhooks/phone/:provider.
  listRecentCalls?(args: { rooftopId: string; sinceMs: number }): Promise<RawCallEvent[]>;
  getRecordingUrl?(externalCallId: string): Promise<string | null>;
}

export interface InventoryAdapter {
  readonly provider: "homenet" | "csv" | "mock";
  pullSnapshot(rooftopId: string): Promise<RawVehicle[]>;
}

export interface SmsAdapter {
  readonly provider: "twilio" | "mock";
  send(args: { rooftopId: string; to: string; body: string }): Promise<{ externalId: string; sentAt: Date }>;
}

export interface EmailAdapter {
  readonly provider: "sendgrid" | "mock";
  send(args: { rooftopId: string; to: string; subject: string; body: string }): Promise<{ externalId: string; sentAt: Date }>;
}

// --- Raw types coming from provider-specific clients ----------------------

export type RawCallEvent = {
  externalId: string;
  direction: "inbound" | "outbound";
  outcome: "connected" | "missed" | "voicemail" | "abandoned";
  fromNumber: string;
  toNumber: string;
  startedAt: Date;
  endedAt?: Date;
  durationSec?: number;
  repExternalId?: string;
  department?: string;
  recordingUrl?: string;
  transcriptText?: string;
};

export type RawVehicle = {
  stockNumber: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyType?: string;
  fuel?: string;
  mileage?: number;
  price: number;
  cost?: number;
  isNew: boolean;
  photoUrl?: string;
};
