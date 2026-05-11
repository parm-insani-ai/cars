// A vertical pack bundles the per-vertical defaults: agent personality,
// greeting, service catalog seed, provider seed, knowledge base seed,
// follow-up policy. New verticals (legal, real estate, home services) get
// added here without touching core code.

import type { Vertical } from "@prisma/client";

export type ServiceSeed = {
  name: string;
  category: string;
  durationMin: number;
  priceUsd?: number;
  description?: string;
  providerKind?: string;
};

export type ProviderSeed = {
  name: string;
  kind: string;
  shifts: Array<{ dayOfWeek: number; startMin: number; endMin: number }>;
};

export type KnowledgeSeed = {
  title: string;
  body: string;
  tags?: string[];
};

export type Pack = {
  vertical: Vertical;
  defaultGreeting: (businessName: string) => string;
  defaultPersonality: string;
  services: ServiceSeed[];
  providers: ProviderSeed[];
  knowledge: KnowledgeSeed[];
  followUpPolicy: {
    preApptReminderHoursBefore: number;       // 24 default
    noShowRecoveryMinutesAfter: number;       // 15 default
    missedCallCallbackMinutesAfter: number;   // 10 default
    firstCallFollowupHoursAfter: number | null;
  };
};
