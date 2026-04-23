import type {
  CrmAdapter,
  PhoneAdapter,
  InventoryAdapter,
  SmsAdapter,
  EmailAdapter,
  RawCallEvent,
  RawVehicle,
} from "./adapters";

// Mock adapters for dev and pilot-before-integration use. Every write is a
// no-op that returns a fake external id; every read returns static fixtures.
// These are the right surface to demo the product without any real accounts.

export const mockCrm: CrmAdapter = {
  provider: "mock",
  async createTask() {
    return { externalTaskId: `mock_task_${Date.now()}` };
  },
  async createActivity() {
    return { externalActivityId: `mock_act_${Date.now()}` };
  },
  async createAppointment() {
    return { externalApptId: `mock_appt_${Date.now()}` };
  },
  async tagAsRevlineInfluenced() {
    /* no-op */
  },
};

export const mockPhone: PhoneAdapter = {
  provider: "mock",
  async listRecentCalls(): Promise<RawCallEvent[]> {
    return [];
  },
  async getRecordingUrl() {
    return null;
  },
};

export const mockInventory: InventoryAdapter = {
  provider: "mock",
  async pullSnapshot(): Promise<RawVehicle[]> {
    return [];
  },
};

export const mockSms: SmsAdapter = {
  provider: "mock",
  async send() {
    return { externalId: `mock_sms_${Date.now()}`, sentAt: new Date() };
  },
};

export const mockEmail: EmailAdapter = {
  provider: "mock",
  async send() {
    return { externalId: `mock_email_${Date.now()}`, sentAt: new Date() };
  },
};
