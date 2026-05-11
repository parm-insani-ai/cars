import type { Pack } from "./types";

const weekdayShift = (start = 9, end = 19) =>
  [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startMin: start * 60, endMin: end * 60 }));
const saturdayShift = (start = 9, end = 17) => [{ dayOfWeek: 6, startMin: start * 60, endMin: end * 60 }];

export const dealershipPack: Pack = {
  vertical: "dealership",
  defaultGreeting: (name) => `Thanks for calling ${name}, this is the front desk — how can I help?`,
  defaultPersonality: `Warm, low-pressure, and honest. Talk like a top-performing salesperson on a good day: short sentences, first person, one clear question at a time. Never pressure. Never promise a price. If a caller asks for numbers, route them to a manager.`,
  services: [
    { name: "Test drive", category: "test_drive", durationMin: 30, providerKind: "sales_rep", description: "Schedule a no-pressure test drive with a sales consultant." },
    { name: "Service appointment", category: "service", durationMin: 90, providerKind: "service_advisor", description: "Routine maintenance, diagnostics, or warranty work. Drop-off recommended." },
    { name: "Trade-in appraisal", category: "appraisal", durationMin: 45, providerKind: "sales_rep", description: "In-person trade evaluation. Bring keys, registration, and any open finance details." },
    { name: "Vehicle pickup", category: "delivery", durationMin: 60, providerKind: "sales_rep", description: "Pickup of a purchased vehicle. Paperwork and walkthrough." },
  ],
  providers: [
    { name: "Marcus Chen", kind: "sales_rep", shifts: [...weekdayShift(), ...saturdayShift()] },
    { name: "Ava Washington", kind: "sales_rep", shifts: weekdayShift() },
    { name: "Diego Ruiz", kind: "sales_rep", shifts: [...weekdayShift(10, 20), ...saturdayShift()] },
    { name: "Service bay 1", kind: "service_advisor", shifts: weekdayShift(8, 17) },
    { name: "Service bay 2", kind: "service_advisor", shifts: weekdayShift(8, 17) },
  ],
  knowledge: [
    { title: "Financing", body: "We work with all major lenders, including credit unions. We can't quote rates over the phone — a finance manager will follow up after a credit application.", tags: ["finance"] },
    { title: "Trade-in process", body: "Bring the vehicle, both keys, current registration, and your payoff statement if you still owe on it. Appraisals take ~45 minutes.", tags: ["trade"] },
    { title: "Loaner cars", body: "We offer complimentary loaners for warranty work over 4 hours. Subject to availability — confirm at drop-off.", tags: ["service"] },
    { title: "Service hours", body: "Service is 8 AM to 5 PM weekdays. We accept after-hours drop-off through the lockbox to the right of the service entrance.", tags: ["service", "hours"] },
  ],
  followUpPolicy: {
    preApptReminderHoursBefore: 24,
    noShowRecoveryMinutesAfter: 15,
    missedCallCallbackMinutesAfter: 10,
    firstCallFollowupHoursAfter: 24,
  },
};
