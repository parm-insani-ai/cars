import type { Pack } from "./types";

const weekdayShift = (start = 8, end = 18) =>
  [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startMin: start * 60, endMin: end * 60 }));

export const serviceShopPack: Pack = {
  vertical: "service_shop",
  defaultGreeting: (name) => `${name}, this is the front desk. What's going on with your car?`,
  defaultPersonality: `Direct, knowledgeable, friendly. You don't oversell. Capture the problem the customer describes in their own words — don't diagnose over the phone unless asked. Always get year/make/model, mileage, and a callback number.`,
  services: [
    { name: "Oil change", category: "maintenance", durationMin: 30, priceUsd: 79, providerKind: "mechanic", description: "Synthetic blend oil + filter, multi-point inspection. About 30 minutes." },
    { name: "Brake inspection", category: "diagnostic", durationMin: 45, priceUsd: 49, providerKind: "mechanic", description: "Visual + measurement of pads and rotors. Quote follows." },
    { name: "Check engine light diagnostic", category: "diagnostic", durationMin: 60, priceUsd: 129, providerKind: "mechanic", description: "OBD-II scan and tech diagnosis. Credited toward repair if you proceed." },
    { name: "Tire rotation", category: "maintenance", durationMin: 30, priceUsd: 35, providerKind: "mechanic", description: "Rotation, torque, and pressure check. Includes visual tread wear check." },
    { name: "AC system check", category: "diagnostic", durationMin: 60, priceUsd: 89, providerKind: "mechanic", description: "Pressure check and leak inspection. Quote for repair follows." },
    { name: "General drop-off", category: "general", durationMin: 30, providerKind: "mechanic", description: "Drop the car off and a technician will assess. Use this if you're not sure what's wrong." },
  ],
  providers: [
    { name: "Bay 1", kind: "mechanic", shifts: weekdayShift() },
    { name: "Bay 2", kind: "mechanic", shifts: weekdayShift() },
    { name: "Bay 3", kind: "mechanic", shifts: weekdayShift() },
  ],
  knowledge: [
    { title: "Diagnostic fee policy", body: "We charge a flat diagnostic fee for check-engine and AC work. That fee is credited toward the repair if you proceed.", tags: ["pricing"] },
    { title: "Loaners", body: "We don't have loaners but we offer Uber/Lyft credits up to $25 for jobs over 4 hours.", tags: ["service"] },
    { title: "Warranty", body: "All repairs come with a 12-month / 12,000-mile warranty on parts and labor.", tags: ["warranty"] },
    { title: "Payment methods", body: "We accept cash, all major cards, Apple Pay, and Affirm for jobs over $300.", tags: ["pricing"] },
  ],
  followUpPolicy: {
    preApptReminderHoursBefore: 24,
    noShowRecoveryMinutesAfter: 30,
    missedCallCallbackMinutesAfter: 10,
    firstCallFollowupHoursAfter: null,
  },
};
